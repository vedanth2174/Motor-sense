import argparse
import os
import random
import time
import requests
from datetime import datetime, timezone

API_URL = os.getenv("API_URL", "http://localhost:8005/api/v1/ingest")
API_KEY = os.getenv("DEVICE_API_KEY", "ms_demo_esp32_device_key_12345")
MACHINE_ID = os.getenv("MACHINE_ID", "MOTOR_001")


def generate_reading(mode: str, step: int = 0) -> dict:
    # Baseline nominal parameters for MOTOR_001 (230V, 8.5A rated)
    voltage = random.gauss(230.0, 2.5)
    current = random.gauss(7.2, 0.4)
    temperature = random.gauss(48.0, 1.5)
    humidity = random.gauss(42.0, 3.0)
    vibration = random.gauss(1.4, 0.2)

    if mode == "overcurrent":
        current = random.gauss(10.8, 0.5)  # > 110% rated (9.35A)
        temperature = random.gauss(68.0, 2.0)
    elif mode == "overheat":
        temperature = random.gauss(86.0, 2.0)  # > 80C rated
        vibration = random.gauss(3.1, 0.3)
    elif mode == "vibration":
        vibration = random.gauss(5.2, 0.6)  # > 4.5 m/s ISO critical
        current = random.gauss(8.2, 0.4)
    elif mode == "drift":
        # Gradual degradation over steps
        factor = min(step / 60.0, 2.5)
        temperature += factor * 15.0
        vibration += factor * 1.8
        current += factor * 0.8
    elif mode == "undervoltage":
        voltage = random.gauss(195.0, 3.0)  # < 90% rated

    return {
        "machine_id": MACHINE_ID,
        "temperature": round(max(temperature, -10.0), 2),
        "humidity": round(min(max(humidity, 5.0), 99.0), 2),
        "current": round(max(current, 0.1), 2),
        "voltage": round(max(voltage, 50.0), 1),
        "vibration": round(max(vibration, 0.05), 3),
        "recorded_at": datetime.now(timezone.utc).isoformat()
    }


def main():
    parser = argparse.ArgumentParser(description="MotorSense ESP32 Telemetry Simulator")
    parser.add_argument("--mode", default="healthy", choices=["healthy", "overcurrent", "overheat", "vibration", "drift", "undervoltage"])
    parser.add_argument("--interval", type=float, default=3.0, help="Interval in seconds")
    parser.add_argument("--count", type=int, default=0, help="Number of readings (0 = infinite)")
    parser.add_argument("--seed-baseline", action="store_true", help="Quickly post 520 healthy readings for baseline model training")
    args = parser.parse_args()

    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
    }

    if args.seed_baseline:
        print(f"[*] Rapidly generating and posting 520 healthy readings to {API_URL}...")
        for i in range(520):
            payload = generate_reading("healthy", i)
            try:
                r = requests.post(API_URL, json=payload, headers=headers, timeout=10)
                if r.status_code not in (200, 201):
                    print(f"Warning: got HTTP {r.status_code}: {r.text}")
            except Exception as e:
                print(f"Error connecting to backend: {e}")
                time.sleep(0.5)
            time.sleep(0.02)
            if i % 50 == 0:
                print(f"  Posted {i+1}/520 readings...")
        print("[+] Finished seeding 520 baseline readings!")
        return

    print(f"[*] Starting MotorSense ESP32 Simulator | Mode: {args.mode} | Target: {API_URL}")
    step = 0
    while True:
        payload = generate_reading(args.mode, step)
        try:
            r = requests.post(API_URL, json=payload, headers=headers, timeout=5)
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            condition = data.get("condition", "UNKNOWN")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Posted #{step+1} | Temp: {payload['temperature']}°C | Curr: {payload['current']}A | Vib: {payload['vibration']} | Cond: {condition} (HTTP {r.status_code})")
        except Exception as e:
            print(f"[-] Connection failed ({e}). Retrying in {args.interval}s...")

        step += 1
        if args.count > 0 and step >= args.count:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
