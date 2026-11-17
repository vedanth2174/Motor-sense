import React, { useState, useEffect } from "react"
import { Sidebar } from "./components/Sidebar"
import { Header } from "./components/Header"
import { Dashboard } from "./pages/Dashboard"
import { LiveMonitoringPage } from "./pages/LiveMonitoringPage"
import { MotorHealthPage } from "./pages/MotorHealthPage"
import { PredictionPage } from "./pages/PredictionPage"
import { AiAnalysisPage } from "./pages/AiAnalysisPage"
import { AlertsPage } from "./pages/AlertsPage"
import { HistoryPage } from "./pages/HistoryPage"
import { MaintenancePage } from "./pages/MaintenancePage"
import { MachinesPage } from "./pages/MachinesPage"
import { DataExportPage } from "./pages/DataExportPage"
import { AuthProvider, useAuth } from "./auth/AuthContext"
import { AuthScreen } from "./components/AuthScreen"
import { Icon } from "./components/Icons"
import { useSensorStream } from "./hooks/useSensorStream"
import { Page, Machine, Reading } from "./types"
import { api } from "./api/client"

function MotorSenseApp() {
  const { authenticated, login, loginAs } = useAuth()
  const [page, setPage] = useState<Page>("Dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [machines, setMachines] = useState<Machine[]>([])
  const [selectedMachineId, setSelectedMachineId] = useState<string>("MOTOR_001")
  const [alertCount, setAlertCount] = useState<number>(0)

  // Load machines
  const loadMachines = async () => {
    try {
      const data = await api.getMachines()
      setMachines(data)
      if (data.length > 0 && !data.some((m) => m.machine_id === selectedMachineId)) {
        setSelectedMachineId(data[0].machine_id)
      }
    } catch (e) {
      console.warn("Could not fetch machines list:", e)
      // Provide fallback machine for offline dev
      setMachines([
        {
          id: 1,
          machine_id: "MOTOR_001",
          name: "AC Motor 01",
          type: "AC_MOTOR",
          rated_voltage: 230,
          rated_current: 8.5,
          rated_temp_max: 80,
          location: "Production Line A",
          learning_status: "COLLECTING_BASELINE",
          created_at: new Date().toISOString()
        }
      ])
    }
  }

  useEffect(() => {
    loadMachines()
  }, [])

  // Poll active alert count
  useEffect(() => {
    const checkAlerts = async () => {
      try {
        const alerts = await api.getAlerts(selectedMachineId)
        const unack = alerts.filter((a) => !a.acknowledged_at)
        setAlertCount(unack.length)
      } catch (e) {
        // ignore
      }
    }
    checkAlerts()
    const interval = setInterval(checkAlerts, 10000)
    return () => clearInterval(interval)
  }, [selectedMachineId])

  // Real-time sensor stream
  const { readings, latestReading, isLive, lastUpdated } = useSensorStream(selectedMachineId)

  const activeMachine = machines.find((m) => m.machine_id === selectedMachineId) || machines[0]

  const fallbackReading: Reading = {
    timestamp: "Awaiting telemetry",
    temperature: null,
    humidity: null,
    current: null,
    voltage: null,
    vibration: null,
    condition: "UNKNOWN",
    status: isLive ? "SAFE" : "NO DATA"
  }

  const latest = latestReading || fallbackReading

  if (!authenticated) {
    return <AuthScreen />
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        setPage={setPage}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        machines={machines}
        selectedMachineId={selectedMachineId}
        setSelectedMachineId={setSelectedMachineId}
        isLive={isLive}
        alertCount={alertCount}
      />

      <main>
        <Header
          page={page}
          setSidebarOpen={setSidebarOpen}
          isLive={isLive}
          lastUpdated={lastUpdated}
          alertCount={alertCount}
          onNavigateToAlerts={() => setPage("Alerts")}
        />

        <div className="content">
          {page === "Dashboard" && (
            <Dashboard
              machine={activeMachine}
              readings={readings}
              latest={latest}
              isLive={isLive}
              setPage={setPage}
              alertCount={alertCount}
            />
          )}

          {page === "Live Monitoring" && (
            <LiveMonitoringPage
              machine={activeMachine}
              readings={readings}
              latest={latest}
              isLive={isLive}
            />
          )}

          {page === "Motor Health" && (
            <MotorHealthPage
              machine={activeMachine}
              latest={latest}
              onRefreshMachine={loadMachines}
            />
          )}

          {page === "Prediction" && (
            <PredictionPage
              machine={activeMachine}
              latest={latest}
            />
          )}

          {page === "AI Diagnostics" && (
            <AiAnalysisPage
              machine={activeMachine}
            />
          )}

          {page === "Alerts" && (
            <AlertsPage
              machine={activeMachine}
            />
          )}

          {page === "History" && (
            <HistoryPage
              machine={activeMachine}
              readings={readings}
            />
          )}

          {page === "Maintenance Records" && (
            <MaintenancePage
              machine={activeMachine}
            />
          )}

          {page === "Machines & Devices" && (
            <MachinesPage
              machines={machines}
              onRefresh={loadMachines}
            />
          )}

          {page === "Data Export" && (
            <DataExportPage
              machine={activeMachine}
              readings={readings}
            />
          )}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MotorSenseApp />
    </AuthProvider>
  )
}
