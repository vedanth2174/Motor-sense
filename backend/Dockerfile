# ── Stage 1: Wheel Builder (download pre-compiled wheels) ───────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

ENV PIP_NO_CACHE_DIR=1 \
    PIP_PREFER_BINARY=1 \
    PIP_DEFAULT_TIMEOUT=300

COPY requirements.txt .

# Downloads only official binary wheels for linux/amd64 directly to /build/wheels
RUN mkdir -p /build/wheels && \
    pip install --upgrade pip && \
    pip wheel --only-binary :all: --wheel-dir=/build/wheels -r requirements.txt

# ── Stage 2: Minimal Runtime ────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Create non-root application user
RUN groupadd -r motorsense && useradd -r -g motorsense motorsense

# Copy requirements and wheels from builder stage
COPY requirements.txt .
COPY --from=builder /build/wheels /tmp/wheels

# Install offline directly using requirements.txt (avoids wildcard version collisions)
RUN pip install --no-index --find-links=/tmp/wheels -r requirements.txt && \
    rm -rf /tmp/wheels requirements.txt

# Setup persistent storage directories
RUN mkdir -p /models /data && chown -R motorsense:motorsense /models /data /app

# Copy application source code
COPY --chown=motorsense:motorsense app/      ./app/
COPY --chown=motorsense:motorsense alembic/  ./alembic/
COPY --chown=motorsense:motorsense alembic.ini .

USER motorsense

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health/live')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
