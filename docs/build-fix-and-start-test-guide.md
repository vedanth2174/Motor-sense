# MotorSense — Build Fix & Startup Guide

## What Was Fixed (Already Applied to Code)

| Fix | File | Why |
|---|---|---|
| OOM-safe Dockerfile | `backend/Dockerfile` | Split pip into 2 stages: heavy libs (numpy/sklearn) first, then rest — uses pre-built wheels, no C compilation |
| Pinned dependency ranges | `backend/requirements.txt` | Faster pip resolver = less RAM |
| Missing `__init__.py` | 6 files in `backend/app/` | Python package imports would fail without these |
| `.wslconfig` created | `C:\Users\ASUS\.wslconfig` | Gives WSL2 6 GB RAM so Docker build doesn't OOM |

---

## Step 1 — Restart WSL2 (REQUIRED — do this now)

The `.wslconfig` only takes effect after a full WSL2 restart.

Open **PowerShell as Administrator** and run:

```powershell
wsl --shutdown
```

Then restart Docker Desktop from the system tray.  
Wait ~30 seconds for Docker to fully start (green icon).

---

## Step 2 — Run the Build

Open a **regular PowerShell** window (not admin), then:

```powershell
cd "d:\project\BACKUP PROJECT"

# Git commit the fixes first
git add -A
git commit -m "fix: OOM-safe Dockerfile, pin deps, add missing __init__.py files"

# Build and start (no simulator by default)
docker compose up --build -d
```

Expected build time: **~5–8 minutes** (first time, downloads layers).

> [!TIP]
> If `docker compose` says "unknown shorthand flag: -f", your Docker version
> uses `docker-compose` (v1). Try: `docker-compose up --build -d`

---

## Step 3 — Verify Everything Is Up

```powershell
# Check all containers are running
docker compose ps

# Backend health
curl http://localhost:8000/api/v1/health/ready

# Frontend
start http://localhost:5173

# Keycloak admin console (if AUTH_ENABLED=true)
start http://localhost:8080
```

Expected `docker compose ps` output:
```
NAME                    STATUS        PORTS
motorsense-postgres     Up (healthy)  0.0.0.0:5432->5432/tcp
motorsense-keycloak     Up (healthy)  0.0.0.0:8080->8080/tcp
motorsense-backend      Up (healthy)  0.0.0.0:8000->8000/tcp
motorsense-frontend     Up            0.0.0.0:5173->80/tcp
```

---

## Step 4 — Seed Baseline Data

The ML model (Isolation Forest) needs ~500 normal readings to train.

```powershell
# From the project root — seeds 520 normal readings for MOTOR_001
python simulator/simulate.py --seed-baseline

# Then start live simulation (healthy mode)
python simulator/simulate.py --mode healthy --interval 3
```

After ~520 readings the backend auto-trains the model and sets machine status to `ACTIVE`.

---

## Step 5 — Test Fault Injection

Open a second terminal and inject faults:

```powershell
# Overcurrent fault
python simulator/simulate.py --mode overcurrent --interval 2

# Overheat
python simulator/simulate.py --mode overheat --interval 2

# High vibration
python simulator/simulate.py --mode vibration --interval 2
```

Watch the **Alerts** page in the frontend at `http://localhost:5173` — alerts should appear in real-time via SSE.

---

## Step 6 — AI Diagnosis (Works Without Ollama)

**Default (`LLM_PROVIDER=none`):** The `FallbackProvider` gives deterministic rule-based diagnosis. No Ollama required.

To use Ollama locally:
1. Install Ollama: https://ollama.com
2. Pull a model: `ollama pull qwen2.5:7b`
3. Add to your `.env`:
   ```
   LLM_PROVIDER=ollama
   LLM_BASE_URL=http://host.docker.internal:11434/v1
   LLM_MODEL=qwen2.5:7b
   ```
4. Restart: `docker compose up -d backend`

---

## Keycloak Configuration (Only Needed When AUTH_ENABLED=true)

By default `AUTH_ENABLED=false` — the system runs with a mock admin user. You can fully use and test the app without Keycloak.

**When you're ready to enable auth:**

### Step A — Import realm (auto-done by docker compose)
The realm JSON at `keycloak/motorsense-realm.json` is automatically imported when Keycloak starts.

### Step B — Log in to Keycloak Admin
- URL: http://localhost:8080
- User: `admin` / Password: `admin`
- Realm: `motorsense` (pre-imported)

### Step C — Pre-created demo users (change passwords!)
| Username | Password | Role | Can Do |
|---|---|---|---|
| `admin1` | `Admin@123` | `admin` | Everything |
| `engineer1` | `Eng@1234` | `engineer` | Acknowledge alerts, train models |
| `viewer1` | `View@1234` | `viewer` | Read-only dashboard |

> [!IMPORTANT]
> Change these passwords in Keycloak Admin Console → Users before exposing to any network.

### Step D — Enable auth
Edit `.env` in project root:
```env
AUTH_ENABLED=true
```
Then restart:
```powershell
docker compose up -d backend frontend
```

The frontend will now redirect to Keycloak login.

### Step E — OIDC URLs (already configured in docker-compose.yml)
```
OIDC_ISSUER=http://localhost:8080/realms/motorsense    # browser-facing
OIDC_JWKS_URL=http://keycloak:8080/realms/motorsense/protocol/openid-connect/certs  # backend internal
OIDC_AUDIENCE=motorsense-api
```
These match because Keycloak's `KC_HOSTNAME` is set to `http://localhost:8080`.

---

## Troubleshooting

### "Bus error (core dumped)" during docker build
→ WSL2 OOM. Did you run `wsl --shutdown` and restart Docker? Check `.wslconfig` has `memory=6GB`.

### Backend starts then crashes with "No module named 'app'"
→ Missing `__init__.py` — already fixed. Rebuild: `docker compose build backend`

### Frontend shows blank page / network error
→ Check `nginx.conf` proxy. `API_BASE_URL` in docker-compose.yml points to `http://localhost:8000`. Ensure backend is healthy first.

### Keycloak redirect loop
→ `KC_HOSTNAME` must match the browser URL. Both must be `http://localhost:8080` (not `keycloak:8080`).

### "Device API key invalid" from simulator
→ The default key `ms_demo_esp32_device_key_12345` matches the Device seeded at startup for MOTOR_001. If you created a new Device via the API, copy its key from the response.

---

## Architecture Quick Reference

```
Browser (React + Keycloak.js)
  │  port 5173
  ▼
nginx (SPA + /api proxy)
  │  proxy_pass to backend:8000
  ▼
FastAPI Backend
  ├── /api/v1/ingest        ← ESP32/simulator sends telemetry here (device API key)
  ├── /api/v1/machines      ← CRUD, baseline, train, predict
  ├── /api/v1/alerts        ← List + acknowledge
  ├── /api/v1/maintenance   ← Maintenance log
  ├── /api/v1/stream        ← SSE real-time push
  └── /metrics              ← Prometheus
  │
  ├── services/rules.py     ← Layer 1: deterministic thresholds (always runs)
  ├── services/scoring.py   ← Layer 2: Isolation Forest anomaly score
  └── services/llm/         ← Layer 3: AI narrative diagnosis (optional)
  │
PostgreSQL (port 5432)      ← Alembic-managed schema
Keycloak (port 8080)        ← JWT issuer (optional when AUTH_ENABLED=false)
```
