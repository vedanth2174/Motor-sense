import React from "react"
import { Icon, IconName } from "./Icons"
import { SensorMetadata, Reading } from "../types"

export function formatReading(value: number | null | undefined, decimals = 2) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "N/A"
    : value.toFixed(decimals)
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

  return (
    <div className="sensor-card">
      <div className="sensor-card-top">
        <div className={`sensor-icon ${sensor.color}`}>
          <Icon name={sensor.icon as IconName} size={20} />
        </div>
        <span className="live-label">
          <i className={isLive ? "live-dot" : "preview-dot"} />
          {isLive ? "LIVE" : "OFFLINE"}
        </span>
      </div>
      <div className="sensor-label">{sensor.label}</div>
      <div className="sensor-value">
        {formatReading(reading[sensor.key], sensor.key === "voltage" ? 1 : 2)}{" "}
        <small>{reading[sensor.key] === null ? "" : sensor.unit}</small>
      </div>
      <div className="spark-row">
        {sparkData.length > 1 ? (
          <Sparkline data={sparkData} color={sensor.color} />
        ) : (
          <span className="sensor-range">Awaiting trend telemetry</span>
        )}
      </div>
      <div className="sensor-range">{sensor.range}</div>
    </div>
  )
}
