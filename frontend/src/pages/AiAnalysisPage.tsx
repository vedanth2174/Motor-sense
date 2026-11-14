import React, { useState, useEffect } from "react"
import { Icon } from "../components/Icons"
import { Machine, AiAnalysis } from "../types"
import { api } from "../api/client"
import { useAuth } from "../auth/AuthContext"

export function AiAnalysisPage({ machine }: { machine?: Machine }) {
  const { hasRole } = useAuth()
  const [windowMinutes, setWindowMinutes] = useState(30)
  const [loading, setLoading] = useState(false)
  const [currentAnalysis, setCurrentAnalysis] = useState<AiAnalysis | null>(null)
  const [pastAnalyses, setPastAnalyses] = useState<AiAnalysis[]>([])
  const [error, setError] = useState<string | null>(null)

  const isEngineer = hasRole("engineer")

  const loadPastAnalyses = async () => {
    if (!machine) return
    try {
      const data = await api.getAiAnalyses(machine.machine_id)
      setPastAnalyses(data)
      if (data.length > 0 && !currentAnalysis) {
        setCurrentAnalysis(data[0])
      }
    } catch (e: any) {
      console.warn("Could not load past analyses:", e)
    }
  }

  useEffect(() => {
    loadPastAnalyses()
  }, [machine?.machine_id])

  const handleRunAnalysis = async () => {
    if (!machine) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.runAiAnalysis(machine.machine_id, windowMinutes)
      setCurrentAnalysis(result)
      setPastAnalyses((prev) => [result, ...prev])
    } catch (e: any) {
      setError(e.message || "Failed to execute AI analysis.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">HYBRID INTELLIGENCE</span>
          <h1>AI Predictive Maintenance Diagnostics</h1>
          <p>
            Large Language Model analysis of sensor window trends, active threshold alerts, and asset specifications for <b>{machine?.name}</b> ({machine?.machine_id}).
          </p>
        </div>
        <div className="intro-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(Number(e.target.value))}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              background: "#1e293b",
              color: "#fff",
              border: "1px solid #334155"
            }}
          >
            <option value={15}>Telemetry Window: 15 min</option>
            <option value={30}>Telemetry Window: 30 min</option>
            <option value={60}>Telemetry Window: 1 hr</option>
            <option value={120}>Telemetry Window: 2 hrs</option>
          </select>
          <button
            className="primary-button"
            onClick={handleRunAnalysis}
            disabled={loading || !isEngineer}
            style={{ opacity: !isEngineer ? 0.6 : 1 }}
          >
            <Icon name="cpu" />
            {loading ? "Analyzing Window..." : "Run AI Diagnosis"}
          </button>
        </div>
      </div>

      {!isEngineer && (
        <div className="preview-banner" style={{ borderLeftColor: "#eab308" }}>
          <Icon name="shield" />
          <span>Note: Engineer role is required to trigger new live AI diagnostics. Showing past reports.</span>
        </div>
      )}

      {error && (
        <div className="preview-banner" style={{ borderLeftColor: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
          <Icon name="alert-triangle" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Analysis Card */}
      {currentAnalysis ? (
        <div className="panel" style={{ padding: "24px", marginTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #334155", paddingBottom: "16px", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2 style={{ margin: 0, fontSize: "20px" }}>Engineering Diagnosis Report</h2>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    background:
                      currentAnalysis.output.severity === "high"
                        ? "rgba(239, 68, 68, 0.2)"
                        : currentAnalysis.output.severity === "medium"
                        ? "rgba(234, 179, 8, 0.2)"
                        : "rgba(34, 197, 94, 0.2)",
                    color:
                      currentAnalysis.output.severity === "high"
                        ? "#ef4444"
                        : currentAnalysis.output.severity === "medium"
                        ? "#eab308"
                        : "#22c55e"
                  }}
                >
                  {currentAnalysis.output.severity} Severity
                </span>
              </div>
              <small style={{ color: "#94a3b8" }}>
                Generated: {new Date(currentAnalysis.created_at).toLocaleString()} · Latency: {currentAnalysis.latency_ms} ms · Model: {currentAnalysis.model}
              </small>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>Confidence</span>
              <div style={{ fontWeight: 700, color: "#38bdf8", textTransform: "capitalize" }}>
                {currentAnalysis.output.confidence}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", textTransform: "uppercase", color: "#94a3b8", marginBottom: "6px" }}>Executive Summary</h3>
            <p style={{ fontSize: "16px", lineHeight: "1.5", color: "#f8fafc", margin: 0 }}>
              {currentAnalysis.output.summary}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "8px" }}>
              <h3 style={{ fontSize: "14px", color: "#f87171", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="alert-triangle" size={16} /> Likely Root Causes
              </h3>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#cbd5e1", lineHeight: "1.6" }}>
                {currentAnalysis.output.likely_causes?.map((cause, idx) => (
                  <li key={idx}>{cause}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "8px" }}>
              <h3 style={{ fontSize: "14px", color: "#4ade80", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="wrench" size={16} /> Recommended Corrective Actions
              </h3>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#cbd5e1", lineHeight: "1.6" }}>
                {currentAnalysis.output.recommended_actions?.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
          <Icon name="cpu" size={40} />
          <p style={{ marginTop: "12px" }}>No AI diagnosis generated yet. Click "Run AI Diagnosis" above to analyze the current telemetry window.</p>
        </div>
      )}

      {/* History Table */}
      {pastAnalyses.length > 0 && (
        <div className="panel" style={{ marginTop: "24px", padding: "20px" }}>
          <h3 style={{ margin: "0 0 14px 0", fontSize: "16px" }}>Historical AI Diagnoses</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                  <th style={{ padding: "10px" }}>Date & Time</th>
                  <th style={{ padding: "10px" }}>Severity</th>
                  <th style={{ padding: "10px" }}>Summary</th>
                  <th style={{ padding: "10px" }}>Model</th>
                  <th style={{ padding: "10px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pastAnalyses.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "10px" }}>{new Date(a.created_at).toLocaleString()}</td>
                    <td style={{ padding: "10px", textTransform: "uppercase", fontWeight: 700 }}>
                      <span style={{ color: a.output.severity === "high" ? "#ef4444" : a.output.severity === "medium" ? "#eab308" : "#22c55e" }}>
                        {a.output.severity}
                      </span>
                    </td>
                    <td style={{ padding: "10px", maxWidth: "400px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.output.summary}
                    </td>
                    <td style={{ padding: "10px", color: "#94a3b8" }}>{a.model}</td>
                    <td style={{ padding: "10px" }}>
                      <button
                        onClick={() => setCurrentAnalysis(a)}
                        style={{ background: "#334155", border: "none", color: "#fff", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                      >
                        View
                      </button>
                    </td>
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
