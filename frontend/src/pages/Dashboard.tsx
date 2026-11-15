import React, { useState } from "react"
import { Icon } from "../components/Icons"
import { SensorCard } from "../components/SensorCard"
import { TrendChart } from "../components/TrendChart"
import { Reading, SensorMetadata, SensorKey, Status, Page, Machine } from "../types"
import { api } from "../api/client"

export const SENSORS: SensorMetadata[] = [
  { key: "temperature", label: "Temperature", unit: "°C", icon: "thermometer", color: "orange", range: "Rated Max: 80 °C" },
  { key: "humidity", label: "Humidity", unit: "%", icon: "droplet", color: "blue", range: "Normal: 30–70%" },
  { key: "current", label: "Current", unit: "A", icon: "activity", color: "purple", range: "Rated: 8.5 A" },
  { key: "voltage", label: "Voltage", unit: "V", icon: "bolt", color: "cyan", range: "Nominal: 230 V" },
  { key: "vibration", label: "Vibration", unit: "m/s²", icon: "wave", color: "green", range: "ISO Limit: 4.5 m/s²" }
]

export function Dashboard({
  machine,
  readings,
  latest,
  isLive,
  setPage,
  alertCount = 0
}: {
  machine?: Machine
  readings: Reading[]
  latest: Reading
  isLive: boolean
  setPage: (p: Page) => void
  alertCount?: number
}) {
  const [selectedSensor, setSelectedSensor] = useState<SensorKey>("temperature")
  const [timeWindow, setTimeWindow] = useState("30 min")
  const selectedMeta = SENSORS.find((s) => s.key === selectedSensor) || SENSORS[0]

  const status: Status = latest.status || (latest.condition as Status) || (isLive ? "SAFE" : "NO DATA")
  const isHealthy = status === "SAFE"
  const isCritical = status === "CRITICAL"
  const isWarning = status === "WARNING"

  const downloadCsv = () => {
    if (machine) {
      window.open(api.getCsvUrl(machine.machine_id), "_blank")
    }
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">OPERATIONS OVERVIEW</span>
          <h1>{machine?.name || "Motor Condition Dashboard"}</h1>
          <p>
            Real-time multi-sensor telemetry for <b>{machine?.machine_id || "MOTOR_001"}</b> · {machine?.location || "Production Floor"}
          </p>
        </div>
        <div className="intro-actions">
          <button className="secondary-button" onClick={() => setPage("History")}>
            <Icon name="clock" size={14} /> View History
          </button>
          <button className="primary-button" onClick={downloadCsv}>
            <Icon name="download" size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Subtle Active Alert Banner */}
      {(alertCount > 0 || isCritical || isWarning) && (
        <div className={`active-alert-banner ${isWarning && !isCritical ? "warning-level" : ""}`}>
          <div className="alert-banner-left">
            <span className="alert-beacon-icon">
              <Icon name="alert-triangle" size={18} />
            </span>
            <div className="alert-banner-text">
              <strong>
                {isCritical
                  ? "CRITICAL MOTOR EXCEPTION DETECTED"
                  : isWarning
                  ? "SYSTEM ANOMALY OR ELEVATED LOAD DETECTED"
                  : `${alertCount} ACTIVE UNACKNOWLEDGED ALERT(S)`}
              </strong>
              <span>
                {latest.recommendation || "Deterministic rules or Isolation Forest flagged an operating threshold breach."}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button
              className="danger-button"
              onClick={() => setPage("Alerts")}
              style={{ fontSize: "10px", height: "30px" }}
            >
              <Icon name="alert-triangle" size={12} /> Review Alerts ({alertCount})
            </button>
            <button
              className="primary-button"
              onClick={() => setPage("AI Diagnostics")}
              style={{ fontSize: "10px", height: "30px" }}
            >
              <Icon name="cpu" size={12} /> AI Diagnosis
            </button>
          </div>
        </div>
      )}

      {!isLive && (
        <div className="preview-banner">
          <Icon name="wifi" size={18} />
          <div>
            <strong>Telemetry stream paused or awaiting sensor gateway</strong>
            <span>
              Connect the ESP32 hardware or run <code>python simulator/simulate.py</code> to stream live data.
            </span>
          </div>
        </div>
      )}

      {/* Health Hero Card */}
      <div className={`health-hero status-${status.toLowerCase().replace(/\s+/g, "-")}`}>
        <div className="health-main">
          <span className="health-icon">
            <Icon name={isCritical ? "alert-triangle" : isHealthy ? "check" : "heart"} size={26} />
          </span>
          <div>
            <span className="eyebrow">MOTOR HEALTH STATUS</span>
            <h2>{isLive ? status : "NO RECENT TELEMETRY"}</h2>
            <p>
              {isCritical
                ? "Physical rule threshold exceeded. Immediate inspection recommended."
                : isWarning
                ? "Elevated telemetry or statistical anomaly detected."
                : isLive
                ? "Motor is operating inside verified healthy parameters."
                : "Awaiting live sensor stream from ESP32."}
            </p>
          </div>
        </div>

        <div className="health-metrics">
          <div>
            <span>BASELINE MODEL</span>
            <strong>{machine?.learning_status === "HEALTHY_BASELINE_READY" ? "Active (Isolation Forest)" : machine?.learning_status || "Collecting"}</strong>
            <small>{latest.anomaly_score !== null && latest.anomaly_score !== undefined ? `Anomaly Score: ${latest.anomaly_score}` : "Score pending"}</small>
          </div>
          <div>
            <span>DIAGNOSIS ACTION</span>
            <button
              onClick={() => setPage("AI Diagnostics")}
              className="primary-button"
              style={{
                height: "28px",
                fontSize: "10px",
                marginTop: "4px",
                padding: "0 10px",
                gap: "5px"
              }}
            >
              <Icon name="cpu" size={12} /> AI Analysis
            </button>
          </div>
          <div>
            <span>RECOMMENDATION</span>
            <strong>{latest.recommendation || (isHealthy ? "Normal operation" : "Review telemetry")}</strong>
            <small>Layered rule & ML guidance</small>
          </div>
        </div>
      </div>

      {/* Sensor Cards Grid */}
      <div className="section-heading" style={{ marginTop: "24px" }}>
        <div>
          <span>LIVE MONITORING</span>
          <h2>Sensor Telemetry</h2>
        </div>
        <span className="read-count">
          <i className={isLive ? "live-dot" : "preview-dot"} />{" "}
          {isLive ? "Real-time SSE Stream" : "Disconnected"} · <b>{readings.length} readings</b>
        </span>
      </div>

      <div className="sensor-grid">
        {SENSORS.map((sensor) => (
          <SensorCard
            key={sensor.key}
            sensor={sensor}
            reading={latest}
            history={readings}
            isLive={isLive}
          />
        ))}
      </div>

      {/* Trend & Controls Panel */}
      <div className="dashboard-bottom" style={{ marginTop: "20px" }}>
        <section className="panel trend-panel">
          <div className="section-heading">
            <div>
              <span>TELEMETRY TRENDS</span>
              <h2>{selectedMeta.label} Trend</h2>
            </div>
            <div className="chart-controls">
              <select
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value as SensorKey)}
              >
                {SENSORS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)}>
                <option>10 min</option>
                <option>30 min</option>
                <option>1 hour</option>
              </select>
            </div>
          </div>
          <TrendChart data={readings} sensor={selectedMeta} />
        </section>
      </div>
    </>
  )
}
