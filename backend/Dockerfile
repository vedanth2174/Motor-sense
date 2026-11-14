# Stage 1: Builder
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime
FROM python:3.12-slim AS runtime

WORKDIR /app

# Create non-root user
RUN groupadd -r motorsense && useradd -r -g motorsense motorsense

# Copy installed python packages from builder
COPY --from=builder /root/.local /home/motorsense/.local
ENV PATH=/home/motorsense/.local/bin:$PATH
ENV PYTHONPATH=/app

# Create models and data directories with proper permissions
RUN mkdir -p /models /data && chown -R motorsense:motorsense /models /data /app

# Copy application code
COPY --chown=motorsense:motorsense app/ ./app/
COPY --chown=motorsense:motorsense alembic/ ./alembic/
COPY --chown=motorsense:motorsense alembic.ini .

USER motorsense

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health/live')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
