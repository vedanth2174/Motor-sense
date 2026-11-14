// Keycloak OIDC client configuration
declare global {
  interface Window {
    __CONFIG__?: {
      API_BASE_URL?: string
      AUTH_ENABLED?: boolean
      KEYCLOAK_URL?: string
      KEYCLOAK_REALM?: string
      KEYCLOAK_CLIENT_ID?: string
    }
  }
}

export const getRuntimeConfig = () => {
  return {
    API_BASE_URL: window.__CONFIG__?.API_BASE_URL || "http://localhost:8000",
    AUTH_ENABLED: window.__CONFIG__?.AUTH_ENABLED ?? false,
    KEYCLOAK_URL: window.__CONFIG__?.KEYCLOAK_URL || "http://localhost:8080",
    KEYCLOAK_REALM: window.__CONFIG__?.KEYCLOAK_REALM || "motorsense",
    KEYCLOAK_CLIENT_ID: window.__CONFIG__?.KEYCLOAK_CLIENT_ID || "motorsense-web"
  }
}
