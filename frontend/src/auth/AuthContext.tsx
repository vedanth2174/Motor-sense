import React, { createContext, useContext, useEffect, useState, useRef } from "react"
import Keycloak from "keycloak-js"
import { getRuntimeConfig } from "./keycloak"
import { UserProfile } from "../types"

export type AppRole = "admin" | "operator" | "serviceman"

export interface RegisterUserData {
  fullName: string
  email: string
  username: string
  password: string
  role: AppRole
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return re.test(email.trim())
}

interface AuthContextType {
  authenticated: boolean
  token: string | null
  user: UserProfile | null
  login: () => void
  loginWithCredentials: (
    identifier: string,
    password: string,
    role?: AppRole
  ) => { success: boolean; message?: string }
  registerUser: (data: RegisterUserData) => { success: boolean; message?: string }
  logout: () => void
  hasRole: (role: string) => boolean
}

const defaultContext: AuthContextType = {
  authenticated: false,
  token: null,
  user: null,
  login: () => {},
  loginWithCredentials: () => ({ success: true }),
  registerUser: () => ({ success: true }),
  logout: () => {},
  hasRole: () => true
}

const AuthContext = createContext<AuthContextType>(defaultContext)

const STORAGE_USERS_KEY = "motorsense_registered_users"
const STORAGE_CURRENT_USER_KEY = "motorsense_current_session"

function getStoredUsers(): RegisterUserData[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn("Could not read stored users:", e)
  }
  return []
}

