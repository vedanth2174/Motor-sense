import React from "react"
import { Icon } from "./Icons"
import { Page } from "../types"
import { useAuth } from "../auth/AuthContext"

export function Header({
  page,
  setSidebarOpen,
  isLive,
  lastUpdated,
  alertCount = 0,
  onNavigateToAlerts
}: {
  page: Page
  setSidebarOpen: (o: boolean) => void
  isLive: boolean
  lastUpdated: string
  alertCount?: number
  onNavigateToAlerts?: () => void
}) {
  const { user, logout } = useAuth()
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : "OP"

  return (
    <header className="topbar">
      <button
        className="mobile-menu"
        aria-label="Open menu"
        onClick={() => setSidebarOpen(true)}
      >
        <Icon name="menu" />
      </button>

      <div className="breadcrumb">
        <span>MotorSense</span>
        <Icon name="chevron" size={14} />
        <strong>{page}</strong>
      </div>

      <div className="top-actions">
        {alertCount > 0 && (
          <div
            className="top-alert-pill"
            onClick={onNavigateToAlerts}
            title={`${alertCount} unacknowledged alert(s). Click to review.`}
          >
            <i />
            <span>{alertCount} ACTIVE {alertCount === 1 ? "ALERT" : "ALERTS"}</span>
          </div>
        )}

        <div className={isLive ? "connection connected" : "connection preview"}>
          <i />
          {isLive ? "SYSTEM ONLINE" : "TELEMETRY PAUSED"}
        </div>

        <div className="top-time">
          <span>LAST TELEMETRY</span>
          <strong>{lastUpdated}</strong>
        </div>

        <div style={{ position: "relative" }}>
          <button
            className="icon-button"
            aria-label="Notifications"
            onClick={onNavigateToAlerts}
            title={alertCount > 0 ? `${alertCount} unread alerts` : "No active alerts"}
          >
            <Icon name="bell" size={16} />
            {alertCount > 0 && <i className="alert-badge" />}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#0c1424",
            border: "1px solid #1e293b",
            padding: "4px 10px 4px 6px",
            borderRadius: "6px"
          }}>
            <div className="avatar" title={`Signed in as ${user?.username || "operator"}`}>
              {initials}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#f8fafc", lineHeight: 1.2 }}>
                {user?.fullName || user?.username || "Operator"}
              </span>
              <span style={{
                fontSize: "10px",
                color: user?.isAdmin ? "#60a5fa" : user?.isEngineer ? "#fbbf24" : "#34d399",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                {user?.roleName || (user?.isAdmin ? "Administrator" : user?.isEngineer ? "Service Man" : "Operator")}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#cbd5e1",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "11px",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.15s ease"
            }}
            title="Sign out of MotorSense"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
