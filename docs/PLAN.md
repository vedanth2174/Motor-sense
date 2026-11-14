# MotorSense — Restructure & Deployment Plan

*Build plan for Claude Code / Antigravity: from partial prototype to a deployable, authenticated, AI-assisted IoT system running on minikube.*

## 1. Decisions at a glance

| Question | Decision | Why |
| --- | --- | --- |
| Database | **PostgreSQL 16** (Alembic migrations). TimescaleDB image is an optional drop-in upgrade later. | SQLite breaks with multiple containers/pods. Postgres is the standard answer, works the same in Compose and Kubernetes, and Keycloak can use it too (separate database). |
| Auth for humans | **Keycloak** (OIDC, Authorization Code + PKCE) | Good choice. Gives realms, roles, login UI, token refresh. React uses `keycloak-js`; FastAPI only *validates* JWTs. |
| Auth for the ESP32 | **Per-device API key** (`X-API-Key`, stored hashed) | Do not put OIDC on a microcontroller. Keys are simple, revocable, and easy to explain in the viva. |
| Anomaly detection | **Hybrid**: threshold rules + statistical baseline + Isolation Forest for scoring, **LLM for explanation** | LLMs are weak at per-reading numeric detection (slow, non-deterministic, costly). They are excellent at turning scores and trends into a diagnosis and recommended actions. |
| LLM provider | **Pluggable**: Ollama (local, default) or OpenRouter (cloud), both through the OpenAI-compatible `/v1/chat/completions` API | One client, switch with an env var. |
| Realtime | **Server-Sent Events (SSE)**, polling as fallback | Simpler than WebSocket, works through ingress with no extra config, enough for one-way sensor push. |
| K8s packaging | **Kustomize** (base + `overlays/minikube`) | Less ceremony than Helm. A Helm chart can be a stretch goal. |
| Ingress | **ingress-nginx** minikube addon | Replaces the Nginx reverse-proxy box in the old diagram. |

### Can we skip the ML model and use only an LLM?

You *can*, but I would not drop ML entirely. Reasons:

- **Reproducibility**: an examiner can ask "what is your accuracy?" An Isolation Forest evaluated on injected faults gives you a number. An LLM-only classifier gives you vibes.
- **Latency and cost**: sensors post every few seconds. A scikit-learn model scores in microseconds; a 7B local model takes seconds per call.
- **Safety**: hard limits (over-current, over-temperature) must be deterministic rules, never LLM output.

The best final-year story is the **layered pipeline**: rules catch hard faults, the ML baseline catches unusual combinations, and the LLM explains *why it matters and what to do*. If time runs out, the ML layer can shrink to simple z-scores against the learned baseline, and you still keep the LLM layer. Skip nothing silently; make each layer switchable by config.

## 2. Target architecture

```
                     ┌──────────────────────── minikube ────────────────────────┐
 ESP32 ──HTTP POST──►│                                                           │
 (X-API-Key)         │   ingress-nginx  (motorsense.local, auth.motorsense.local)│
                     │     │ /api/*         │ /              │ auth host         │
 Browser ───────────►│     ▼                ▼                ▼                   │
                     │  FastAPI (backend)  React SPA (nginx)  Keycloak           │
                     │     │   │   │                            │                │
                     │     │   │   └──► /models PVC             │                │
                     │     ▼   └──────► Ollama (host) / OpenRouter                │
                     │  PostgreSQL ◄───────────────────────────┘ (own database)  │
                     └───────────────────────────────────────────────────────────┘
```

**Request flows**

1. **Ingest**: ESP32 → `POST /api/v1/ingest` with API key → validate → store → score (rules + baseline) → create alert if needed → push to SSE subscribers.
2. **Dashboard**: React logs in via Keycloak → gets JWT → calls `/api/v1/*` with `Authorization: Bearer` → backend validates signature, issuer, expiry and roles.
3. **AI analysis**: user clicks "Analyze" (or an alert fires) → backend builds a compact summary of the last window → calls the LLM → stores the result in `ai_analyses` → returns it.

## 3. Repository layout

