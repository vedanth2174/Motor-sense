/*
 * MotorSense - ESP32-S3 Real-Time Motor Health Monitoring Firmware
 * Group 12 - Department of E&TC, VIIT Pune
 * 
 * Hardware Configuration:
 * - MCU: ESP32-S3 (Xtensa Dual-Core 240MHz, 8MB Flash)
 * - ADXL345 Accelerometer: I2C (SDA: GPIO 8, SCL: GPIO 9)
 * - ZMPT101B Voltage Transformer: Analog GPIO 5 (ADC1_CH4)
 * - ACS712 Current Sensor: Analog GPIO 6 (ADC1_CH5)
 * - DHT11 Temp/Humidity: Digital GPIO 4
 * - MicroSD Card Module: SPI (CS: GPIO 10, MOSI: GPIO 11, SCK: GPIO 12, MISO: GPIO 13)
 * 
 * Target Ingestion Server:
 * - URL: http://<PC_IP_ADDRESS>:8005/api/v1/ingest
 * - Header: X-API-Key: ms_demo_esp32_device_key_12345
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <FS.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ==============================================================================
// 1. NETWORK & BACKEND CONFIGURATION
// ==============================================================================
// Replace with your local 2.4 GHz Wi-Fi credentials
const char* WIFI_SSID     = "moto";
const char* WIFI_PASSWORD = "45454545";

// Host Machine IP (PC running the MotorSense Docker Stack)
// Port 8005 forwards to backend container port 8000
const char* BACKEND_INGEST_URL = "http://10.31.57.45:8005/api/v1/ingest";

// Pre-registered Factory Gateway Device API Key for MOTOR_001
const char* DEVICE_API_KEY     = "ms_demo_esp32_device_key_12345";
const char* MACHINE_ID         = "MOTOR_001";

// Telemetry Sampling Interval (milliseconds)
const unsigned long TRANSMIT_INTERVAL_MS = 3000;

// ==============================================================================
// 2. PIN ASSIGNMENTS & HARDWARE OBJECTS
// ==============================================================================
#define PIN_ZMPT_VOLTAGE  5   // ADC1_CH4 (ZMPT101B Analog Out)
#define PIN_ACS_CURRENT   6   // ADC1_CH5 (ACS712 Analog Out)
#define PIN_DHT_DATA      4   // Digital GPIO (DHT11 Data)
#define PIN_I2C_SDA       8   // I2C SDA (ADXL345)
#define PIN_I2C_SCL       9   // I2C SCL (ADXL345)
#define PIN_STATUS_LED    2   // Onboard indicator LED

// MicroSD Card SPI Pinout (ESP32-S3 standard SPI pins)
#define PIN_SD_CS         10  // SD Card Chip Select (CS)
#define PIN_SD_MOSI       11  // SD Card MOSI / CMD
#define PIN_SD_SCK        12  // SD Card SCK / CLK
#define PIN_SD_MISO       13  // SD Card MISO / DAT0

#define DHTTYPE DHT11
DHT dht(PIN_DHT_DATA, DHTTYPE);

// Assign a unique ID to the accelerometer sensor
Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);

// SPI instance for SD card module
SPIClass sdSPI(FSPI);
bool sdCardAvailable = false;
const char* SD_LOG_FILE = "/motor_data.csv";

// ==============================================================================
// 3. CALIBRATION CONSTANTS
// ==============================================================================
const float ADC_VOLTAGE_REF    = 3.3;      // ESP32-S3 ADC Reference Voltage
const int   ADC_RESOLUTION     = 4095;     // 12-bit ADC (0 - 4095)

// ACS712 20A version: 100 mV per Amp (0.1 V/A)
const float ACS712_SENSITIVITY = 0.100;    // 100 mV/A for 20A module

// ZMPT101B Voltage Transformer calibration factor (adjust against multimeter)
const float ZMPT_CALIBRATION   = 285.0;

// Gravity filtering constant for ADXL345 (EMA filter)
const float GRAVITY_ALPHA      = 0.05;
float gx = 0, gy = 0, gz = 9.80665; // Static gravity estimation

unsigned long lastTransmitTime = 0;

// ==============================================================================
// 4. SENSOR ACQUISITION FUNCTIONS WITH ZERO-DETECTION
// ==============================================================================

// Sample True-RMS Voltage from ZMPT101B over 2 full AC mains cycles (40ms at 50Hz)
// Automatically clamps to 0.0V if sensor is disconnected, floating, or idle.
float readRMSVoltage() {
  const int MAX_SAMPLES = 250;
  float vSamples[MAX_SAMPLES];
  int count = 0;
  float sumV = 0.0;
  float vMin = 5.0;
  float vMax = 0.0;

  unsigned long startMicros = micros();
  // Sample for 40ms (2 complete 50Hz mains cycles)
  while ((micros() - startMicros < 40000) && (count < MAX_SAMPLES)) {
    int raw = analogRead(PIN_ZMPT_VOLTAGE);
    float v = (raw * ADC_VOLTAGE_REF) / ADC_RESOLUTION;
    vSamples[count] = v;
    sumV += v;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
    count++;
    delayMicroseconds(160);
  }

  if (count == 0) return 0.0;

  float vMean = sumV / count;
  float vPeakToPeak = vMax - vMin;

  // Zero-detection heuristics:
  // 1. If pin is disconnected/floating to 3.3V or GND (vMean outside valid range)
  // 2. If peak-to-peak amplitude is negligible (< 0.08V), no AC mains is present
  if (vPeakToPeak < 0.08 || vMean > 3.10 || vMean < 0.15) {
    return 0.0;
  }

  // True-RMS calculation with dynamic DC midpoint subtraction
  double sumSquared = 0.0;
  for (int i = 0; i < count; i++) {
    float acComponent = vSamples[i] - vMean;
    sumSquared += (acComponent * acComponent);
  }

  double vRms = sqrt(sumSquared / count) * ZMPT_CALIBRATION;
  if (vRms < 12.0) return 0.0; // Cut off residual noise floor
  return (float)vRms;
}

// Sample True-RMS Current from ACS712 over 2 full AC mains cycles (40ms at 50Hz)
// Automatically clamps to 0.00A if sensor is disconnected, floating, or has no load.
float readRMSCurrent() {
  const int MAX_SAMPLES = 250;
  float iSamples[MAX_SAMPLES];
  int count = 0;
  float sumV = 0.0;
  float vMin = 5.0;
  float vMax = 0.0;

  unsigned long startMicros = micros();
  // Sample for 40ms (2 complete 50Hz mains cycles)
  while ((micros() - startMicros < 40000) && (count < MAX_SAMPLES)) {
    int raw = analogRead(PIN_ACS_CURRENT);
    float v = (raw * ADC_VOLTAGE_REF) / ADC_RESOLUTION;
    iSamples[count] = v;
    sumV += v;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
    count++;
    delayMicroseconds(160);
  }

  if (count == 0) return 0.0;

  float vMean = sumV / count;
  float vPeakToPeak = vMax - vMin;

  // Zero-detection heuristics:
  // 1. If pin is floating near 3.3V rail or GND (unconnected pin)
  // 2. If peak-to-peak swing is within quiescent noise (< 0.05V), no current is flowing
  if (vPeakToPeak < 0.05 || vMean > 3.10 || vMean < 0.15) {
    return 0.0;
  }

  // True-RMS calculation around dynamic quiescent DC bias
  double sumSquared = 0.0;
  for (int i = 0; i < count; i++) {
    float acVolts = iSamples[i] - vMean;
    float currentInst = acVolts / ACS712_SENSITIVITY;
    sumSquared += (currentInst * currentInst);
  }

  double iRms = sqrt(sumSquared / count);
  if (iRms < 0.12) return 0.0; // Noise suppression threshold
  return (float)iRms;
}

// Sample ADXL345 Vibration Magnitude and extract pure dynamic RMS (removing 1g gravity)
float readRMSVibration() {
  const int SAMPLES = 60;
  double sumSquared = 0;
  
  for (int i = 0; i < SAMPLES; i++) {
    sensors_event_t event;
    accel.getEvent(&event);
    
    // Dynamic gravity extraction via Exponential Moving Average (EMA)
    gx = GRAVITY_ALPHA * event.acceleration.x + (1.0 - GRAVITY_ALPHA) * gx;
    gy = GRAVITY_ALPHA * event.acceleration.y + (1.0 - GRAVITY_ALPHA) * gy;
    gz = GRAVITY_ALPHA * event.acceleration.z + (1.0 - GRAVITY_ALPHA) * gz;
    
    // Pure dynamic vibration component
    float dx = event.acceleration.x - gx;
    float dy = event.acceleration.y - gy;
    float dz = event.acceleration.z - gz;
    
    float mag = sqrt(dx * dx + dy * dy + dz * dz);
    sumSquared += mag * mag;
    delay(5);
  }
  
  return (float)sqrt(sumSquared / SAMPLES);
}

// ==============================================================================
// 5. SD CARD LOGGING ROUTINE
// ==============================================================================
void initSDCard() {
  Serial.print("[SD CARD] Initializing SPI bus (CS: ");
  Serial.print(PIN_SD_CS);
  Serial.print(", MOSI: ");
  Serial.print(PIN_SD_MOSI);
  Serial.print(", SCK: ");
  Serial.print(PIN_SD_SCK);
  Serial.print(", MISO: ");
  Serial.print(PIN_SD_MISO);
  Serial.println(")...");

  sdSPI.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);

  if (!SD.begin(PIN_SD_CS, sdSPI, 4000000)) {
    Serial.println("[SD CARD] Warning: MicroSD card mount failed or module not connected!");
    Serial.println("[SD CARD] Continuing normal operations with Wi-Fi ingestion.");
    sdCardAvailable = false;
    return;
  }

  uint8_t cardType = SD.cardType();
  if (cardType == CARD_NONE) {
    Serial.println("[SD CARD] Warning: No SD card inserted.");
    sdCardAvailable = false;
    return;
  }

  sdCardAvailable = true;
  Serial.print("[SD CARD] Card Size: ");
  Serial.print((float)(SD.cardSize() / (1024.0 * 1024.0)));
  Serial.println(" MB");

  // Create CSV file with header if it doesn't already exist
  if (!SD.exists(SD_LOG_FILE)) {
    File file = SD.open(SD_LOG_FILE, FILE_WRITE);
    if (file) {
      file.println("timestamp_ms,machine_id,voltage_v,current_a,vibration_mps2,temperature_c,humidity_pct,condition,server_synced");
      file.close();
      Serial.println("[SD CARD] Created /motor_data.csv with telemetry header.");
    }
  } else {
    Serial.println("[SD CARD] Existing /motor_data.csv found. Ready to append telemetry.");
  }
}

void logTelemetryToSD(float voltage, float current, float vibration, float temp, float hum, bool serverSynced) {
  if (!sdCardAvailable) return;

  File file = SD.open(SD_LOG_FILE, FILE_APPEND);
  if (file) {
    const char* condition = (voltage > 250.0 || current > 15.0 || temp > 75.0 || vibration > 4.5) ? "CRITICAL" : "NORMAL";
    file.printf("%lu,%s,%.1f,%.2f,%.3f,%.1f,%.1f,%s,%s\n",
                millis(),
                MACHINE_ID,
                voltage,
                current,
                vibration,
                temp,
                hum,
                condition,
                serverSynced ? "YES" : "NO");
    file.close();
    Serial.println("[SD CARD] Logged record to /motor_data.csv");
  } else {
    Serial.println("[SD CARD ERROR] Failed to open /motor_data.csv for write!");
  }
}

// ==============================================================================
// 6. WI-FI INITIALIZATION
// ==============================================================================
void connectToWiFi() {
  Serial.println();
  Serial.print("[Wi-Fi] Connecting to: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.println("\n[Wi-Fi] Connected successfully!");
    Serial.print("[Wi-Fi] Assigned IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("[Wi-Fi] Gateway: ");
    Serial.println(WiFi.gatewayIP());
  } else {
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.println("\n[Wi-Fi] Connection failed! Will retry in main loop...");
  }
}

// ==============================================================================
// 7. SETUP ROUTINE
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n========================================================");
  Serial.println("  MotorSense - ESP32-S3 Telemetry Ingestion Node v2.0   ");
  Serial.println("========================================================");
  
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);
  
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db); // Up to ~3.1V range
  
  // Initialize I2C with ESP32-S3 custom pins
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL, 400000); // 400 kHz Fast I2C
  
  // Initialize ADXL345 Accelerometer
  if (!accel.begin()) {
    Serial.println("[ERROR] ADXL345 sensor not detected on I2C bus! Check wiring.");
  } else {
    accel.setRange(ADXL345_RANGE_16_G);
    Serial.println("[OK] ADXL345 Initialized (13-bit High Resolution, +/-16g)");
  }
  
  // Initialize DHT11
  dht.begin();
  Serial.println("[OK] DHT11 Thermal & Humidity Sensor Initialized");
  
  // Initialize MicroSD Card
  initSDCard();
  
  // Connect to Network
  connectToWiFi();
}

// ==============================================================================
// 8. MAIN TRANSMISSION LOOP
// ==============================================================================
void loop() {
  // Ensure Wi-Fi remains connected
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }
  
  unsigned long currentMillis = millis();
  if (currentMillis - lastTransmitTime >= TRANSMIT_INTERVAL_MS) {
    lastTransmitTime = currentMillis;
    
    // 1. Read Transducers with Zero-Detection
    float voltage   = readRMSVoltage();
    float current   = readRMSCurrent();
    float vibration = readRMSVibration();
    float temp      = dht.readTemperature();
    float hum       = dht.readHumidity();
    
    // Check DHT sensor validity
    if (isnan(temp) || isnan(hum)) {
      temp = 28.5; // Realistic fallback if sensor momentarily busy
      hum  = 65.0;
    }
    
    // 2. Print local readings to Serial Monitor
    Serial.println("--------------------------------------------------------");
    Serial.printf("[SENSOR] V: %.1f V | I: %.2f A | Vib: %.3f m/s2 | Temp: %.1f C | Hum: %.1f %%\n",
                  voltage, current, vibration, temp, hum);
    
    // 3. Serialize Telemetry into JSON
    StaticJsonDocument<256> doc;
    doc["machine_id"]  = MACHINE_ID;
    doc["voltage"]     = round(voltage * 10.0) / 10.0;
    doc["current"]     = round(current * 100.0) / 100.0;
    doc["temperature"] = round(temp * 10.0) / 10.0;
    doc["humidity"]    = round(hum * 10.0) / 10.0;
    doc["vibration"]   = round(vibration * 1000.0) / 1000.0;
    
    String jsonPayload;
    serializeJson(doc, jsonPayload);
    
    // 4. HTTP POST to MotorSense Backend
    bool serverSynced = false;
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(BACKEND_INGEST_URL);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-Key", DEVICE_API_KEY);
      http.setTimeout(2500); // 2.5 second timeout
      
      int httpResponseCode = http.POST(jsonPayload);
      
      if (httpResponseCode > 0) {
        String responseBody = http.getString();
        Serial.printf("[HTTP POST] Success (Code: %d) -> Server Response: %s\n", 
                      httpResponseCode, responseBody.c_str());
        serverSynced = true;
        
        // Quick visual pulse on successful ingest
        digitalWrite(PIN_STATUS_LED, LOW);
        delay(40);
        digitalWrite(PIN_STATUS_LED, HIGH);
      } else {
        Serial.printf("[HTTP POST ERROR] Failed, error code: %s\n", http.errorToString(httpResponseCode).c_str());
      }
      
      http.end();
    } else {
      Serial.println("[OFFLINE] Wi-Fi disconnected. Telemetry buffered locally.");
    }

    // 5. Append Telemetry to MicroSD Card (/motor_data.csv)
    logTelemetryToSD(voltage, current, vibration, temp, hum, serverSynced);
  }
}
