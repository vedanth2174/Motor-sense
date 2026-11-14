import React, { useState, useEffect } from "react"
import { Icon } from "../components/Icons"
import { Machine, Reading } from "../types"
import { api } from "../api/client"
import { useAuth } from "../auth/AuthContext"

export function MotorHealthPage({
  machine,
  latest,
  onRefreshMachine
}: {
  machine?: Machine
  latest: Reading
  onRefreshMachine: () => void
}) {
  const { hasRole } = useAuth()
  const isEngineer = hasRole("engineer")

  const [baselineStatus, setBaselineStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const loadBaseline = async () => {
    if (!machine) return
    try {
      const data = await api.getBaselineStatus(machine.machine_id)
      setBaselineStatus(data)
    } catch (e) {
      console.warn("Could not load baseline stats:", e)
    }
  }

  useEffect(() => {
    loadBaseline()
  }, [machine?.machine_id])

  const handleApprove = async () => {
    if (!machine) return
    setLoading(true)
    try {
      const res = await api.approveBaseline(machine.machine_id)
      setMsg(res.message)
      await loadBaseline()
      onRefreshMachine()
    } catch (e: any) {
      alert(`Approval error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleTrain = async () => {
    if (!machine) return
    setLoading(true)
    try {
      const res = await api.trainBaseline(machine.machine_id)
      setMsg(res.message || "Model trained successfully!")
      await loadBaseline()
      onRefreshMachine()
    } catch (e: any) {
      alert(`Training error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const stats = baselineStatus?.statistics || {}
  const usable = baselineStatus?.usable_readings || 0
  const required = baselineStatus?.required_readings || 500
  const progressPct = Math.min(Math.round((usable / required) * 100), 100)

  return (
    <div className="content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">PHYSICAL INTEGRITY & LIFECYCLE</span>
          <h1>Motor Health & Anomaly Baseline</h1>
          <p>
            Statistical baseline learning and operational envelope validation for <b>{machine?.name}</b> ({machine?.machine_id}).
          </p>
        </div>
        <div className="intro-actions">
          {isEngineer && (
            <>
              <button
                className="secondary-button"
                onClick={handleApprove}
                disabled={loading || usable < required}
                style={{ opacity: usable < required ? 0.6 : 1 }}
              >
                <Icon name="check" /> Approve Baseline
              </button>
              <button
                className="primary-button"
                onClick={handleTrain}
                disabled={loading || machine?.learning_status !== "APPROVED_FOR_TRAINING"}
                style={{ opacity: machine?.learning_status !== "APPROVED_FOR_TRAINING" ? 0.6 : 1 }}
              >
                <Icon name="brain" /> Train Isolation Forest
              </button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div className="preview-banner" style={{ borderLeftColor: "#22c55e", background: "rgba(34,197,94,0.1)" }}>
          <Icon name="check" />
          <span>{msg}</span>
        </div>
      )}

      {/* Baseline Learning Progress Card */}
      <div className="panel" style={{ padding: "20px", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "16px", margin: "0 0 12px 0" }}>Baseline Learning Pipeline</h2>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px" }}>
          <span>Valid Telemetry Samples Collected: <b>{usable} / {required}</b></span>
          <span style={{ color: "#38bdf8", fontWeight: 700 }}>{progressPct}%</span>
        </div>
        <div style={{ width: "100%", height: "10px", background: "#0f172a", borderRadius: "5px", overflow: "hidden" }}>
          <div style={{ width: `${progressPct}%`, height: "100%", background: "#3b82f6", transition: "width 0.4s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "13px", color: "#94a3b8" }}>
          <span>Current Pipeline State: <b style={{ color: "#f8fafc" }}>{machine?.learning_status}</b></span>
          <span>{baselineStatus?.message || "Collecting readings..."}</span>
        </div>
      </div>

      {/* Statistical Summary */}
      {Object.keys(stats).length > 0 && (
        <div className="panel" style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "16px", margin: "0 0 16px 0" }}>Learned Baseline Sensor Statistics</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                  <th style={{ padding: "10px" }}>Sensor Metric</th>
                  <th style={{ padding: "10px" }}>Mean</th>
                  <th style={{ padding: "10px" }}>Std Dev</th>
                  <th style={{ padding: "10px" }}>Min</th>
                  <th style={{ padding: "10px" }}>Max</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats).map(([metric, s]: [string, any]) => (
                  <tr key={metric} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "10px", textTransform: "capitalize", fontWeight: 600 }}>{metric}</td>
                    <td style={{ padding: "10px" }}>{s.mean}</td>
                    <td style={{ padding: "10px" }}>{s.std}</td>
                    <td style={{ padding: "10px" }}>{s.min}</td>
                    <td style={{ padding: "10px" }}>{s.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