```
motorsense/
├── CLAUDE.md                  # agent rules (see section 12; copy to AGENTS.md too)
├── README.md
├── Makefile                   # make up / down / test / lint / k8s-up / k8s-down
├── .env.example
├── docker-compose.yml         # dev: postgres, keycloak, backend, frontend, simulator
├── backend/
│   ├── app/
│   │   ├── main.py            # thin app factory, router includes, lifespan
│   │   ├── core/              # config.py (pydantic-settings), security.py, logging.py
│   │   ├── db/                # session.py, base.py
│   │   ├── models/            # one file per table
│   │   ├── schemas/           # pydantic models
│   │   ├── api/v1/            # ingest, sensors, machines, devices, alerts,
│   │   │                      # analysis, maintenance, stream, health
│   │   ├── services/          # business logic (routes stay thin)
│   │   │   ├── ingestion.py, validation.py, rules.py
│   │   │   ├── baseline.py, training.py, scoring.py
│   │   │   └── llm/           # base.py, ollama.py, openrouter.py, prompts.py
│   │   └── events.py          # in-process SSE broadcaster
│   ├── alembic/ + alembic.ini
│   ├── tests/                 # pytest: unit + API tests (testcontainers or sqlite-free fixtures)
│   ├── scripts/               # migrate_sqlite_to_pg.py, seed.py
│   ├── Dockerfile             # multi-stage, non-root
│   └── pyproject.toml or requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/               # client.ts (fetch wrapper + token), types.ts
│   │   ├── auth/              # keycloak.ts, AuthProvider.tsx, ProtectedRoute.tsx
│   │   ├── hooks/             # useSensorStream.ts, useMachines.ts, useAnalysis.ts
│   │   ├── components/        # SensorCard, TrendChart, AlertBanner, Sidebar, ...
│   │   ├── pages/             # Dashboard, LiveMonitoring, MotorHealth,
│   │   │                      # AiAnalysis, History, Maintenance, Machines, Devices
│   │   └── App.tsx, main.tsx
│   ├── public/config.js       # runtime config (API base, Keycloak URL) - NOT baked at build
│   ├── Dockerfile             # node build -> nginx
│   └── nginx.conf             # SPA fallback + config.js templating
├── simulator/
│   ├── simulate.py            # fake ESP32 with healthy + fault modes
│   └── Dockerfile
├── esp32/                     # firmware sketch updated for API key + HTTPS-ready
├── keycloak/
│   └── motorsense-realm.json  # exported realm: clients, roles, demo users
├── k8s/
│   ├── base/                  # namespace, deployments, services, configmaps, pvc
│   └── overlays/minikube/     # ingress, secrets (dev only), image tags, resource limits
├── .github/workflows/ci.yml   # lint + test + build images
└── docs/                      # architecture, API, report material, demo script
```

## 4. Backend plan

### Stack

FastAPI, SQLAlchemy 2.0, Alembic, pydantic-settings, PyJWT (with JWKS), httpx, scikit-learn, joblib, `prometheus-fastapi-instrumentator`, pytest.

### Configuration (all through env vars, no hardcoded paths or URLs)

