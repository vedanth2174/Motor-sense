# ── Backend Dockerfile ──────────────────────────────────────────────────────
# Strategy: ZERO C compilation. Every package must come as a pre-built wheel.
# psycopg[binary] bundles its own libpq → no gcc/libpq-dev needed.
# numpy, scikit-learn, joblib all publish manylinux wheels for linux/amd64.
# --only-binary :all: makes pip FAIL (not fall back to source) if no wheel exists.
# ────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_PREFER_BINARY=1 \
    PIP_DEFAULT_TIMEOUT=300

WORKDIR /app

# Non-root user
RUN groupadd -r motorsense && useradd -r -g motorsense motorsense

# ── Step 1: heavy scientific stack (long, cached separately) ─────────────────
# Split into own layer so a code change doesn't re-download 300 MB of wheels.
RUN pip install --upgrade pip \
 && pip install --only-binary :all: \
        "numpy>=1.26.0,<2" \
        "scikit-learn>=1.4.0,<2" \
        "joblib>=1.3.2,<2"

# ── Step 2: remaining application dependencies ───────────────────────────────
COPY requirements.txt .
RUN pip install --only-binary :all: -r requirements.txt

# ── Step 3: persistent storage dirs ─────────────────────────────────────────
RUN mkdir -p /models /data \
    && chown -R motorsense:motorsense /models /data /app

# ── Step 4: application code ─────────────────────────────────────────────────
COPY --chown=motorsense:motorsense app/      ./app/
COPY --chown=motorsense:motorsense alembic/  ./alembic/
COPY --chown=motorsense:motorsense alembic.ini .

USER motorsense

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health/live')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
