import React, { useState } from "react"
import { Icon } from "../components/Icons"
import { SENSORS } from "./Dashboard"
import { formatReading } from "../components/SensorCard"
import { TrendChart } from "../components/TrendChart"
import { Reading, Machine, SensorKey } from "../types"

export function LiveMonitoringPage({
  machine,
  readings,
  latest,
  isLive
}: {
  machine?: Machine
  readings: Reading[]
  latest: Reading
  isLive: boolean
}) {
  const [selectedSensor, setSelectedSensor] = useState<SensorKey>("temperature")
  const selectedMeta = SENSORS.find((s) => s.key === selectedSensor) || SENSORS[0]

  return (
    <div className="content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">HIGH-FREQUENCY TELEMETRY</span>
          <h1>Live Sensor Telemetry & Signals</h1>
          <p>
            Continuous real-time measurements from <b>{machine?.name}</b> ({machine?.machine_id}).
          </p>
        </div>
        <div className="intro-actions">
          <span className="read-count">
            <i className={isLive ? "live-dot" : "preview-dot"} />{" "}
            {isLive ? "SSE Stream Connected" : "Stream Disconnected"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {SENSORS.map((s) => {
          const val = latest[s.key]
          const isSelected = selectedSensor === s.key
          return (
            <div
              key={s.key}
              onClick={() => setSelectedSensor(s.key)}
              style={{
                background: isSelected ? "rgba(59, 130, 246, 0.15)" : "#1e293b",
                border: isSelected ? "2px solid #3b82f6" : "1px solid #334155",
                borderRadius: "10px",
                padding: "16px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>{s.label}</span>
                <span style={{ color: isSelected ? "#38bdf8" : "#64748b" }}>
                  <Icon name={s.icon as any} size={18} />
                </span>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, margin: "10px 0 4px 0", color: "#f8fafc" }}>
                {formatReading(val, s.key === "voltage" ? 1 : 2)}{" "}
                <small style={{ fontSize: "14px", color: "#94a3b8" }}>{s.unit}</small>
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>{s.range}</div>
            </div>
          )
        })}
      </div>

      <div className="panel" style={{ padding: "20px" }}>
        <div className="section-heading" style={{ margin: "0 0 16px 0" }}>
          <div>
            <span>SIGNAL INSPECTOR</span>
            <h2>{selectedMeta.label} Detailed Trend</h2>
          </div>
          <small style={{ color: "#94a3b8" }}>Showing last {readings.length} readings</small>
        </div>
        <TrendChart data={readings} sensor={selectedMeta} large={true} />
      </div>
    </div>
  )
}