| Variable | Example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://motor:***@postgres:5432/motorsense` | DB connection |
| `CORS_ORIGINS` | `http://localhost:5173,http://motorsense.local` | Comma-separated list |
| `OIDC_ISSUER` | `http://auth.motorsense.local/realms/motorsense` | Must equal the `iss` claim in tokens exactly |
| `OIDC_JWKS_URL` | `http://keycloak:8080/realms/motorsense/protocol/openid-connect/certs` | Internal URL used by the backend to fetch keys |
| `OIDC_AUDIENCE` | `motorsense-api` | Expected audience |
| `MODEL_DIR` | `/models` | Persisted baseline models (PVC in K8s) |
| `LLM_PROVIDER` | `ollama` or `openrouter` or `none` | Switch provider |
| `LLM_BASE_URL` | `http://host.docker.internal:11434/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `qwen2.5:7b` | Model name |
| `LLM_API_KEY` | (OpenRouter key; blank for Ollama) | Secret |
| `BASELINE_MIN_SAMPLES` | `500` | Readings before training |

### Database schema (v2)

Users live in Keycloak, not in your DB.

- `machines`: id, machine\_id (unique), name, type, rated\_voltage, rated\_current, rated\_temp\_max, location, learning\_status
- `devices`: id, machine\_id FK, name, api\_key\_hash, last\_seen\_at, is\_active
- `sensor_readings`: id, machine\_id FK, temperature, humidity, current, voltage, vibration, condition, anomaly\_score, is\_valid, recorded\_at. **Index on (machine\_id, recorded\_at DESC).**
- `machine_baselines`: id, machine\_id FK, status, sample\_count, model\_version, model\_path, metrics JSON, trained\_at
- `alerts`: id, machine\_id FK, severity (info/warning/critical), source (rule/ml), message, reading\_id FK, acknowledged\_by, acknowledged\_at, created\_at
- `ai_analyses`: id, machine\_id FK, window\_start, window\_end, provider, model, input\_summary JSON, output JSON, latency\_ms, created\_at
- `maintenance_records`: id, machine\_id FK, description, status, scheduled\_for, completed\_at, created\_by, created\_at

Alembic owns the schema. Add `scripts/migrate_sqlite_to_pg.py` to carry over `motor_data_backup.db`.

### API (v1, all under `/api/v1`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/ingest` | Device API key | ESP32 posts a reading |
| GET | `/machines`, POST `/machines` | viewer / admin | List and register machines |
| GET | `/machines/{id}/readings?from=&to=&limit=` | viewer | History with time range |
| GET | `/machines/{id}/latest` | viewer | Latest reading + health state |
| GET | `/machines/{id}/baseline` | viewer | Learning progress and baseline status |
| POST | `/machines/{id}/baseline/approve` | engineer | Human approves collected data |
| POST | `/machines/{id}/baseline/train` | engineer | Train now (also auto-trigger at threshold + approval) |
| POST | `/machines/{id}/predict` | viewer | Score the latest window (rules + ML) |
| POST | `/machines/{id}/analyze` | engineer | LLM diagnosis of recent window |
| GET | `/machines/{id}/analyses` | viewer | Past analyses |
| GET | `/alerts`, POST `/alerts/{id}/ack` | viewer / engineer | Alert list and acknowledge |
| GET/POST | `/maintenance` | viewer / engineer | Maintenance log |
| POST | `/machines/{id}/devices` | admin | Create device, returns the API key **once** |
| GET | `/stream/{machine_id}` | viewer | SSE live readings and alerts |
| GET | `/health/live`, `/health/ready` | none | Kubernetes probes (ready checks DB) |
| GET | `/metrics` | none (cluster-internal) | Prometheus metrics |

### Detection pipeline (`services/scoring.py`)

1. **Validation** (existing `validation.py`): reject NaN, out-of-physical-range values, mark `is_valid=false`.
2. **Rules** (`rules.py`): current > 110% of rated, voltage outside ±10%, temperature over limit, vibration over limit → `critical` alert immediately. Deterministic, no model needed.
3. **Baseline score** (`baseline.py`): Isolation Forest trained on approved valid readings, features = the 5 sensors plus short rolling mean/std. Saved with `joblib` to `MODEL_DIR/{machine_id}/{version}.joblib` and recorded in `machine_baselines`. Loaded once at startup and cached; reloaded on new version.
4. **Condition label**: combine rule result + anomaly score into `normal / warning / critical`. Drop the Decision Tree reference in the UI unless you actually build it; an honest three-state output is better than a fake model.
5. **LLM analysis** (`services/llm`): only on demand or when a critical alert fires. Never in the ingest hot path.

### LLM layer

- One interface: `LLMProvider.complete(system, user, json_schema) -> dict`. Ollama and OpenRouter both implement it through `httpx` against `/v1/chat/completions`.
- **Input to the LLM is a compact summary, not raw rows**: per-sensor min/mean/max/trend over the window, current anomaly score, active alerts, rated values, last maintenance entries. Keeps prompts under \~1k tokens, which small local models handle well.
- **Output is forced JSON**: `{ "summary": str, "likely_causes": [str], "severity": "low|medium|high", "recommended_actions": [str], "confidence": "low|medium|high" }`. Validate with Pydantic; retry once on invalid JSON.
- System prompt must state: use only the supplied numbers, say "insufficient data" when unsure, never override rule-based alerts.
- Timeouts (30 s local, 60 s cloud), graceful fallback: if the LLM is unreachable, return the rule/ML result plus `"ai_available": false`. The system must work with `LLM_PROVIDER=none`.
- Optional stretch: "Ask MotorSense" chat that answers questions about a machine from the same summary.

