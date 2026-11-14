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
  isLive
}: {
  page: Page
  setPage: (p: Page) => void
  sidebarOpen: boolean
  setSidebarOpen: (o: boolean) => void
  machines: Machine[]
  selectedMachineId: string
  setSelectedMachineId: (id: string) => void
  isLive: boolean
}) {
  const { user, hasRole, logout } = useAuth()
  const activeMachine = machines.find((m) => m.machine_id === selectedMachineId) || machines[0]

  return (
    <>
      <aside className={sidebarOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">
            <Icon name="motor" size={24} />
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
              <Icon name="motor" />
            </div>
            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              style={{
                background: "transparent",
                color: "inherit",
                border: "none",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                width: "100%",
                outline: "none"
              }}
            >
              {machines.map((m) => (
                <option key={m.machine_id} value={m.machine_id} style={{ background: "#1e293b", color: "#fff" }}>
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
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.label === "Live Monitoring" && isLive && <i className="live-dot" />}
                </button>
              </div>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="esp-status">
            <span className={isLive ? "status-icon connected" : "status-icon"}>
              <Icon name="wifi" />
            </span>
            <div>
              <strong>ESP32 {isLive ? "Connected" : "Offline"}</strong>
              <small>{selectedMachineId} · {isLive ? "Telemetry Active" : "Waiting for Stream"}</small>
            </div>
          </div>
          <div className="version" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>User: <b>{user?.username || "Guest"}</b></span>
            <button
              onClick={logout}
              style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  )
}
