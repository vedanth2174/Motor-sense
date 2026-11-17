import React, { useState } from "react"
import { useAuth, AppRole, isValidEmail } from "../auth/AuthContext"
import { Icon } from "./Icons"

export function AuthScreen() {
  const { loginWithCredentials, registerUser, login } = useAuth()
  const [tab, setTab] = useState<"signin" | "register">("signin")

  // Selected sign-in role
  const [selectedRole, setSelectedRole] = useState<AppRole>("admin")

  // Sign In inputs
  const [loginIdentifier, setLoginIdentifier] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState<string | null>(null)

  // Registration inputs
  const [regFullName, setRegFullName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regUsername, setRegUsername] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirmPassword, setRegConfirmPassword] = useState("")
  const [regRole, setRegRole] = useState<AppRole>("operator")
  const [regError, setRegError] = useState<string | null>(null)
  const [regSuccess, setRegSuccess] = useState<string | null>(null)

  // Email validation state
  const [emailTouched, setEmailTouched] = useState(false)
  const isEmailValid = regEmail.trim() === "" || isValidEmail(regEmail)

  // Handle Sign In submission
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)

    if (!loginIdentifier.trim()) {
      setLoginError("Please enter your username or registered email address.")
      return
    }

    if (!loginPassword) {
      setLoginError("Please enter your password.")
      return
    }

    // If identifier contains @, validate email format
    if (loginIdentifier.includes("@") && !isValidEmail(loginIdentifier)) {
      setLoginError("The entered email address format is invalid. Example: name@company.com")
      return
    }

    const res = loginWithCredentials(loginIdentifier, loginPassword, selectedRole)
    if (!res.success) {
      setLoginError(res.message || "Invalid credentials. Please verify and try again.")
    }
  }

  // Handle Account Registration
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()
    setRegError(null)
    setRegSuccess(null)

    if (!regFullName.trim()) {
      setRegError("Please enter your full name.")
      return
    }

    // Strict Email Validation
    if (!regEmail.trim()) {
      setRegError("Email address is required.")
      return
    }
    if (!isValidEmail(regEmail)) {
      setRegError("Please enter a valid email address with a domain (e.g. employee@factory.com).")
      return
    }

    if (!regUsername.trim() || regUsername.trim().length < 3) {
      setRegError("Username must be at least 3 alphanumeric characters.")
      return
    }

    if (!regPassword || regPassword.length < 6) {
      setRegError("Password must be at least 6 characters long.")
      return
    }

    if (regPassword !== regConfirmPassword) {
      setRegError("Passwords do not match. Please verify both fields.")
      return
    }

    const res = registerUser({
      fullName: regFullName,
      email: regEmail,
      username: regUsername,
      password: regPassword,
      role: regRole
    })

    if (!res.success) {
      setRegError(res.message || "Could not register account.")
    } else {
      setRegSuccess(`Account successfully created for ${regFullName}! Please sign in below.`)
      // Pre-fill sign-in fields
      setSelectedRole(regRole)
      setLoginIdentifier(regUsername)
      setLoginPassword("")
      // Switch back to Sign In after brief delay
      setTimeout(() => {
        setTab("signin")
      }, 1500)
    }
  }

  // Autofill helpers for testing default accounts
  const autofillDemo = (role: AppRole) => {
    setSelectedRole(role)
    if (role === "admin") {
      setLoginIdentifier("admin1")
      setLoginPassword("admin123")
    } else if (role === "operator") {
      setLoginIdentifier("operator1")
      setLoginPassword("operator123")
    } else if (role === "serviceman") {
      setLoginIdentifier("serviceman1")
      setLoginPassword("serviceman123")
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(ellipse at top, #0f1d38 0%, #060a14 70%)",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      padding: "24px"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "520px",
        background: "#0c1322",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        padding: "36px 32px",
        boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)"
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "26px" }}>
          <div style={{
            width: "52px",
            height: "52px",
            background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
            borderRadius: "10px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: "0 8px 16px -4px rgba(37, 99, 235, 0.5)",
            marginBottom: "12px"
          }}>
            <Icon name="motor" size={30} />
          </div>
          <h1 style={{ color: "#f8fafc", fontSize: "22px", fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.3px" }}>
            MotorSense
          </h1>
          <p style={{ color: "#64748b", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1.2px", margin: 0, fontWeight: 600 }}>
            Predictive Maintenance Systems
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "flex",
          background: "#070c17",
          border: "1px solid #1e293b",
          borderRadius: "8px",
          padding: "4px",
          marginBottom: "24px"
        }}>
          <button
            type="button"
            onClick={() => { setTab("signin"); setLoginError(null); }}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: tab === "signin" ? "#1e293b" : "transparent",
              color: tab === "signin" ? "#f8fafc" : "#94a3b8",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setRegError(null); setRegSuccess(null); }}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: tab === "register" ? "#1e293b" : "transparent",
              color: tab === "register" ? "#f8fafc" : "#94a3b8",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            Create Account
          </button>
        </div>

        {/* TAB 1: SIGN IN */}
        {tab === "signin" && (
          <div>
            {loginError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#f87171",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                marginBottom: "18px",
                lineHeight: 1.4
              }}>
                <strong>Authentication Failed:</strong> {loginError}
              </div>
            )}

            {regSuccess && (
              <div style={{
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "#34d399",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                marginBottom: "18px"
              }}>
                {regSuccess}
              </div>
            )}

            {/* 3 Role Selection Buttons */}
            <div style={{ marginBottom: "20px" }}>
              <span style={{
                display: "block",
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginBottom: "10px"
              }}>
                1. Select Your Role
              </span>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {/* 1. Admin */}
                <button
                  type="button"
                  onClick={() => setSelectedRole("admin")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "12px 8px",
                    background: selectedRole === "admin" ? "#1e293b" : "#070c17",
                    border: selectedRole === "admin" ? "2px solid #3b82f6" : "1px solid #1e293b",
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "center"
                  }}
                >
                  <strong style={{ color: selectedRole === "admin" ? "#60a5fa" : "#f8fafc", fontSize: "13px" }}>
                    Admin
                  </strong>
                  <span style={{ color: "#64748b", fontSize: "10px", marginTop: "3px" }}>Full Access</span>
                </button>

                {/* 2. Operator */}
                <button
                  type="button"
                  onClick={() => setSelectedRole("operator")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "12px 8px",
                    background: selectedRole === "operator" ? "#1e293b" : "#070c17",
                    border: selectedRole === "operator" ? "2px solid #10b981" : "1px solid #1e293b",
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "center"
                  }}
                >
                  <strong style={{ color: selectedRole === "operator" ? "#34d399" : "#f8fafc", fontSize: "13px" }}>
                    Operator
                  </strong>
                  <span style={{ color: "#64748b", fontSize: "10px", marginTop: "3px" }}>Monitoring</span>
                </button>

                {/* 3. Service Man */}
                <button
                  type="button"
                  onClick={() => setSelectedRole("serviceman")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "12px 8px",
                    background: selectedRole === "serviceman" ? "#1e293b" : "#070c17",
                    border: selectedRole === "serviceman" ? "2px solid #f59e0b" : "1px solid #1e293b",
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "center"
                  }}
                >
                  <strong style={{ color: selectedRole === "serviceman" ? "#fbbf24" : "#f8fafc", fontSize: "13px" }}>
                    Service Man
                  </strong>
                  <span style={{ color: "#64748b", fontSize: "10px", marginTop: "3px" }}>Maintenance</span>
                </button>
              </div>
            </div>

            {/* Role Header Banner */}
            <div style={{
              background: "#080e1b",
              border: "1px solid #1e293b",
              borderRadius: "6px",
              padding: "8px 12px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                Logging in as: <strong style={{
                  color: selectedRole === "admin" ? "#60a5fa" : selectedRole === "serviceman" ? "#fbbf24" : "#34d399",
                  textTransform: "uppercase"
                }}>
                  {selectedRole === "admin" ? "System Administrator" : selectedRole === "serviceman" ? "Service Man / Maintenance" : "Plant Floor Operator"}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => autofillDemo(selectedRole)}
                style={{
                  background: "#1e293b",
                  border: "none",
                  color: "#cbd5e1",
                  fontSize: "10px",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontWeight: 600
                }}
                title="Fill demo credentials"
              >
                Autofill Demo
              </button>
            </div>

            {/* Mandatory Credentials Form */}
            <form onSubmit={handleSignIn}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  2. Username or Valid Email Address *
                </label>
                <input
                  type="text"
                  placeholder={
                    selectedRole === "admin"
                      ? "e.g. admin1 or admin@motorsense.local"
                      : selectedRole === "serviceman"
                      ? "e.g. serviceman1 or engineer@motorsense.local"
                      : "e.g. operator1 or operator@motorsense.local"
                  }
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    background: "#070c17",
                    border: "1px solid #1e293b",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  3. Password *
                </label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    background: "#070c17",
                    border: "1px solid #1e293b",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: selectedRole === "admin" ? "#2563eb" : selectedRole === "serviceman" ? "#d97706" : "#059669",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)"
                }}
              >
                Sign In as {selectedRole === "admin" ? "Administrator" : selectedRole === "serviceman" ? "Service Man" : "Operator"}
              </button>
            </form>

            {/* Enterprise Keycloak Link */}
            <div style={{ marginTop: "18px", textAlign: "center" }}>
              <button
                type="button"
                onClick={login}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#60a5fa",
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline"
                }}
              >
                Sign in with Keycloak Enterprise SSO →
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: CREATE ACCOUNT */}
        {tab === "register" && (
          <form onSubmit={handleRegister}>
            {regError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#f87171",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                marginBottom: "16px",
                lineHeight: 1.4
              }}>
                <strong>Registration Error:</strong> {regError}
              </div>
            )}

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Vikram Sharma"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "#070c17",
                  border: "1px solid #1e293b",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {/* Validated Email Input */}
            <div style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>
                  Work Email Address *
                </label>
                {emailTouched && regEmail.trim() !== "" && (
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: isEmailValid ? "#34d399" : "#f87171"
                  }}>
                    {isEmailValid ? "✓ Valid Email" : "✗ Invalid Format"}
                  </span>
                )}
              </div>
              <input
                type="email"
                placeholder="e.g. vikram@plant.internal"
                value={regEmail}
                onBlur={() => setEmailTouched(true)}
                onChange={(e) => {
                  setRegEmail(e.target.value)
                  setEmailTouched(true)
                }}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "#070c17",
                  border: emailTouched && !isEmailValid ? "1px solid #ef4444" : "1px solid #1e293b",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
              {emailTouched && !isEmailValid && (
                <span style={{ color: "#f87171", fontSize: "11px", display: "block", marginTop: "4px" }}>
                  Please enter a valid email address with a domain (e.g. user@company.com).
                </span>
              )}
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                Username (at least 3 characters) *
              </label>
              <input
                type="text"
                placeholder="Choose a login username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "#070c17",
                  border: "1px solid #1e293b",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Password (6+ chars) *
                </label>
                <input
                  type="password"
                  placeholder="Password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "#070c17",
                    border: "1px solid #1e293b",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  placeholder="Confirm"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "#070c17",
                    border: "1px solid #1e293b",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            {/* Select Role */}
            <div style={{ marginBottom: "22px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                Select Role to Grant *
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <label style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "10px 6px",
                  background: regRole === "admin" ? "#1e293b" : "#070c17",
                  border: regRole === "admin" ? "1px solid #3b82f6" : "1px solid #1e293b",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "center"
                }}>
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={regRole === "admin"}
                    onChange={() => setRegRole("admin")}
                    style={{ display: "none" }}
                  />
                  <strong style={{ color: "#f8fafc", fontSize: "12px" }}>Admin</strong>
                  <span style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>Full Control</span>
                </label>

                <label style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "10px 6px",
                  background: regRole === "operator" ? "#1e293b" : "#070c17",
                  border: regRole === "operator" ? "1px solid #10b981" : "1px solid #1e293b",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "center"
                }}>
                  <input
                    type="radio"
                    name="role"
                    value="operator"
                    checked={regRole === "operator"}
                    onChange={() => setRegRole("operator")}
                    style={{ display: "none" }}
                  />
                  <strong style={{ color: "#f8fafc", fontSize: "12px" }}>Operator</strong>
                  <span style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>Monitoring</span>
                </label>

                <label style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "10px 6px",
                  background: regRole === "serviceman" ? "#1e293b" : "#070c17",
                  border: regRole === "serviceman" ? "1px solid #f59e0b" : "1px solid #1e293b",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "center"
                }}>
                  <input
                    type="radio"
                    name="role"
                    value="serviceman"
                    checked={regRole === "serviceman"}
                    onChange={() => setRegRole("serviceman")}
                    style={{ display: "none" }}
                  />
                  <strong style={{ color: "#f8fafc", fontSize: "12px" }}>Service Man</strong>
                  <span style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>Maintenance</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#10b981",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                transition: "background 0.15s ease"
              }}
            >
              Register & Validate Account
            </button>

            <div style={{ marginTop: "16px", textAlign: "center" }}>
              <span style={{ color: "#64748b", fontSize: "12px" }}>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setTab("signin")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#60a5fa",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0
                  }}
                >
                  Sign In here
                </button>
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
