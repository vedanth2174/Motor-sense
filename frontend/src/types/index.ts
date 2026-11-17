export type Page =
  | "Dashboard"
  | "Live Monitoring"
  | "Motor Health"
  | "Prediction"
  | "AI Diagnostics"
  | "Alerts"
  | "History"
  | "Maintenance Records"
  | "Machines & Devices"
  | "Data Export"

export type SensorKey = "temperature" | "humidity" | "current" | "voltage" | "vibration"

export type Status = "SAFE" | "WARNING" | "CRITICAL" | "SENSOR ERROR" | "NO DATA"

export interface SensorMetadata {
  key: SensorKey
  label: string
  unit: string
  icon: string
  color: string
  range: string
}

export interface Reading {
  id?: number
  timestamp: string
  temperature: number | null
  humidity: number | null
  current: number | null
  voltage: number | null
  vibration: number | null
  condition?: string
  status?: Status
  anomaly_score?: number | null
  prediction?: string
  confidence?: number
  faultClass?: string
  recommendation?: string
}

export interface Machine {
  id: number
  machine_id: string
  name: string
  type: string
  rated_voltage: number
  rated_current: number
  rated_temp_max: number
  location?: string
  learning_status: string
  created_at: string
}

export interface Device {
  id: number
  machine_id: string
  name: string
  is_active: boolean
  last_seen_at?: string
  created_at: string
  api_key?: string
}

export interface Alert {
  id: number
  machine_id: string
  severity: "info" | "warning" | "critical"
  source: "rule" | "ml"
  message: string
  reading_id?: number
  acknowledged_by?: string
  acknowledged_at?: string
  created_at: string
}

export interface MaintenanceRecord {
  id?: number
  machine_id: string
  description: string
  status: string
  scheduled_for?: string
  completed_at?: string
  created_by?: string
  created_at: string
}

export interface AiAnalysisOutput {
  summary: string
  likely_causes: string[]
  severity: "low" | "medium" | "high"
  recommended_actions: string[]
  confidence: "low" | "medium" | "high"
}

export interface AiAnalysis {
  id: number
  machine_id: string
  window_start: string
  window_end: string
  provider: string
  model: string
  input_summary: any
  output: AiAnalysisOutput
  latency_ms: number
  created_at: string
  ai_available: boolean
}

export interface UserProfile {
  username: string
  fullName?: string
  email?: string
  roles: string[]
  roleName?: string
  isAdmin: boolean
  isEngineer: boolean
  isOperator?: boolean
}