**Ollama vs OpenRouter**: Ollama is free, private, offline, and perfect for demos without internet, but needs RAM (7B ≈ 8 GB; use `llama3.2:3b` or `qwen2.5:3b` on weaker laptops). OpenRouter gives access to stronger models for cents per call; good for the final demo if internet is reliable. Keep both wired.

## 5. Auth plan with Keycloak

### Realm design

- Realm: `motorsense`
- Roles: `admin` (everything), `engineer` (acknowledge alerts, train, analyze, maintenance), `viewer` (read only)
- Clients:
  - `motorsense-web`: **public** client, Standard flow + PKCE (S256), redirect URIs `http://localhost:5173/*` and `http://motorsense.local/*`, web origins the same.
  - `motorsense-api`: only used as the audience (add an audience mapper to `motorsense-web` so tokens carry `aud: motorsense-api`). The backend never logs in; it just verifies tokens.
- Demo users: `admin1`, `engineer1`, `viewer1` with known dev passwords (documented in README, dev only).
- Export the realm to `keycloak/motorsense-realm.json` and start Keycloak with `--import-realm` so every environment is reproducible.

### Frontend

- `keycloak-js` with `onLoad: 'check-sso'` or `login-required`, PKCE S256. Wrap the app in `AuthProvider`, protect routes with `ProtectedRoute`, hide buttons by role (UI only; real enforcement is in the backend).
- `api/client.ts` attaches `Bearer` token and calls `keycloak.updateToken(30)` before each request.
- Keycloak URL, realm and client ID come from `window.__CONFIG__` (`public/config.js`), so one image works in Compose and Kubernetes.

### Backend

- `core/security.py`: dependency `get_current_user` that decodes the JWT with PyJWT using a cached `PyJWKClient(OIDC_JWKS_URL)`, checks `iss == OIDC_ISSUER`, `aud`, `exp`, and extracts roles from `realm_access.roles`.
- `require_role("engineer")` dependency factory for route-level protection.
- Device ingest uses a separate dependency validating `X-API-Key` against `devices.api_key_hash` (SHA-256 is fine for high-entropy random keys).

### The gotcha that eats everyone's time: issuer mismatch

The browser reaches Keycloak at one URL (`http://localhost:8080` in Compose, `http://auth.motorsense.local` in minikube), but the backend reaches it at another (`http://keycloak:8080`). Tokens carry the **browser-facing** URL as `iss`. So:

- Set `KC_HOSTNAME` (Keycloak 26: `KC_HOSTNAME=http://localhost:8080` or the ingress host) so issued tokens use the public URL.
- Backend validates `iss` against `OIDC_ISSUER` (public URL) but fetches keys from `OIDC_JWKS_URL` (internal URL). That is exactly why they are two separate variables.
- Use `start-dev` for local work, with `KC_HTTP_ENABLED=true` and `KC_PROXY_HEADERS=xforwarded` behind ingress. Mention in the report that production would use `start` with TLS and a real hostname.

## 6. Frontend plan

- Stack: React 19, Vite, TypeScript, Tailwind, `react-router`, TanStack Query for fetching/cache, Recharts for charts, `keycloak-js`.
- Break the 1510-line `App.tsx` into the pages and components in section 3. Keep the existing visual design; extract before redesigning.
- Remove every hardcoded URL and every hardcoded `MOTOR_001`: a machine selector in the header drives all pages.
- `useSensorStream` opens `EventSource` to `/api/v1/stream/{machine}`. Since `EventSource` cannot set headers, use `fetch` streaming or a short-lived stream token (`POST /stream-token`) instead of putting the JWT in a URL. Fall back to 5 s polling if the stream drops.
- New pages: **AI Analysis** (button, loading state, structured result card, history), **Alerts** (list + acknowledge), **Devices** (admin: create device, show key once).
- Maintenance table fetches from the API; delete seed data.
- Dockerfile: multi-stage (`node:22-alpine` build → `nginx:alpine`). `nginx.conf` serves the SPA with `try_files ... /index.html`, and an entrypoint writes `config.js` from env vars at container start.

