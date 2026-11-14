import React from "react"
import { Icon } from "../components/Icons"
import { Machine, Reading } from "../types"
import { api } from "../api/client"

export function DataExportPage({
  machine,
  readings
}: {
  machine?: Machine
  readings: Reading[]
}) {
  const downloadCsv = () => {
    if (!machine) return
    window.open(api.getCsvUrl(machine.machine_id), "_blank")
  }

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(readings, null, 2))
    const dlAnchor = document.createElement("a")
    dlAnchor.setAttribute("href", dataStr)
    dlAnchor.setAttribute("download", `motorsense_${machine?.machine_id}_telemetry.json`)
    dlAnchor.click()
  }

  return (
    <div className="content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">REPORTS & EXPORTS</span>
          <h1>Data Export & Telemetry Dumps</h1>
          <p>
            Export sensory datasets, baseline statistics, and condition records for analysis in Jupyter, MATLAB, or reporting.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div className="panel" style={{ padding: "24px" }}>
          <Icon name="file" size={32} />
          <h2 style={{ fontSize: "18px", margin: "12px 0 8px 0" }}>Export Comma-Separated Values (CSV)</h2>
          <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.5" }}>
            Full timestamped table containing temperature, humidity, current, voltage, vibration, condition labels, and anomaly scores.
          </p>
          <button className="primary-button" onClick={downloadCsv} style={{ marginTop: "12px" }}>
            <Icon name="download" /> Download CSV
          </button>
        </div>

        <div className="panel" style={{ padding: "24px" }}>
          <Icon name="database" size={32} />
          <h2 style={{ fontSize: "18px", margin: "12px 0 8px 0" }}>Export Raw Telemetry Stream (JSON)</h2>
          <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.5" }}>
            In-memory JSON structure suitable for programmatic evaluation, ML training pipelines, or REST ingestion.
          </p>
          <button className="secondary-button" onClick={downloadJson} style={{ marginTop: "12px" }}>
            <Icon name="download" /> Download JSON ({readings.length} records)
          </button>
        </div>
      </div>
    </div>
  )
}
