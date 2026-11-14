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

  return (
    <div className="content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">SYSTEM NOTIFICATIONS</span>
          <h1>Asset Alerts & Exception Log</h1>
          <p>
            Deterministic rule violations and ML statistical anomalies recorded for <b>{machine?.machine_id}</b>.
          </p>
        </div>
        <div className="intro-actions">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              background: "#1e293b",
              color: "#fff",
              border: "1px solid #334155"
            }}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <button className="secondary-button" onClick={loadAlerts}>
            <Icon name="refresh" /> Refresh
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: "20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            <Icon name="check" size={32} />
            <p style={{ marginTop: "8px" }}>No alerts match the selected filter. System running normally.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                  <th style={{ padding: "10px" }}>Time</th>
                  <th style={{ padding: "10px" }}>Severity</th>
                  <th style={{ padding: "10px" }}>Source</th>
                  <th style={{ padding: "10px" }}>Alert Message</th>
                  <th style={{ padding: "10px" }}>Status</th>
                  <th style={{ padding: "10px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((alert) => {
                  const isAck = Boolean(alert.acknowledged_at)
                  return (
                    <tr key={alert.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "10px" }}>{new Date(alert.created_at).toLocaleString()}</td>
                      <td style={{ padding: "10px", fontWeight: 700, textTransform: "uppercase" }}>
                        <span
                          style={{
                            color:
                              alert.severity === "critical"
                                ? "#ef4444"
                                : alert.severity === "warning"
                                ? "#eab308"
                                : "#38bdf8"
                          }}
                        >
                          {alert.severity}
                        </span>
                      </td>
                      <td style={{ padding: "10px", textTransform: "uppercase", fontSize: "12px", color: "#94a3b8" }}>
                        {alert.source}
                      </td>
                      <td style={{ padding: "10px", color: "#f8fafc" }}>{alert.message}</td>
                      <td style={{ padding: "10px" }}>
                        {isAck ? (
                          <span style={{ color: "#4ade80", fontSize: "12px" }}>
                            Ack by {alert.acknowledged_by}
                          </span>
                        ) : (
                          <span style={{ color: "#f87171", fontSize: "12px", fontWeight: 600 }}>
                            OPEN
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px" }}>
                        {!isAck && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={!isEngineer}
                            style={{
                              background: isEngineer ? "#3b82f6" : "#475569",
                              color: "#fff",
                              border: "none",
                              padding: "4px 10px",
                              borderRadius: "4px",
                              cursor: isEngineer ? "pointer" : "not-allowed",
                              fontSize: "12px",
                              fontWeight: 600
                            }}
                          >
                            Acknowledge
                          </button>
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
