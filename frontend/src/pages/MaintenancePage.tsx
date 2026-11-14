import React, { useState, useEffect } from "react"
import { Icon } from "../components/Icons"
import { MaintenanceRecord, Machine } from "../types"
import { api } from "../api/client"
import { useAuth } from "../auth/AuthContext"

export function MaintenancePage({ machine }: { machine?: Machine }) {
  const { user, hasRole } = useAuth()
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [showModal, setShowModal] = useState(false)
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("OPEN")
  const [loading, setLoading] = useState(false)
  const isEngineer = hasRole("engineer")

  const loadRecords = async () => {
    try {
      const data = await api.getMaintenance(machine?.machine_id)
      setRecords(data)
    } catch (e) {
      console.warn("Could not load maintenance records:", e)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [machine?.machine_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !machine) return
    setLoading(true)
    try {
      const created = await api.addMaintenance({
        machine_id: machine.machine_id,
        description,
        status
      })
      setRecords((prev) => [created, ...prev])
      setShowModal(false)
      setDescription("")
      setStatus("OPEN")
    } catch (e: any) {
      alert(`Failed to add record: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ASSET LIFECYCLE</span>
          <h1>Maintenance Log & Work Orders</h1>
          <p>
            Historical preventive interventions, repairs, and scheduled service for <b>{machine?.name}</b> ({machine?.machine_id}).
          </p>
        </div>
        <div className="intro-actions">
          {isEngineer && (
            <button className="primary-button" onClick={() => setShowModal(true)}>
              <Icon name="plus" /> Log Maintenance
            </button>
          )}
          <button className="secondary-button" onClick={loadRecords}>
            <Icon name="refresh" /> Refresh
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: "20px" }}>
        {records.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            <Icon name="wrench" size={32} />
            <p style={{ marginTop: "8px" }}>No maintenance records logged for this asset yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                  <th style={{ padding: "10px" }}>Date Logged</th>
                  <th style={{ padding: "10px" }}>Machine</th>
                  <th style={{ padding: "10px" }}>Description</th>
                  <th style={{ padding: "10px" }}>Status</th>
                  <th style={{ padding: "10px" }}>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "10px" }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: "10px", fontWeight: 600 }}>{r.machine_id}</td>
                    <td style={{ padding: "10px", color: "#f8fafc" }}>{r.description}</td>
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background: r.status === "COMPLETED" ? "rgba(34, 197, 94, 0.2)" : "rgba(234, 179, 8, 0.2)",
                          color: r.status === "COMPLETED" ? "#4ade80" : "#facc15"
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px", color: "#94a3b8" }}>{r.created_by || "engineer"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div style={{ background: "#1e293b", padding: "24px", borderRadius: "10px", width: "420px", border: "1px solid #334155" }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>Log Maintenance Action</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Asset</label>
                <input
                  type="text"
                  disabled
                  value={`${machine?.name} (${machine?.machine_id})`}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
                />
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Work Description</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Cleaned fan shroud, lubed bearings, checked coupling alignment"
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
                />
              </div>
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
                >
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="OPEN">OPEN / IN PROGRESS</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: "8px 14px", background: "#334155", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="primary-button"
                >
                  {loading ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
