import React, { useState, useEffect } from "react"
import { Icon } from "../components/Icons"
import { Alert, Machine } from "../types"
import { api } from "../api/client"
import { useAuth } from "../auth/AuthContext"

export function AlertsPage({ machine }: { machine?: Machine }) {
  const { user, hasRole } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [severityFilter, setSeverityFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const isEngineer = hasRole("engineer")

  const loadAlerts = async () => {
    setLoading(true)
    try {
      const data = await api.getAlerts(machine?.machine_id)
      setAlerts(data)
    } catch (e) {
      console.warn("Could not load alerts:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAlerts()
  }, [machine?.machine_id])

  const handleAcknowledge = async (alertId: number) => {
    try {
      const updated = await api.acknowledgeAlert(alertId, user?.username)
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)))
    } catch (e: any) {
      alert(`Could not acknowledge alert: ${e.message}`)
    }
  }

  const filtered = alerts.filter((a) => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false
    return true
  })

  const unackCount = alerts.filter((a) => !a.acknowledged_at).length

  return (
    <div className="content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">OPERATIONS MONITORING</span>
          <h1>Asset Alerts & Incident Log</h1>
          <p>
            Deterministic rule boundary trips and statistical anomalies for <b>{machine?.machine_id}</b>.
          </p>
        </div>
        <div className="intro-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: "0 28px 0 10px",
              height: "36px",
              borderRadius: "6px",
              background: "#152238",
              color: "#f8fafc",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              fontSize: "11px"
            }}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warning Only</option>
            <option value="info">Info Only</option>
          </select>
          <button className="secondary-button" onClick={loadAlerts}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      {unackCount > 0 && (
        <div className="active-alert-banner">
          <div className="alert-banner-left">
            <span className="alert-beacon-icon">
              <Icon name="alert-triangle" size={18} />
            </span>
            <div className="alert-banner-text">
              <strong>{unackCount} UNACKNOWLEDGED INCIDENT(S) REQUIRE ATTENTION</strong>
              <span>Review severity ratings below. Engineers may sign off on events directly.</span>
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: "0", overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#94a3b8" }}>
            <span style={{ color: "#10b981", display: "inline-block", marginBottom: "8px" }}>
              <Icon name="check" size={36} />
            </span>
            <h3 style={{ color: "#f8fafc", fontSize: "16px", marginBottom: "4px" }}>System Operating Normally</h3>
            <p style={{ fontSize: "12px", color: "#64748b" }}>No alerts match the selected severity filter.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ padding: "12px 16px" }}>Timestamp</th>
                  <th style={{ padding: "12px 16px" }}>Severity</th>
                  <th style={{ padding: "12px 16px" }}>Engine</th>
                  <th style={{ padding: "12px 16px" }}>Message / Diagnostic</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((alert) => {
                  const isAck = Boolean(alert.acknowledged_at)
                  const isCritical = alert.severity === "critical"
                  const isWarning = alert.severity === "warning"
                  const rowClass = !isAck ? (isCritical ? "unack-critical" : isWarning ? "unack-warning" : "") : ""

                  return (
                    <tr key={alert.id} className={rowClass}>
                      <td style={{ padding: "12px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: "10.5px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {!isAck && (
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: isCritical ? "#ef4444" : "#f59e0b",
                                display: "inline-block",
                                boxShadow: isCritical ? "0 0 8px #ef4444" : "0 0 8px #f59e0b"
                              }}
                            />
                          )}
                          <span>{new Date(alert.created_at).toLocaleString()}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          className={`table-status ${
                            alert.severity === "critical" ? "critical" : alert.severity === "warning" ? "warning" : "safe"
                          }`}
                        >
                          <i />
                          {alert.severity}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textTransform: "uppercase", fontSize: "10px", color: "#60a5fa", fontWeight: 700 }}>
                        {alert.source}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#f8fafc", fontWeight: 500, fontSize: "11.5px" }}>
                        {alert.message}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {isAck ? (
                          <span style={{ color: "#34d399", fontSize: "10.5px", fontWeight: 600 }}>
                            Acknowledged by {alert.acknowledged_by}
                          </span>
                        ) : (
                          <span style={{ color: "#f87171", fontSize: "10px", fontWeight: 800, letterSpacing: "0.5px" }}>
                            OPEN / UNRESOLVED
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {!isAck ? (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={!isEngineer}
                            className="primary-button"
                            style={{
                              height: "28px",
                              padding: "0 10px",
                              fontSize: "10px",
                              opacity: isEngineer ? 1 : 0.5,
                              cursor: isEngineer ? "pointer" : "not-allowed"
                            }}
                            title={isEngineer ? "Mark alert acknowledged" : "Engineer role required to acknowledge"}
                          >
                            <Icon name="check" size={12} /> Acknowledge
                          </button>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "10px" }}>Resolved</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
