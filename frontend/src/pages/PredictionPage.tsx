import React, { useState } from "react"
import { Icon } from "../components/Icons"
import { Machine, Reading } from "../types"
import { api } from "../api/client"

export function PredictionPage({
  machine,
  latest
}: {
  machine?: Machine
  latest: Reading
}) {
  const [predictionData, setPredictionData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handlePredict = async () => {
    if (!machine) return
    setLoading(true)
    try {
      const res = await api.predict(machine.machine_id)
      setPredictionData(res)
    } catch (e: any) {
      alert(`Prediction failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const result = predictionData || {
    condition: latest.condition || "UNKNOWN",
    status: latest.status || "SAFE",
    anomaly_score: latest.anomaly_score,
    rule_violations: [],
    confidence: 0.90,
    recommendation: latest.recommendation || "System running nominal."
  }

  return (
    <div className="content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">HYBRID DETECTION PIPELINE</span>
          <h1>Predictive Fault Classification & Scoring</h1>
          <p>
            Real-time inference combining deterministic physical limit rules and scikit-learn Isolation Forest baseline scoring.
          </p>
        </div>
        <div className="intro-actions">
          <button className="primary-button" onClick={handlePredict} disabled={loading}>
            <Icon name="brain" /> {loading ? "Evaluating..." : "Run Pipeline Inference"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
        {/* Prediction Result Card */}
        <div className="panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "18px", margin: 0 }}>Layered Pipeline Evaluation</h2>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "12px",
                background:
                  result.condition === "CRITICAL"
                    ? "rgba(239, 68, 68, 0.2)"
                    : result.condition === "WARNING"
                    ? "rgba(234, 179, 8, 0.2)"
                    : "rgba(34, 197, 94, 0.2)",
                color:
                  result.condition === "CRITICAL"
                    ? "#ef4444"
                    : result.condition === "WARNING"
                    ? "#eab308"
                    : "#22c55e"
              }}
            >
              {result.condition}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div style={{ background: "#0f172a", padding: "14px", borderRadius: "8px" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>Isolation Forest Anomaly Score</span>
              <div style={{ fontSize: "22px", fontWeight: 700, color: result.anomaly_score !== null && result.anomaly_score < 0 ? "#ef4444" : "#38bdf8", marginTop: "4px" }}>
                {result.anomaly_score !== null && result.anomaly_score !== undefined ? result.anomaly_score : "Not scored"}
              </div>
              <small style={{ fontSize: "11px", color: "#64748b" }}>Score &lt; 0 indicates out-of-distribution pattern</small>
            </div>

            <div style={{ background: "#0f172a", padding: "14px", borderRadius: "8px" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>Rule Violations Triggered</span>
              <div style={{ fontSize: "22px", fontWeight: 700, color: result.rule_violations?.length > 0 ? "#f87171" : "#4ade80", marginTop: "4px" }}>
                {result.rule_violations?.length || 0}
              </div>
              <small style={{ fontSize: "11px", color: "#64748b" }}>Hard safety boundaries</small>
            </div>
          </div>

          {result.rule_violations?.length > 0 && (
            <div style={{ marginBottom: "16px", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "8px", padding: "12px" }}>
              <strong style={{ color: "#ef4444", fontSize: "13px" }}>Violations:</strong>
              <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px", fontSize: "13px", color: "#fca5a5" }}>
                {result.rule_violations.map((v: string, idx: number) => (
                  <li key={idx}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>Recommended Maintenance Directive</span>
            <p style={{ fontSize: "15px", color: "#f8fafc", margin: "6px 0 0 0" }}>{result.recommendation}</p>
          </div>
        </div>

        {/* Pipeline Architecture Explainer */}
        <div className="panel" style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "16px", margin: "0 0 14px 0" }}>How Hybrid Detection Works</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px", color: "#cbd5e1" }}>
            <div style={{ background: "#0f172a", padding: "10px", borderRadius: "6px" }}>
              <strong style={{ color: "#38bdf8" }}>Layer 1: Deterministic Rules</strong>
              <p style={{ margin: "4px 0 0 0", color: "#94a3b8" }}>Checks overcurrent (&gt;110% rated), voltage tolerances (±10%), thermal limits, and ISO vibration thresholds.</p>
            </div>
            <div style={{ background: "#0f172a", padding: "10px", borderRadius: "6px" }}>
              <strong style={{ color: "#a855f7" }}>Layer 2: Baseline Model (Isolation Forest)</strong>
              <p style={{ margin: "4px 0 0 0", color: "#94a3b8" }}>Learns normal multivariate correlation across all 5 sensors and flags subtle multi-dimensional drift.</p>
            </div>
            <div style={{ background: "#0f172a", padding: "10px", borderRadius: "6px" }}>
              <strong style={{ color: "#4ade80" }}>Layer 3: Generative AI Diagnosis</strong>
              <p style={{ margin: "4px 0 0 0", color: "#94a3b8" }}>Aggregates statistical trends, alerts, and ratings to provide root-cause analysis and actionable repair instructions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
