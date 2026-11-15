import React from "react"
import { Icon, IconName } from "./Icons"
import { Page, Machine } from "../types"
import { useAuth } from "../auth/AuthContext"

interface NavItem {
  label: Page
  icon: IconName
  section?: string
  role?: string
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: "grid", section: "MONITORING" },
  { label: "Live Monitoring", icon: "pulse" },
  { label: "Motor Health", icon: "heart" },
  { label: "Prediction", icon: "brain" },
  { label: "AI Diagnostics", icon: "cpu" },
  { label: "Alerts", icon: "alert-triangle", section: "OPERATIONS" },
  { label: "Maintenance Records", icon: "wrench" },
  { label: "History", icon: "clock" },
  { label: "Machines & Devices", icon: "shield", section: "MANAGEMENT", role: "admin" },
  { label: "Data Export", icon: "download" }
]

export function Sidebar({
  page,
  setPage,
  sidebarOpen,
  setSidebarOpen,
  machines,
  selectedMachineId,
  setSelectedMachineId,
  isLive,
  alertCount = 0
}: {
  page: Page
  setPage: (p: Page) => void
  sidebarOpen: boolean
  setSidebarOpen: (o: boolean) => void
  machines: Machine[]
  selectedMachineId: string
  setSelectedMachineId: (id: string) => void
  isLive: boolean
  alertCount?: number
}) {
  const { user, hasRole, logout } = useAuth()
  const activeMachine = machines.find((m) => m.machine_id === selectedMachineId) || machines[0]

  return (
    <>
      <aside className={sidebarOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">
            <Icon name="motor" size={22} />
          </div>
          <div>
            <strong>MotorSense</strong>
            <span>PREDICTIVE SYSTEMS</span>
          </div>
        </div>

        {/* Machine Asset Selector */}
        <div className="plant-selector">
          <span>ACTIVE ASSET</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="asset-icon">
              <Icon name="motor" size={16} />
            </div>
            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              style={{
                background: "transparent",
                color: "#f8fafc",
                border: "none",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                width: "100%",
                outline: "none"
              }}
            >
              {machines.map((m) => (
                <option key={m.machine_id} value={m.machine_id} style={{ background: "#0e1626", color: "#f8fafc" }}>
                  {m.name || m.machine_id} ({m.machine_id})
                </option>
              ))}
            </select>
          </div>
          {activeMachine && (
            <small style={{ color: "#94a3b8", display: "block", marginTop: "4px" }}>
              {activeMachine.location || "Production Floor"} · {activeMachine.type}
            </small>
          )}
        </div>

        {/* Navigation */}
        <nav>
          {navItems.map((item) => {
            if (item.role && !hasRole(item.role)) return null
            const isAlertItem = item.label === "Alerts"
            return (
              <div key={item.label}>
                {item.section && <span className="nav-title">{item.section}</span>}
                <button
                  className={page === item.label ? "nav-item active" : "nav-item"}
                  onClick={() => {
                    setPage(item.label)
                    setSidebarOpen(false)
                  }}
                >
                  <Icon name={item.icon} size={16} />
                  <span>{item.label}</span>
                  {item.label === "Live Monitoring" && isLive && <i className="live-dot" />}
                  {isAlertItem && alertCount > 0 && (
                    <span className="nav-alert-badge">{alertCount}</span>
                  )}
                </button>
              </div>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="esp-status">
            <span className={isLive ? "status-icon connected" : "status-icon"}>
              <Icon name="wifi" size={16} />
            </span>
            <div>
              <strong>ESP32 {isLive ? "Online" : "Offline"}</strong>
              <small>{selectedMachineId} · {isLive ? "Telemetry Active" : "Waiting for Stream"}</small>
            </div>
          </div>
          <div className="version" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>v2.1 Enterprise</span>
            {user && (
              <button
                onClick={logout}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  fontSize: "9px",
                  cursor: "pointer",
                  padding: "2px 4px"
                }}
                title="Sign out of MotorSense"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  )
}
