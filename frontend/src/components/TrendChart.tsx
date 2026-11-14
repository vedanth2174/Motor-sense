import React from "react"
import { Reading, SensorMetadata } from "../types"

export function TrendChart({
  data,
  sensor,
  large = false
}: {
  data: Reading[]
  sensor: SensorMetadata
  large?: boolean
}) {
  if (data.length === 0) {
    return (
      <div className={`chart chart-empty ${large ? "chart-large" : ""}`}>
        No readings match this time period.
      </div>
    )
  }

  const validData = data
    .filter((item) => item[sensor.key] !== null && Number.isFinite(item[sensor.key]))
    .slice(0, 40)
    .reverse()

  if (validData.length < 2) {
    return (
      <div className={`chart chart-empty ${large ? "chart-large" : ""}`}>
        Collecting data points for {sensor.label} trend...
      </div>
    )
  }

  const values = validData.map((item) => item[sensor.key] as number)
  const min = Math.min(...values) * 0.98
  const max = Math.max(...values) * 1.02

  const points = values
    .map(
      (v, i) =>
        `${40 + (i / (values.length - 1)) * 700},${30 + (1 - (v - min) / (max - min || 1)) * 170}`
    )
    .join(" ")

  const fillPoints = `40,200 ${points} 740,200`

  return (
    <div className={`chart ${large ? "chart-large" : ""}`}>
      <svg viewBox="0 0 780 230" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`fill-${sensor.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".24" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 72, 115, 158, 200].map((y) => (
          <line key={y} x1="40" y1={y} x2="740" y2={y} className="grid-line" />
        ))}
        <polygon
          points={fillPoints}
          fill={`url(#fill-${sensor.key})`}
          className={`chart-color ${sensor.color}`}
        />
        <polyline points={points} className={`chart-line ${sensor.color}`} />
        {values.map(
          (v, i) =>
            i % 3 === 0 && (
              <circle
                key={i}
                cx={40 + (i / (values.length - 1)) * 700}
                cy={30 + (1 - (v - min) / (max - min || 1)) * 170}
                r="3"
                className={`chart-dot ${sensor.color}`}
              />
            )
        )}
        {validData
          .filter((_, i) => i % 4 === 0)
          .map((item, i) => (
            <text
              key={item.timestamp + i}
              x={40 + ((i * 4) / (values.length - 1)) * 700}
              y="222"
              className="axis-text"
              textAnchor="middle"
            >
              {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
            </text>
          ))}
      </svg>
    </div>
  )
}
