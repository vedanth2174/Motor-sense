# MotorSense — Enterprise AC Motor Predictive Maintenance System

MotorSense is an end-to-end industrial IoT predictive maintenance platform that collects high-frequency electrical and mechanical telemetry from AC induction motors via ESP32 microcontrollers, applies a 3-layer hybrid detection pipeline (deterministic rules + statistical Isolation Forest baseline + LLM engineering diagnostics), and delivers real-time monitoring and alert management through a responsive React dashboard.

---

## 🏛️ System Architecture

```
                       ┌────────────────── MotorSense Architecture ──────────────────┐
                       │                                                             │
  🔌 ESP32 Microcontroller  ─── HTTP POST /api/v1/ingest ──►  FastAPI Backend (:8000)   │
  (X-API-Key: ms_xxx)  │      (Validates, scores & alerts)     │                     │
                       │                                       ├──► PostgreSQL (:5432)│
  🖥️ React Dashboard   ◄─── SSE Stream /api/v1/stream ─────────┤                      │
  (Keycloak OIDC JWT)  ─── REST API /api/v1/* ────────────────►│                      │
                       │                                       ├──► ML Models (/models)
  🔐 Keycloak IAM      ◄─── OIDC Auth (Token Verification) ────┤                      │
  (:8080)              │                                       └──► LLM Diagnostics  │
                       │                                            (Ollama/OpenRouter)
                       └─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Docker Compose)

### 1. Configure Environment
```bash
cp .env.example .env
```

### 2. Build Docker Images
Build the container images individually before starting Compose:
```bash
# Core services
docker build -t motorsense-backend:latest ./backend
docker build -t motorsense-frontend:latest ./frontend

# Optional: simulator for live demo data stream
docker build -t motorsense-simulator:latest ./simulator
```

### 3. Start Stack
```bash
# Starts PostgreSQL, Keycloak, FastAPI backend, and React frontend
docker compose up -d

# Or include the simulated ESP32 telemetry stream (recommended for testing):
docker compose --profile demo up -d
```

### 4. Access Services
- **React Frontend**: `http://localhost:5173`
- **FastAPI API & Docs**: `http://localhost:8000/docs`
- **Keycloak IAM Admin Console**: `http://localhost:8080/admin` (User: `admin` / Password: `admin`)

### 5. Stop Stack
```bash
# Stop core services
docker compose down

# Stop full stack INCLUDING the demo simulator container:
docker compose --profile demo down

# Note: If you ran with '--profile demo' and run plain 'docker compose down', 
# the simulator remains running and causes "Network resource is still in use".
# Use '--profile * down' to ensure all profiled containers stop cleanly.
```

---

## 📡 ESP32 Telemetry Simulator

The **Simulator** (`simulator/simulate.py` / `motorsense-simulator`) emulates a physical ESP32 IoT microcontroller attached to an AC motor. It enables end-to-end testing and real-time dashboard visualization without requiring physical sensor hardware.

### Features
- **Synthetic Sensor Telemetry:** Generates realistic voltage (~230V), current (~7.2A), temperature (~48°C), humidity (~42%), and vibration (~1.4 mm/s) readings every 3 seconds.
- **Direct Backend Streaming:** Authenticates via device API key (`X-API-Key: ms_demo_esp32_device_key_12345`) and pushes to `POST /api/v1/ingest` to feed the live SSE stream on the dashboard.
- **Fault Injection Scenarios:** Simulates failure modes to test alerts and anomaly detection:
  - `healthy`: Normal motor operation.
  - `overcurrent`: Spikes current above 110% rated (Layer 1 deterministic trip).
  - `overheat`: Exceeds motor rated thermal limit.
  - `vibration`: Exceeds ISO 10816 vibration threshold (4.5 mm/s²).
  - `undervoltage`: Voltage drop below 90% nominal.
  - `drift`: Subtle degradation across multiple sensors to test the Isolation Forest.
- **Baseline Seeding:** Includes `--seed-baseline` to rapidly push 500+ healthy records required to train the statistical Isolation Forest model.

### Using the Simulator with Docker
- **Start Simulator with Stack:**
  ```bash
  docker compose --profile demo up -d
  ```
- **Rapidly Seed 520 Baseline Readings (in ~15 seconds):**
  ```bash
  docker exec motorsense-simulator python simulate.py --seed-baseline
  ```
- **Inject Fault Bursts to Test Dashboard Alerts & Animations:**
  ```bash
  # Trigger overcurrent trip (current spikes to ~10.8A):
  docker exec motorsense-simulator python simulate.py --mode overcurrent --count 5

  # Trigger vibration alert (> 4.5 mm/s ISO limit):
  docker exec motorsense-simulator python simulate.py --mode vibration --count 5
  ```
- **Run as a Standalone Python Script (outside Docker):**
  ```bash
  python simulator/simulate.py --mode healthy --interval 3.0
  # Or quickly seed training data:
  python simulator/simulate.py --seed-baseline
  ```

---

## 🧪 Testing & Verification

- **Smoke / E2E Test Suite (against running stack):**
  ```bash
  python smoke_test.py
  ```
- **Unit & Integration Tests (without Docker):**
  ```bash
  pytest backend/tests
  ```

---

## 🤖 3-Layer Hybrid Detection Pipeline

> 📖 **Deep Dive Documentation:** For mathematical formulations, decision functions, and the forward-looking AI roadmap, see the [Machine Learning & Generative AI Architecture Guide](ML_AND_AI_ARCHITECTURE.md). For end-to-end verification, follow the [Testing Guide](TESTING_GUIDE.md).

1. **Layer 1: Deterministic Physics Rules (`services/rules.py`)**
   - Instantaneous boundary violation checks based on motor ratings:
     - Overcurrent: `> 110%` rated current $\rightarrow$ **CRITICAL ALERT**
     - Voltage tolerance: outside `±10%` nominal $\rightarrow$ **CRITICAL ALERT**
     - Thermal limit: `> rated_temp_max` $\rightarrow$ **CRITICAL ALERT**
     - Vibration severity: `> 4.5 m/s²` (ISO 10816 limit) $\rightarrow$ **CRITICAL ALERT**

2. **Layer 2: Statistical Baseline Model (`services/training.py` & `scoring.py`)**
   - Learns nominal multi-variate correlations across all 5 sensors using an **Isolation Forest**.
   - Requires 500 valid samples + human engineer sign-off to train.
   - Calculates anomaly scores ($\le 0$ flags subtle multi-dimensional drift).

3. **Layer 3: Generative AI Diagnosis (`services/llm/`)**
   - Aggregates the last telemetry window, active alerts, and asset ratings.
   - Formulates root-cause diagnoses, severity classification, and specific repair instructions.
   - Works with **Ollama** (offline local), **OpenRouter** (cloud), or offline fallback.

---

## 👥 Default Keycloak Accounts & Roles

The Keycloak realm (`motorsense-realm.json`) is automatically imported on startup:

| Username | Password | Role | Permissions |
|---|---|---|---|
| `admin1` | `admin123` | `admin` | Full system access, register motors, generate device gateway keys |
| `engineer1` | `engineer123` | `engineer` | Acknowledge alerts, approve baselines, train models, log maintenance |
| `viewer1` | `viewer123` | `viewer` | Read-only access to dashboard and live telemetry |