## 7. Docker Compose (dev)

Services: `postgres` (with healthcheck, named volume), `keycloak` (imports realm, own DB `keycloak` on the same Postgres, or its own dev DB), `backend` (runs `alembic upgrade head` then uvicorn; depends on healthy postgres), `frontend`, `simulator` (profile `demo`).

Rules for the agent: healthchecks on every service, named volumes, a single `.env`, no secrets committed, `docker compose up` must give a working login-to-dashboard flow with simulator data. For Ollama, run it **on the host** and point `LLM_BASE_URL` at `host.docker.internal` (add `extra_hosts: ["host.docker.internal:host-gateway"]` on Linux).

Backend Dockerfile: multi-stage, `python:3.12-slim`, non-root user, `HEALTHCHECK` hitting `/health/live`.

## 8. Kubernetes on minikube

### Manifests (`k8s/base`, Kustomize)

| Resource | Notes |
| --- | --- |
| `Namespace motorsense` | everything lives here |
| `StatefulSet postgres` + `PVC` + `Service` | single replica; init script creates the `keycloak` database |
| `Deployment keycloak` + `Service` + ConfigMap with realm JSON | args `start-dev --import-realm`; readiness on `/health/ready` (enable `KC_HEALTH_ENABLED=true`) |
| `Deployment backend` + `Service` | env from ConfigMap/Secret; liveness `/health/live`, readiness `/health/ready`; PVC mounted at `/models`; run Alembic as an **init container** or a Kubernetes `Job` |
| `Deployment frontend` + `Service` | env for runtime `config.js` |
| `PVC models` | shared model storage |
| `Ingress` | host rules, see below |
| Optional: `CronJob simulator`, `Deployment simulator` | demo data in-cluster |

Set resource requests/limits on everything (small values; Keycloak needs \~512 Mi to be comfortable). Keep `backend` at `replicas: 1` at first: the in-process SSE broadcaster only reaches clients on the same pod. To scale later, move fan-out to Postgres `LISTEN/NOTIFY` or Redis pub/sub and call that out as future work.

### Step by step

```bash
# 1. Start the cluster (give it room; Keycloak + Postgres + app is not tiny)
minikube start --cpus=4 --memory=6144 --driver=docker
minikube addons enable ingress
minikube addons enable metrics-server

# 2. Build images straight into minikube's Docker daemon (no registry needed)
eval $(minikube docker-env)
docker build -t motorsense-backend:dev  ./backend
docker build -t motorsense-frontend:dev ./frontend
#   (alternative: minikube image load motorsense-backend:dev)
#   Use imagePullPolicy: IfNotPresent in manifests, never :latest

# 3. Deploy
kubectl apply -k k8s/overlays/minikube
kubectl -n motorsense get pods -w

# 4. Hostnames
#    Linux with docker driver: echo "$(minikube ip) motorsense.local auth.motorsense.local" | sudo tee -a /etc/hosts
#    macOS/Windows with docker driver: run `minikube tunnel` (keeps a terminal open)
#    and map both hosts to 127.0.0.1 in your hosts file

# 5. Verify
curl http://motorsense.local/api/v1/health/ready
# open http://motorsense.local and log in as viewer1

# 6. Feed it data
kubectl -n motorsense create job --from=cronjob/simulator sim-now   # or run simulate.py on the host
```

**Ingress rules**: host `motorsense.local` → path `/api` to backend, `/` to frontend; host `auth.motorsense.local` → keycloak. Keeping Keycloak on its own host avoids path-prefix headaches (`KC_HTTP_RELATIVE_PATH`). The ESP32 posts to `http://motorsense.local/api/v1/ingest` over your LAN only if the host's IP is reachable; for demos the simulator is the reliable path.