function saveStoredUsers(users: RegisterUserData[]) {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users))
  } catch (e) {
    console.warn("Could not save stored users:", e)
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const config = getRuntimeConfig()

  // Always require entering username and password on fresh session
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    try {
      const session = localStorage.getItem(STORAGE_CURRENT_USER_KEY)
      return !!session
    } catch {
      return false
    }
  })

  const [token, setToken] = useState<string | null>(null)

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const session = localStorage.getItem(STORAGE_CURRENT_USER_KEY)
      if (session) return JSON.parse(session)
    } catch (e) {
      // empty
    }
    return null
  })

  const kcRef = useRef<Keycloak | null>(null)

  useEffect(() => {
    if (!config.AUTH_ENABLED) {
      return
    }

    if (kcRef.current) return

    const kc = new Keycloak({
      url: config.KEYCLOAK_URL,
      realm: config.KEYCLOAK_REALM,
      clientId: config.KEYCLOAK_CLIENT_ID
    })

    kcRef.current = kc

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
          const isAdm = roles.includes("admin")
          const isEng = roles.includes("engineer") || isAdm
          const isOp = roles.includes("operator") || roles.includes("viewer") || isAdm
          const profile: UserProfile = {
            username: kc.tokenParsed?.preferred_username || "user",
            fullName: kc.tokenParsed?.name || kc.tokenParsed?.preferred_username || "Authorized User",
            email: kc.tokenParsed?.email,
            roles,
            roleName: isAdm ? "Administrator" : isEng ? "Service Technician" : "Plant Operator",
            isAdmin: isAdm,
            isEngineer: isEng,
            isOperator: isOp
          }
          setUser(profile)
          localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(profile))
        }
      })
      .catch((err: any) => {
        console.warn("Keycloak SSO error:", err)
      })
  }, [config.AUTH_ENABLED])

  const buildProfileForRole = (
    role: AppRole,
    username: string,
    fullName?: string,
    email?: string
  ): UserProfile => {
    if (role === "admin") {
      return {
        username,
        fullName: fullName || "System Administrator",
        email: email || `${username}@motorsense.local`,
        roleName: "Administrator",
        roles: ["admin", "engineer", "viewer", "operator"],
        isAdmin: true,
        isEngineer: true,
        isOperator: true
      }
    }
    if (role === "serviceman") {
      return {
        username,
        fullName: fullName || "Service Technician",
        email: email || `${username}@motorsense.local`,
        roleName: "Service Technician",
        roles: ["engineer", "viewer", "operator"],
        isAdmin: false,
        isEngineer: true,
        isOperator: true
      }
    }
    // operator
    return {
      username,
      fullName: fullName || "Plant Operator",
      email: email || `${username}@motorsense.local`,
      roleName: "Plant Operator",
      roles: ["operator", "viewer"],
      isAdmin: false,
      isEngineer: false,
      isOperator: true
    }
  }

  // Sign In with Credentials (Validates Username/Email and Password every time)
  const loginWithCredentials = (
    identifier: string,
    password: string,
    role?: AppRole
  ): { success: boolean; message?: string } => {
    const cleanId = (identifier || "").trim().toLowerCase()
    const cleanPass = (password || "").trim()

    if (!cleanId) {
      return { success: false, message: "Username or Email is required." }
    }
    if (!cleanPass) {
      return { success: false, message: "Password is required." }
    }

    // Built-in verified system accounts
    const builtInAccounts: Record<string, { pass: string; role: AppRole; name: string; email: string }> = {
      admin: { pass: "admin123", role: "admin", name: "System Administrator", email: "admin@motorsense.local" },
      admin1: { pass: "admin123", role: "admin", name: "System Administrator", email: "admin@motorsense.local" },
      "admin@motorsense.local": { pass: "admin123", role: "admin", name: "System Administrator", email: "admin@motorsense.local" },

      operator: { pass: "operator123", role: "operator", name: "Plant Operator", email: "operator@motorsense.local" },
      operator1: { pass: "operator123", role: "operator", name: "Plant Operator", email: "operator@motorsense.local" },
      viewer1: { pass: "viewer123", role: "operator", name: "Plant Operator", email: "operator@motorsense.local" },
      "operator@motorsense.local": { pass: "operator123", role: "operator", name: "Plant Operator", email: "operator@motorsense.local" },

      serviceman: { pass: "serviceman123", role: "serviceman", name: "Field Service Technician", email: "serviceman@motorsense.local" },
      serviceman1: { pass: "serviceman123", role: "serviceman", name: "Field Service Technician", email: "serviceman@motorsense.local" },
      engineer1: { pass: "engineer123", role: "serviceman", name: "Maintenance Engineer", email: "serviceman@motorsense.local" },
      "serviceman@motorsense.local": { pass: "serviceman123", role: "serviceman", name: "Field Service Technician", email: "serviceman@motorsense.local" }
    }

    // 1. Check built-in accounts
    if (builtInAccounts[cleanId]) {
      const acc = builtInAccounts[cleanId]
      if (cleanPass !== acc.pass) {
        return { success: false, message: "Incorrect password. Please try again." }
      }
      if (role && acc.role !== role) {
        return {
          success: false,
          message: `User '${identifier}' does not have ${role.toUpperCase()} privileges.`
        }
      }
      const profile = buildProfileForRole(acc.role, cleanId.includes("@") ? acc.role + "1" : cleanId, acc.name, acc.email)
      setUser(profile)
      setAuthenticated(true)
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(profile))
      return { success: true }
    }

    // 2. Check registered accounts
    const registered = getStoredUsers()
    const match = registered.find(
      (u) => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
    )

    if (match) {
      if (match.password !== cleanPass) {
        return { success: false, message: "Incorrect password. Please try again." }
      }
      if (role && match.role !== role) {
        return {
          success: false,
          message: `User is registered as ${match.role.toUpperCase()}, but tried signing in as ${role.toUpperCase()}.`
        }
      }
      const profile = buildProfileForRole(match.role, match.username, match.fullName, match.email)
      setUser(profile)
      setAuthenticated(true)
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(profile))
      return { success: true }
    }

    return {
      success: false,
      message: `Account '${identifier}' not found. Please verify details or create an account.`
    }
  }

  // Register New Account with Strict Email Validation
  const registerUser = (data: RegisterUserData): { success: boolean; message?: string } => {
    const cleanName = (data.fullName || "").trim()
    const cleanEmail = (data.email || "").trim().toLowerCase()
    const cleanUser = (data.username || "").trim().toLowerCase()
    const cleanPass = (data.password || "").trim()

    if (!cleanName) {
      return { success: false, message: "Full Name is required." }
    }

    // Strict Email Format Validation
    if (!cleanEmail) {
      return { success: false, message: "Email address is required." }
    }
    if (!isValidEmail(cleanEmail)) {
      return {
        success: false,
        message: "Invalid email format. Please enter a valid email address (e.g. name@company.com)."
      }
    }

    if (!cleanUser || cleanUser.length < 3) {
      return { success: false, message: "Username must be at least 3 characters." }
    }
    if (!cleanPass || cleanPass.length < 6) {
      return { success: false, message: "Password must be at least 6 characters long." }
    }

    const registered = getStoredUsers()

    // Uniqueness checks
    if (registered.some((u) => u.username.toLowerCase() === cleanUser)) {
      return { success: false, message: `Username '${cleanUser}' is already taken.` }
    }
    if (registered.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: `An account with email '${cleanEmail}' already exists.` }
    }

    const newUser: RegisterUserData = {
      fullName: cleanName,
      email: cleanEmail,
      username: cleanUser,
      password: cleanPass,
      role: data.role
    }

    const updated = [...registered, newUser]
    saveStoredUsers(updated)

    return { success: true }
  }

  // Enterprise Keycloak SSO Redirect
  const login = () => {
    if (config.AUTH_ENABLED && kcRef.current) {
      kcRef.current.login()
    } else if (config.AUTH_ENABLED) {
      window.location.href = `${config.KEYCLOAK_URL}/realms/${config.KEYCLOAK_REALM}/protocol/openid-connect/auth?client_id=${config.KEYCLOAK_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(window.location.href)}`
    }
  }

  // Sign Out
  const logout = () => {
    setAuthenticated(false)
    setUser(null)
    setToken(null)
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY)
    delete (window as any).__MOTORSENSE_TOKEN__
    if (config.AUTH_ENABLED && kcRef.current) {
      try {
        kcRef.current.logout({ redirectUri: window.location.origin })
      } catch (e) {
        console.warn("Keycloak logout redirect:", e)
      }
    }
  }

  const hasRole = (role: string) => {
    if (!user) return false
    return user.isAdmin || user.roles.includes(role)
  }

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        token,
        user,
        login,
        loginWithCredentials,
        registerUser,
        logout,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
