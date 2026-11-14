import React, { useState, useMemo } from "react"
import { Icon } from "../components/Icons"
import { Reading, Machine } from "../types"
import { formatReading } from "../components/SensorCard"

export function HistoryPage({
  machine,
  readings
}: {
  machine?: Machine
  readings: Reading[]
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filtered = useMemo(() => {
    return readings.filter((r) => {
      const matchSearch = search === "" || Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === "all" || (r.condition || r.status || "").toLowerCase() === statusFilter.toLowerCase()
      return matchSearch && matchStatus
    })
  }, [readings, search, statusFilter])

  return (
    <div className="content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">TELEMETRY ARCHIVE</span>
          <h1>Sensor Readings History</h1>
          <p>
            Historical records and anomaly flags for <b>{machine?.name}</b> ({machine?.machine_id}).
          </p>
        </div>
        <div className="intro-actions" style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            placeholder="Search records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#fff"
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#fff"
            }}
          >
            <option value="all">All Conditions</option>
            <option value="safe">SAFE</option>
            <option value="warning">WARNING</option>
            <option value="critical">CRITICAL</option>
          </select>
        </div>
      </div>

      <div className="panel" style={{ padding: "20px" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                <th style={{ padding: "10px" }}>Timestamp</th>
                <th style={{ padding: "10px" }}>Temp (°C)</th>
                <th style={{ padding: "10px" }}>Humidity (%)</th>
                <th style={{ padding: "10px" }}>Current (A)</th>
                <th style={{ padding: "10px" }}>Voltage (V)</th>
                <th style={{ padding: "10px" }}>Vibration (m/s²)</th>
                <th style={{ padding: "10px" }}>Condition</th>
                <th style={{ padding: "10px" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((r, idx) => (
                <tr key={r.id || idx} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "10px" }}>{new Date(r.timestamp).toLocaleString()}</td>
                  <td style={{ padding: "10px" }}>{formatReading(r.temperature)}</td>
                  <td style={{ padding: "10px" }}>{formatReading(r.humidity)}</td>
                  <td style={{ padding: "10px" }}>{formatReading(r.current)}</td>
                  <td style={{ padding: "10px" }}>{formatReading(r.voltage, 1)}</td>
                  <td style={{ padding: "10px" }}>{formatReading(r.vibration, 3)}</td>
                  <td style={{ padding: "10px", fontWeight: 700 }}>
                    <span
                      style={{
                        color:
                          r.condition === "CRITICAL"
                            ? "#ef4444"
                            : r.condition === "WARNING"
                            ? "#eab308"
                            : "#4ade80"
                      }}
                    >
                      {r.condition || r.status || "UNKNOWN"}
                    </span>
                  </td>
                  <td style={{ padding: "10px", color: "#94a3b8" }}>
                    {r.anomaly_score !== null && r.anomaly_score !== undefined ? r.anomaly_score : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
