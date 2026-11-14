import React, { useState, useEffect } from "react"
import { Icon } from "../components/Icons"
import { Machine, Device } from "../types"
import { api } from "../api/client"
import { useAuth } from "../auth/AuthContext"

export function MachinesPage({
  machines,
  onRefresh
}: {
  machines: Machine[]
  onRefresh: () => void
}) {
  const { hasRole } = useAuth()
  const isAdmin = hasRole("admin")

  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(machines[0] || null)
  const [devices, setDevices] = useState<Device[]>([])
  
  // Modals
  const [showMachineModal, setShowMachineModal] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [newDeviceKey, setNewDeviceKey] = useState<string | null>(null)

  // Form states
  const [machineId, setMachineId] = useState("")
  const [machineName, setMachineName] = useState("")
  const [machineType, setMachineType] = useState("AC_MOTOR")
  const [ratedVoltage, setRatedVoltage] = useState(230)
  const [ratedCurrent, setRatedCurrent] = useState(8.5)
  const [ratedTemp, setRatedTemp] = useState(80)
  const [location, setLocation] = useState("")
  const [deviceName, setDeviceName] = useState("")

  useEffect(() => {
    if (machines.length > 0 && !selectedMachine) {
      setSelectedMachine(machines[0])
    }
  }, [machines])

  useEffect(() => {
    if (selectedMachine) {
      api.getDevices(selectedMachine.machine_id)
        .then(setDevices)
        .catch(console.warn)
    }
  }, [selectedMachine?.machine_id])

  const handleCreateMachine = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.registerMachine({
        machine_id: machineId,
        name: machineName,
        type: machineType,
        rated_voltage: Number(ratedVoltage),
        rated_current: Number(ratedCurrent),
        rated_temp_max: Number(ratedTemp),
        location
      })
      setShowMachineModal(false)
      onRefresh()
    } catch (e: any) {
      alert(`Could not register machine: ${e.message}`)
    }
  }

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMachine) return
    try {
      const dev = await api.createDevice(selectedMachine.machine_id, deviceName)
      setDevices((prev) => [...prev, dev])
      setShowDeviceModal(false)
      setNewDeviceKey(dev.api_key || null)
    } catch (e: any) {
      alert(`Could not create device: ${e.message}`)
    }
  }

  return (
    <div className="content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">DEVICE & ASSET MANAGEMENT</span>
          <h1>Industrial Machines & IoT Gateways</h1>
          <p>
            Configure motor hardware ratings, safety envelopes, and issue secure per-device API keys for ESP32 gateways.
          </p>
        </div>
        <div className="intro-actions">
          {isAdmin && (
            <button className="primary-button" onClick={() => setShowMachineModal(true)}>
              <Icon name="plus" /> Register New Motor
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Machines List */}
        <div className="panel" style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "16px", margin: "0 0 16px 0" }}>Registered Motor Assets</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {machines.map((m) => (
              <div
                key={m.machine_id}
                onClick={() => setSelectedMachine(m)}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: m.machine_id === selectedMachine?.machine_id ? "2px solid #3b82f6" : "1px solid #334155",
                  background: m.machine_id === selectedMachine?.machine_id ? "rgba(59, 130, 246, 0.1)" : "#1e293b",
                  cursor: "pointer"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{m.name}</strong>
                  <span style={{ fontSize: "12px", color: "#38bdf8" }}>{m.machine_id}</span>
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  Rated: {m.rated_voltage}V · {m.rated_current}A · Max {m.rated_temp_max}°C | Location: {m.location || "N/A"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Devices for Selected Machine */}
        <div className="panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "16px", margin: 0 }}>
              Gateways for {selectedMachine?.machine_id}
            </h2>
            {isAdmin && selectedMachine && (
              <button
                className="secondary-button"
                onClick={() => setShowDeviceModal(true)}
                style={{ padding: "4px 10px", fontSize: "12px" }}
              >
                <Icon name="plus" size={14} /> Add Gateway
              </button>
            )}
          </div>

          {devices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
              <Icon name="wifi" size={28} />
              <p style={{ marginTop: "8px" }}>No ESP32 gateways registered for this machine yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {devices.map((d) => (
                <div key={d.id} style={{ padding: "12px", background: "#1e293b", borderRadius: "8px", border: "1px solid #334155" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{d.name}</strong>
                    <span style={{ fontSize: "12px", color: d.is_active ? "#4ade80" : "#ef4444" }}>
                      {d.is_active ? "ACTIVE" : "DISABLED"}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                    Last Seen: {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "Never"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Device Key Modal (Show Once!) */}
      {newDeviceKey && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#1e293b", padding: "24px", borderRadius: "10px", width: "450px", border: "1px solid #22c55e" }}>
            <h2 style={{ color: "#4ade80", margin: "0 0 10px 0", fontSize: "18px" }}>New Device API Key Created!</h2>
            <p style={{ fontSize: "14px", color: "#cbd5e1" }}>
              Copy this API key now. For security, it is stored hashed and will <b>never be displayed again</b>:
            </p>
            <div style={{ background: "#0f172a", padding: "12px", borderRadius: "6px", fontFamily: "monospace", color: "#38bdf8", wordBreak: "break-all", marginBottom: "16px", userSelect: "all" }}>
              {newDeviceKey}
            </div>
            <button className="primary-button" style={{ width: "100%" }} onClick={() => setNewDeviceKey(null)}>
              I Have Saved This Key
            </button>
          </div>
        </div>
      )}

      {/* Add Gateway Modal */}
      {showDeviceModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#1e293b", padding: "24px", borderRadius: "10px", width: "400px", border: "1px solid #334155" }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>Create ESP32 Gateway Key</h2>
            <form onSubmit={handleCreateDevice}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Gateway Device Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Line A ESP32 Node 1"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setShowDeviceModal(false)} style={{ padding: "8px 14px", background: "#334155", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">Generate Key</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Machine Modal */}
      {showMachineModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#1e293b", padding: "24px", borderRadius: "10px", width: "450px", border: "1px solid #334155" }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>Register New Motor Asset</h2>
            <form onSubmit={handleCreateMachine}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8" }}>Asset ID</label>
                  <input
                    type="text"
                    required
                    placeholder="MOTOR_002"
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8" }}>Asset Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Pump Motor #2"
                    value={machineName}
                    onChange={(e) => setMachineName(e.target.value)}
                    style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8" }}>Voltage (V)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={ratedVoltage}
                    onChange={(e) => setRatedVoltage(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8" }}>Current (A)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={ratedCurrent}
                    onChange={(e) => setRatedCurrent(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8" }}>Max Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={ratedTemp}
                    onChange={(e) => setRatedTemp(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8" }}>Physical Location</label>
                <input
                  type="text"
                  placeholder="e.g. Line B Assembly"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setShowMachineModal(false)} style={{ padding: "8px 14px", background: "#334155", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">Register Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
