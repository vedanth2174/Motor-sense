# 🧪 MotorSense — Complete End-to-End Testing Runbook

This guide walk you through testing the entire **MotorSense** platform from a cold start to full verification across all 3 detection layers.

---

## 📋 Overview of What You Are Testing

```
                                    ┌───────────────────────┐
                                    │   ESP32 / Simulator   │
                                    └──────────┬────────────┘
                                               │ HTTP POST (telemetry every 3s)
                                               ▼
                              ┌──────────────────────────────────┐
                              │     FastAPI Backend (:8000)      │
                              └───────┬──────────────┬───────────┘
                                      │              │
                   Layer 1: Rules ◄───┤              ├───► Layer 2: Isolation Forest
                 (Instant Trip >110%) │              │   (Multi-sensor Anomaly Score)
                                      │              │
                                      ▼              ▼
                              ┌──────────────────────────────────┐
                              │     PostgreSQL Database (:5432)  │
                              └──────────────────────────────────┘
                                               │ SSE Stream
                                               ▼
                              ┌──────────────────────────────────┐
                              │  React Dark Dashboard (:5173)    │
                              │ (Subtle Animations, Live Trends) │
                              └──────────────────────────────────┘
```

---

## ⚡ Quick Navigation

1. [Phase 1: Start the Stack](#phase-1--start-the-stack)
2. [Phase 2: Inspect the Live Dashboard](#phase-2--inspect-the-live-dashboard)
3. [Phase 3: Seed Baseline & Train ML Model](#phase-3--seed-baseline--train-ml-model)
4. [Phase 4: Fault Injection & Alert Animations](#phase-4--fault-injection--alert-animations)
5. [Phase 5: Triage & Acknowledge Incidents](#phase-5--triage--acknowledge-incidents)
6. [Phase 6: Run AI Predictive Diagnostics](#phase-6--run-ai-predictive-diagnostics)
7. [Phase 7: Run Automated Smoke Test](#phase-7--run-automated-smoke-test)
8. [Phase 8: Clean Teardown](#phase-8--clean-teardown)

---

## Phase 1 — Start the Stack

Open **PowerShell** in the project directory:

```powershell
cd C:\Studies\Mayur_Final_Year_Project\Motor-sense

# 1. Ensure .env exists
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# 2. Launch full stack WITH the live telemetry simulator
docker compose --profile demo up -d
```

### Verify Container Health:
```powershell
docker compose ps
```

**Expected Result:**
All 5 containers should show `Up` or `healthy`:
* `motorsense-postgres` (healthy)
* `motorsense-backend` (Up / healthy)
* `motorsense-frontend` (Up)
* `motorsense-simulator` (Up)
* `motorsense-keycloak` (healthy)

---

## Phase 2 — Inspect the Live Dashboard

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### What to Verify:
- [ ] **Dark Mode Theme:** The dashboard displays a deep slate/carbon theme with boxy 6–8px rounded cards and crisp white text.
- [ ] **Real-time Telemetry:** The 5 sensor cards (**Temperature, Humidity, Current, Voltage, Vibration**) update every 3 seconds.
- [ ] **Live Indicator:** Topbar displays a green pulsing `SYSTEM ONLINE` badge and sensor cards show `LIVE`.
- [ ] **Health Status Hero:** Health hero shows `SAFE` with a green accent border.

---

## Phase 3 — Seed Baseline & Train ML Model

The unsupervised **Isolation Forest** model requires **500+ valid healthy samples** to establish the motor's nominal operating envelope.

### Step 3.1: Rapidly Seed 520 Baseline Readings (~15 seconds)
Run this command in PowerShell:
```powershell
docker exec motorsense-simulator python simulate.py --seed-baseline
```

### Step 3.2: Train the Model via the UI
1. In the browser dashboard, click **"Motor Health"** in the sidebar.
2. Under **Baseline Learning Pipeline**, confirm:
   * Valid Samples: **520 / 500 (100%)**
   * State: `APPROVED_FOR_TRAINING` or `COLLECTING_BASELINE`
3. Click the **"Approve Baseline"** button.
4. Click the **"Train Isolation Forest"** button.
5. **Expected Result:** Machine status updates to **`HEALTHY_BASELINE_READY`**, and learned statistical distributions (Mean, Std Dev, Min, Max) are displayed.

---

## Phase 4 — Fault Injection & Alert Animations

Test instantaneous physical limits and observe the new subtle alert graphics.

### Test A: Overcurrent Fault (> 110% Rated Current)
Simulate current spiking to **~10.8A** (motor rated limit is 8.5A):
```powershell
docker exec motorsense-simulator python simulate.py --mode overcurrent --count 5
```

**Watch the Dashboard:**
* The **Current** sensor card immediately pulses with a subtle red breathing glow (`alertPulseRed`) and displays a blinking `[!] CRITICAL` chip.
* The **Active Alert Banner** appears at the top of the dashboard.
* The **Alerts** item in the sidebar lights up with a red counter badge `[ 1 ]`.
* The topbar bell icon displays a pulsating radar beacon badge.

---

### Test B: Mechanical Vibration Fault (ISO 10816 Limit)
Simulate excessive mechanical vibration (> 4.5 mm/s²):
```powershell
docker exec motorsense-simulator python simulate.py --mode vibration --count 5
```

**Watch the Dashboard:**
* The **Vibration** sensor card pulses in red with `[!] CRITICAL`.
* Health status transitions to `CRITICAL` with an emergency recommendation.

---

### Test C: Multi-Sensor Degradation Drift (ML Anomaly)
Simulate gradual multidimensional wear-and-tear:
```powershell
docker exec motorsense-simulator python simulate.py --mode drift --count 20
```

**Watch the Dashboard:**
* The Isolation Forest flags negative anomaly scores ($\le 0$).
* Health status transitions to `WARNING` with an amber breathing glow.

---

## Phase 5 — Triage & Acknowledge Incidents

1. Click **"Alerts"** in the sidebar (or click the alert banner shortcut).
2. Observe the **Asset Alerts & Incident Log**:
   * Open incidents have a pulsating indicator dot and red left-border callout.
   * Severity tags display crisp `CRITICAL` or `WARNING` pills.
3. Click the **"Acknowledge"** button on an open alert.
4. The incident status updates to `Acknowledged by operator` and the alert badge clears.

---

## Phase 6 — Run AI Predictive Diagnostics

1. Click **"AI Diagnostics"** in the sidebar.
2. Select time window: `30 minutes`.
3. Click **"Execute AI Diagnostics"**.
4. **Expected Result:**
   * The system aggregates the sensor telemetry window, active alerts, and motor nameplate ratings.
   * Generates a structured diagnosis card with:
     * **Operational Summary**
     * **Likely Root Causes**
     * **Actionable Maintenance & Repair Recommendations**

---

## Phase 7 — Run Automated Smoke Test

Run the complete automated test script against the running backend to verify all API contracts:

```powershell
$env:API_URL="http://localhost:8000"; python smoke_test.py
```

### What it automatically tests:
* `[1/7]` Health live & ready endpoints (`/health/live`, `/health/ready`).
* `[2/7]` Machine registry query (`/machines`).
* `[3/7]` Nominal telemetry ingestion & condition classification (`SAFE`).
* `[4/7]` Fault injection (overcurrent 11.2A) & verification of critical trip.
* `[5/7]` Alert generation & retrieval (`/alerts`).
* `[6/7]` Alert lifecycle acknowledgement (`/alerts/{id}/ack`).
* `[7/7]` AI diagnostics inference (`/diagnostics`).

---

## Phase 8 — Clean Teardown

When you are done testing, stop the containers cleanly:

```powershell
# Stop all containers INCLUDING the telemetry simulator (prevents "network in use" error):
docker compose --profile demo down
```

### Full Reset (Optional):
To clear the database and wipe all telemetry for a fresh start:
```powershell
docker compose --profile demo down -v
```

---

## 🎯 Test Summary Checklist

| Component | Tested Action | Verified? |
|---|---|---|
| **Stack Health** | Containers start and report healthy on ports 8000, 5173, 5432, 8080 | [ ] |
| **Dark Theme UI** | Boxy layout, white accents, live SSE streaming every 3s | [ ] |
| **Layer 1 Rules** | Instant overcurrent / vibration trip on >110% rated | [ ] |
| **Alert Visuals** | Breathing border pulse, topbar beacon, active alert banner, sidebar count | [ ] |
| **Layer 2 ML** | 520 baseline records seeded, Isolation Forest trained | [ ] |
| **Layer 3 LLM** | AI diagnostics generated with root cause & repair actions | [ ] |
| **Smoke Test** | `python smoke_test.py` passes 7/7 tests | [ ] |
| **Teardown** | Clean shutdown with `--profile demo down` | [ ] |
