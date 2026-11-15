import React from "react"
import { Icon, IconName } from "./Icons"
import { SensorMetadata, Reading } from "../types"

export function formatReading(value: number | null | undefined, decimals = 2) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "N/A"
    : value.toFixed(decimals)
}

function getAlertSeverity(key: string, val: number | null | undefined): "critical" | "warning" | "normal" {
  if (val === null || val === undefined || !Number.isFinite(val)) return "normal"

  switch (key) {
    case "temperature":
      if (val >= 80.0) return "critical" // > 80C rated
      if (val >= 72.0) return "warning"
      return "normal"
    case "current":
      if (val >= 9.35) return "critical" // > 110% rated (8.5A * 1.1)
      if (val >= 8.5) return "warning"
      return "normal"
    case "vibration":
      if (val >= 4.5) return "critical" // ISO 10816 Limit
      if (val >= 3.2) return "warning"
      return "normal"
    case "voltage":
      if (val <= 207.0 || val >= 253.0) return "critical" // outside +-10% nominal
      if (val <= 216.0 || val >= 244.0) return "warning"
      return "normal"
    case "humidity":
      if (val <= 15.0 || val >= 85.0) return "warning"
      return "normal"
    default:
      return "normal"
  }
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 23}`
    )
    .join(" ")

  return (
    <svg className={`sparkline ${color}`} viewBox="0 0 100 32" preserveAspectRatio="none">
      <polyline points={points} />
    </svg>
  )
}

export function SensorCard({
  sensor,
  reading,
  history,
  isLive
}: {
  sensor: SensorMetadata
  reading: Reading
  history: Reading[]
  isLive: boolean
}) {
  const sparkData = history
    .map((item) => item[sensor.key])
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .slice(0, 20)
    .reverse()

  const rawVal = reading[sensor.key]
  const alertState = isLive ? getAlertSeverity(sensor.key, rawVal) : "normal"
  const isCritical = alertState === "critical"
  const isWarning = alertState === "warning"

  const cardClass = `sensor-card ${isCritical ? "has-alert-critical" : isWarning ? "has-alert-warning" : ""}`

  return (
    <div className={cardClass}>
      <div className="sensor-card-top">
        <div className={`sensor-icon ${sensor.color}`}>
          <Icon name={sensor.icon as IconName} size={18} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {isCritical && (
            <span className="sensor-alert-badge">
              <Icon name="alert-triangle" size={10} /> CRITICAL
            </span>
          )}
          {isWarning && (
            <span className="sensor-alert-badge warning">
              <Icon name="alert-triangle" size={10} /> WARNING
            </span>
          )}
          <span className="live-label">
            <i className={isLive ? "live-dot" : "preview-dot"} />
            {isLive ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>

      <div className="sensor-label">{sensor.label}</div>

      <div className="sensor-value">
        {formatReading(rawVal, sensor.key === "voltage" ? 1 : 2)}{" "}
        <small>{rawVal === null ? "" : sensor.unit}</small>
      </div>

      <div className="spark-row">
        {sparkData.length > 1 ? (
          <Sparkline data={sparkData} color={isCritical ? "orange" : sensor.color} />
        ) : (
          <span className="sensor-range">Awaiting trend telemetry</span>
        )}
      </div>

      <div className="sensor-range">{sensor.range}</div>
    </div>
  )
}
