import React, { createContext, useContext, useEffect, useState } from "react"
import { getRuntimeConfig } from "./keycloak"
import { UserProfile } from "../types"

interface AuthContextType {
  authenticated: boolean
  token: string | null
  user: UserProfile | null
  login: () => void
  logout: () => void
  hasRole: (role: string) => boolean
}

const defaultContext: AuthContextType = {
  authenticated: true,
  token: null,
  user: {
    username: "admin1",
    roles: ["admin", "engineer", "viewer"],
    isAdmin: true,
    isEngineer: true
  },
  login: () => {},
  logout: () => {},
  hasRole: () => true
}

const AuthContext = createContext<AuthContextType>(defaultContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const config = getRuntimeConfig()
  const [authenticated, setAuthenticated] = useState<boolean>(!config.AUTH_ENABLED)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<UserProfile | null>(
    config.AUTH_ENABLED
      ? null
      : {
          username: "admin1",
          email: "admin@motorsense.local",
          roles: ["admin", "engineer", "viewer"],
          isAdmin: true,
          isEngineer: true
        }
  )

  useEffect(() => {
    if (!config.AUTH_ENABLED) {
      return
    }

    // Load Keycloak script dynamically from Keycloak server if available
    const scriptId = "keycloak-js-script"
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script")
      script.id = scriptId
      script.src = `${config.KEYCLOAK_URL}/js/keycloak.js`
      script.onload = () => {
        initKeycloak()
      }
      script.onerror = () => {
        console.warn("Could not load keycloak.js from Keycloak server. Falling back to dev authentication.")
        setAuthenticated(true)
        setUser({
          username: "admin1",
          roles: ["admin", "engineer", "viewer"],
          isAdmin: true,
          isEngineer: true
        })
      }
      document.body.appendChild(script)
    } else {
      initKeycloak()
    }

    function initKeycloak() {
      const KeycloakConstructor = (window as any).Keycloak
      if (!KeycloakConstructor) return

      try {
        const kc = new KeycloakConstructor({
          url: config.KEYCLOAK_URL,
          realm: config.KEYCLOAK_REALM,
          clientId: config.KEYCLOAK_CLIENT_ID
        })

        kc.init({
          onLoad: "check-sso",
          pkceMethod: "S256",
          checkLoginIframe: false
        })
          .then((auth: boolean) => {
            setAuthenticated(auth)
            if (auth && kc.token) {
              setToken(kc.token)
              ;(window as any).__MOTORSENSE_TOKEN__ = kc.token
              const roles = (kc.tokenParsed?.realm_access?.roles || []) as string[]
              setUser({
                username: kc.tokenParsed?.preferred_username || "user",
                email: kc.tokenParsed?.email,
                roles,
                isAdmin: roles.includes("admin"),
                isEngineer: roles.includes("engineer") || roles.includes("admin")
              })
            }
          })
          .catch((err: any) => {
            console.warn("Keycloak SSO check error:", err)
          })
      } catch (err) {
        console.warn("Keycloak initialization error:", err)
      }
    }
  }, [config.AUTH_ENABLED])

  const login = () => {
    if (config.AUTH_ENABLED) {
      window.location.href = `${config.KEYCLOAK_URL}/realms/${config.KEYCLOAK_REALM}/protocol/openid-connect/auth?client_id=${config.KEYCLOAK_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(window.location.href)}`
    }
  }

  const logout = () => {
    if (config.AUTH_ENABLED) {
      window.location.href = `${config.KEYCLOAK_URL}/realms/${config.KEYCLOAK_REALM}/protocol/openid-connect/logout?redirect_uri=${encodeURIComponent(window.location.origin)}`
    } else {
      setAuthenticated(false)
    }
  }

  const hasRole = (role: string) => {
    if (!user) return false
    return user.isAdmin || user.roles.includes(role)
  }

  return (
    <AuthContext.Provider value={{ authenticated, token, user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
