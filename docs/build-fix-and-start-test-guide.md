# MotorSense — Complete Build, Fix, Startup & Testing Guide

## 🛠️ Summary of Fixes & Updates Applied

| Component | File | Issue & Resolution |
|---|---|---|
| **Frontend Dockerfile** | `frontend/Dockerfile` | Fixed `addgroup: group 'nginx' in use` error by removing redundant user creation in `nginx:alpine` and fixed npm dependencies so `vite build` succeeds. |
| **Docker Compose** | `docker-compose.yml` | Updated services (`backend`, `frontend`, `simulator`) to use pre-built images (`motorsense-backend:latest`, `motorsense-frontend:latest`, `motorsense-simulator:latest`) for isolated image building. |
| **Frontend UI Revamp** | `frontend/src/` | Converted light/pastel styling into a **professional industrial dark mode** with boxy 6–8px rounded corners, high-contrast white text, colored status accents (green/red/blue/amber), and subtle alert animations. |
| **Subtle Alert Animations** | `SensorCard.tsx`, `Header.tsx`, `Dashboard.tsx`, `AlertsPage.tsx` | Added automated sensor threshold breach indicators, breathing border glows (`alertPulseRed`/`alertPulseAmber`), radar beacon pings, and topbar/sidebar incident badges. |
| **Settings Configuration** | `~/.claude/settings.json` | Fixed JSON syntax error (`End of file expected. @L4`) by placing `"env"` inside the root object. |

---

## 🚀 Step 1 — Prepare Environment Configuration

Ensure your environment variables are configured in the project root:

```powershell
cd "d:\project\BACKUP PROJECT"

# Copy sample environment configuration if .env doesn't exist
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

> [!NOTE]
> By default, `AUTH_ENABLED=false` in `.env`, allowing you to immediately test the frontend and API without signing into Keycloak.

---

## 📦 Step 2 — Build Container Images Individually

Build each Docker image before launching Docker Compose:

```powershell
# 1. Build Backend API Image
docker build -t motorsense-backend:latest ./backend

# 2. Build React Frontend SPA Image
docker build -t motorsense-frontend:latest ./frontend

# 3. Build ESP32 Telemetry Simulator Image
docker build -t motorsense-simulator:latest ./simulator
```

---

## ⚡ Step 3 — Start the Stack with Docker Compose

### Option A: Core Stack (PostgreSQL, Keycloak, Backend, Frontend)
```powershell
docker compose up -d
```

### Option B: Core Stack + Live Simulated Telemetry Stream (Recommended for Testing)
```powershell
docker compose --profile demo up -d
```
*(The `--profile demo` flag automatically spins up `motorsense-simulator` to send live mock sensor readings every 3 seconds).*

---

## 🔍 Step 4 — Verify Running Services

Check the container status:
```powershell
docker compose ps
```

Expected output:
```
NAME                    STATUS        PORTS
motorsense-postgres     Up (healthy)  0.0.0.0:5432->5432/tcp
motorsense-keycloak     Up (healthy)  0.0.0.0:8080->8080/tcp
motorsense-backend      Up            0.0.0.0:8005->8000/tcp
motorsense-frontend     Up            0.0.0.0:5173->80/tcp
motorsense-simulator    Up            (optional, demo profile)
```

### Access URLs:
* **React Dashboard:** [http://localhost:5173](http://localhost:5173)
* **FastAPI Swagger Docs:** [http://localhost:8005/docs](http://localhost:8005/docs)
* **Backend Health Check:** [http://localhost:8005/api/v1/health/ready](http://localhost:8005/api/v1/health/ready)
* **Keycloak Admin Console:** [http://localhost:8080](http://localhost:8080) (User: `admin` / Password: `admin`)

---

## 🧬 Step 5 — Seed Baseline Telemetry for Machine Learning

The Layer 2 Isolation Forest model requires **500+ valid healthy samples** before it can be trained.

Run the baseline seeder command directly inside the running container (takes ~15 seconds):
```powershell
docker exec motorsense-simulator python simulate.py --seed-baseline
```

*(Alternatively, if running outside Docker: `python simulator/simulate.py --seed-baseline`)*

### Train the ML Model via the UI:
1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Navigate to **Motor Health** in the sidebar.
3. You will see 520/500 samples collected (100% progress).
4. Click **"Approve Baseline"**, then click **"Train Isolation Forest"**.
5. The machine status will transition to **HEALTHY_BASELINE_READY**.

---

## 🚨 Step 6 — Fault Injection & Alert Testing

Test how the system, trip rules, and UI animations react under abnormal operating conditions.

### Inject Faults Using the Simulator Container:

```powershell
# 1. Overcurrent Fault (> 110% rated current ~10.8A)
docker exec motorsense-simulator python simulate.py --mode overcurrent --count 5

# 2. Overheat Fault (> 80°C max thermal limit ~86°C)
docker exec motorsense-simulator python simulate.py --mode overheat --count 5

# 3. High Vibration Fault (> 4.5 mm/s² ISO limit ~5.2 mm/s²)
docker exec motorsense-simulator python simulate.py --mode vibration --count 5

# 4. Undervoltage Fault (< 90% nominal voltage ~195V)
docker exec motorsense-simulator python simulate.py --mode undervoltage --count 5

# 5. Multi-Sensor Degradation Drift (Tests Isolation Forest)
docker exec motorsense-simulator python simulate.py --mode drift --count 20
```

### What to Observe in the Frontend:
1. **Sensor Card Glow:** The breached metric card pulses with a subtle red border glow (`alertPulseRed`) and displays a blinking `[!] CRITICAL` chip.
2. **Active Alert Banner:** The dashboard header displays an alert beacon warning banner with quick links to **Review Alerts** or **AI Diagnosis**.
3. **Topbar & Sidebar Badges:** The notification bell and sidebar "Alerts" link display active unacknowledged counter badges.
4. **Alerts Page:** Navigate to the **Alerts** page to view the exception in the incident table and click **"Acknowledge"**.

---

## 🧪 Step 7 — Automated Smoke / E2E Verification

Run the automated end-to-end verification script against the running backend:

```powershell
# Run smoke test suite
$env:API_URL="http://localhost:8005"; python smoke_test.py
```

This verifies:
* Health and database readiness endpoints (`/health/live`, `/health/ready`).
* Machine registry listing (`/machines`).
* Ingestion of nominal data and condition evaluation (`/ingest`).
* Injection of overcurrent fault and verification that a `CRITICAL` alert was produced.
* Alert queries and lifecycle verification.

---

## 🔐 Keycloak Authentication (Optional)

When you are ready to enable enterprise OAuth2/OIDC authentication:

1. In `.env`, set:
   ```env
   AUTH_ENABLED=true
   ```
2. Restart the backend and frontend:
   ```powershell
   docker compose restart backend frontend
   ```
3. Open `http://localhost:5173`. The application will redirect to the Keycloak login screen.
4. Default pre-seeded realm accounts (`motorsense-realm.json`):
   * **Admin:** `admin1` / `admin123`
   * **Engineer:** `engineer1` / `engineer123`
   * **Viewer:** `viewer1` / `viewer123`

---

## 🛑 Stopping or Resetting the Environment

```powershell
# Stop core services
docker compose down

# Stop full stack INCLUDING the demo simulator container (prevents "network in use" error):
docker compose --profile demo down
# Or stop all profile services:
docker compose --profile * down

# If a container lingers and holds onto the network:
docker stop motorsense-simulator; docker rm motorsense-simulator
docker network prune -f

# Stop and clear database volumes (fresh data reset)
docker compose --profile * down -v
```
