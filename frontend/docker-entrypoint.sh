#!/bin/sh
set -e

# Generate config.js from environment variables
cat <<EOF > /usr/share/nginx/html/config.js
window.__CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL:-http://localhost:8000}",
  AUTH_ENABLED: ${AUTH_ENABLED:-false},
  KEYCLOAK_URL: "${KEYCLOAK_URL:-http://localhost:8080}",
  KEYCLOAK_REALM: "${KEYCLOAK_REALM:-motorsense}",
  KEYCLOAK_CLIENT_ID: "${KEYCLOAK_CLIENT_ID:-motorsense-web}"
};
EOF

echo "MotorSense runtime configuration initialized in /usr/share/nginx/html/config.js"

exec "$@"
