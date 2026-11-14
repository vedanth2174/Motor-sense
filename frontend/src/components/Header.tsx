import React from "react"
import { Icon } from "./Icons"
import { Page } from "../types"
import { useAuth } from "../auth/AuthContext"

export function Header({
  page,
  setSidebarOpen,
  isLive,
  lastUpdated,
  alertCount = 0
}: {
  page: Page
  setSidebarOpen: (o: boolean) => void
  isLive: boolean
  lastUpdated: string
  alertCount?: number
}) {
  const { user } = useAuth()
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
        <div className={isLive ? "connection connected" : "connection preview"}>
          <i />
          {isLive ? "SYSTEM ONLINE" : "TELEMETRY PAUSED"}
        </div>
        <div className="top-time">
          <span>LAST TELEMETRY</span>
          <strong>{lastUpdated}</strong>
        </div>
        <div style={{ position: "relative" }}>
          <button className="icon-button" aria-label="Notifications">
            <Icon name="bell" />
            {alertCount > 0 && <i style={{ background: "#ef4444" }} />}
          </button>
        </div>
        <div className="avatar" title={`Signed in as ${user?.username} (${user?.roles?.join(", ")})`}>
          {initials}
        </div>
      </div>
    </header>
  )
}