**Ollama with minikube**: don't run Ollama inside the cluster (RAM, GPU, model downloads). Run it on the host and set `LLM_BASE_URL=http://host.minikube.internal:11434/v1`. On Linux, start Ollama with `OLLAMA_HOST=0.0.0.0` so the cluster can reach it. Or use OpenRouter and skip this entirely.

**Secrets**: dev-only secrets in `overlays/minikube` generated with `kubectl create secret ... --dry-run=client -o yaml` or Kustomize `secretGenerator` from a git-ignored `.env`. State clearly in the report that production would use an external secrets manager.

**Troubleshooting checklist** for the README: `kubectl describe pod`, `kubectl logs`, `ImagePullBackOff` (you built into the wrong Docker daemon: rerun `eval $(minikube docker-env)`), ingress 404 (check host header and `kubectl get ingress`), Keycloak redirect loops (issuer/hostname mismatch, section 5).

## 9. Build phases for the agent

Work phase by phase. Each phase ends with a working, committed state and its acceptance checks passing. Do not start a phase until the previous one is green.

### Phase 0: Baseline and safety net (0.5 day)

- Initialise git, add `.gitignore`, move current code in place, commit as-is.
- Add `CLAUDE.md`, `Makefile`, `.env.example`.
- Run the current app once; write down what actually works. Add a smoke test script that posts one reading and reads it back.

### Phase 1: Backend restructure (2–3 days)

- Split `main.py` into routers/services; move to env-based config; versioned `/api/v1`.
- Postgres + Alembic; write SQLAlchemy models for the v2 schema; SQLite→Postgres migration script.
- Health probes, structured logging, `/metrics`.
- Tests: ingest, validation, machines, readings.
- **Accept**: `pytest` green; app runs against Postgres; old endpoints behaviour preserved under new paths.

### Phase 2: Detection pipeline (2–3 days)

- Rules engine, baseline training and persistence, scoring on ingest, auto-train after approval + 500 samples, real `/predict`.
- Alerts table and API.
- Simulator with modes: `healthy`, `overcurrent`, `overheat`, `vibration`, `drift`.
- Offline evaluation notebook/script: inject faults into held-out data and report precision/recall/F1. This is your report's results chapter.
- **Accept**: simulator in fault mode produces alerts; model file exists in `MODEL_DIR` and survives a restart.

### Phase 3: Auth with Keycloak (1–2 days)

- Keycloak in Compose with imported realm, roles, demo users.
- Backend JWT validation + role dependencies; device API keys.
- **Accept**: no token → 401; viewer calling an engineer route → 403; device key works on `/ingest` only.

### Phase 4: Frontend restructure (3–4 days)

- Extract components/pages/hooks, centralised API client, runtime config, auth provider, role-aware UI.
- SSE stream hook with polling fallback; real maintenance and alerts pages; machine selector.
- **Accept**: login → live dashboard updating from simulator → logout; no hardcoded URLs (`grep` for `localhost` returns only config defaults).

### Phase 5: LLM analysis (1–2 days)

- Provider interface, Ollama + OpenRouter implementations, summary builder, prompts, JSON validation, fallback, storage in `ai_analyses`, AI Analysis page.
- **Accept**: works with Ollama, works with OpenRouter, degrades cleanly with `LLM_PROVIDER=none`. Unit tests use a fake provider, never a real network call.

### Phase 6: Containerisation (1 day)

- Production-grade Dockerfiles, full Compose stack, healthchecks.
- **Accept**: from a fresh clone, `cp .env.example .env && docker compose up --build` gives a fully working system.

### Phase 7: Kubernetes on minikube (2 days)

- Kustomize base + minikube overlay, ingress, PVCs, probes, resource limits, init/migration job.
- `make k8s-up` and `make k8s-down` targets.
- **Accept**: section 8 step-by-step works on a clean minikube from scratch.

### Phase 8: Quality, CI, documentation (2–3 days)

- GitHub Actions: lint (ruff, eslint), tests, image builds.
- README with quickstart for Compose and minikube, architecture diagram, API docs (FastAPI `/docs`), screenshots, troubleshooting.
- Report material in `docs/` (section 11).

## 10. Improvements worth adding (ranked by value)

