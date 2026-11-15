# Minimal simulator image using distroless-like approach
FROM python:3.12-slim AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONMALLOC=malloc \
    PYTHONPYCACHEPREFIX=/tmp/pycache

# Create non-root user
RUN groupadd -r simulator && useradd -r -g simulator simulator

# Install only runtime dependencies (requests is a pure Python package, but may need certs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install requests
RUN pip install --no-cache-dir requests

COPY --chown=simulator:simulator simulate.py .

USER simulator

# Memory limit for the container
ENV PYTHONMEMORY_LIMIT=128M

CMD ["python", "simulate.py", "--mode", "healthy", "--interval", "3"]