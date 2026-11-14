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

### 2. Start Full Stack
```bash
# Starts PostgreSQL, Keycloak, FastAPI backend, and React frontend
docker compose up -d

# Or include the simulated telemetry stream:
docker compose --profile demo up -d
```

### 3. Access Services
- **React Frontend**: `http://localhost:5173`
- **FastAPI API & Docs**: `http://localhost:8000/docs`
- **Keycloak IAM Admin Console**: `http://localhost:8080/admin` (User: `admin` / Password: `admin`)

---

## 🤖 3-Layer Hybrid Detection Pipeline

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