1. **Simulator + fault injection**: gives a repeatable demo and your evaluation data. Highest value per hour.
2. **Alert lifecycle** (open → acknowledged → resolved) with severity; optional email/Telegram notification through a webhook.
3. **Observability**: Prometheus metrics (`ingest_total`, `anomaly_score`, `llm_latency_seconds`) plus an optional Grafana dashboard in the cluster.
4. **Data retention**: downsample or purge raw readings after N days; mention TimescaleDB continuous aggregates as the scale-up path.
5. **Multi-machine support** end to end (the schema already allows it).
6. **Remaining Useful Life (RUL) trend**: a simple linear/exponential trend on vibration or temperature for "estimated time to threshold", which is more impressive than a label and cheap to build.
7. **Security hygiene**: rate limiting on ingest, request size limits, API-key rotation, HTTPS-ready ESP32 firmware (`WiFiClientSecure`).
8. **DevOps extras**: Helm chart, Argo CD or Terraform (kubernetes/helm providers) to deploy the minikube stack, Trivy image scan in CI.

## 11. Final-year project deliverables

- **Report outline**: introduction and problem statement; literature (predictive maintenance, anomaly detection, IoT protocols); requirements; architecture and design decisions (use section 1 as the "alternatives considered" table); implementation; testing and evaluation (unit tests, detection metrics, latency, LLM comparison between models); deployment; limitations; future work.
- **Evaluation to run**: detection precision/recall/F1 per fault type; ingest-to-dashboard latency; LLM analysis latency and a small human-rated quality check across 2–3 models (e.g. Ollama 3B vs 7B vs an OpenRouter model).
- **Demo script (7–8 minutes)**: healthy stream → inject overcurrent fault → alert fires → open AI analysis → acknowledge alert as engineer → show viewer account cannot acknowledge → show `kubectl get pods` proving it runs on Kubernetes.
- **Likely viva questions to prepare**: why Postgres over SQLite, why Keycloak and not hand-rolled JWT, why API keys for devices, why not LLM-only detection, what happens when the LLM is down, how you would scale ingest, how secrets are handled.

## 12. Instructions to put in `CLAUDE.md` / `AGENTS.md`

```
# MotorSense agent rules
- Read docs/PLAN.md first. Work one phase at a time; stop at each phase's acceptance checks.
- Before coding a phase, post a short plan (files to touch, commands to verify). After coding, run the tests and report results honestly, including failures.
- Never hardcode URLs, ports, credentials or paths. Everything via env vars / config.
- Backend: routes stay thin; logic in services/; every endpoint has Pydantic schemas and a test.
- Schema changes only through Alembic migrations.
- LLM output is never trusted for safety decisions; rules decide critical alerts.
- Tests must not call real LLMs or external networks; use fake providers.
- Do not commit secrets. .env is git-ignored; .env.example is kept current.
- Prefer small commits with clear messages, one logical change each.
- If a requirement is ambiguous or a plan decision looks wrong, ask before building around it.
- Keep README and docs/ in sync with what actually works.
```

**Prompt to kick off the agent** (paste after saving this document as `docs/PLAN.md`):

> Read docs/PLAN.md and CLAUDE.md. Start with Phase 0, then Phase 1. Before writing code, summarise your understanding of the current repo and propose the exact file moves. Stop after Phase 1's acceptance checks and show me the test output.

## 13. Risks and fallbacks

| Risk | Mitigation |
| --- | --- |
| Not enough real motor data | Simulator with fault modes; be upfront in the report that evaluation uses injected faults |
| Laptop too small for minikube + Ollama | Use OpenRouter for LLM, or a 3B model; start minikube with 4 CPUs / 6 GB and disable unused addons |
| Keycloak complexity eats time | Do Phase 3 early with a committed realm export; stub auth behind a flag (`AUTH_ENABLED=false`) only for local tests |
| Time runs short | Cut order: Helm/Terraform extras → Grafana → RUL → chat feature → SSE (keep polling). Never cut: Postgres, auth, rules + baseline, LLM analysis, Compose, minikube |
| Scope creep from the agent | Phase gates, acceptance checks, and the `CLAUDE.md` rule to stop and report |
