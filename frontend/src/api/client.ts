import { getRuntimeConfig } from "../auth/keycloak"
import { Reading, Machine, Device, Alert, MaintenanceRecord, AiAnalysis } from "../types"

class ApiClient {
  private getBaseUrl(): string {
    return getRuntimeConfig().API_BASE_URL.replace(/\/$/, "")
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`
    const headers = new Headers(options.headers || {})

    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json")
    }

    // Attach JWT if available
    const token = (window as any).__MOTORSENSE_TOKEN__
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error [${response.status}]: ${errorText || response.statusText}`)
    }

    return response.json()
  }

  // --- Machines ---
  async getMachines(): Promise<Machine[]> {
    return this.request<Machine[]>("/api/v1/machines")
  }

  async registerMachine(data: Partial<Machine>): Promise<Machine> {
    return this.request<Machine>("/api/v1/machines", {
      method: "POST",
      body: JSON.stringify(data)
    })
  }

  async getLatestReading(machineId: string): Promise<any> {
    return this.request<any>(`/api/v1/machines/${machineId}/latest`)
  }

  async getReadings(machineId: string, limit = 100): Promise<Reading[]> {
    return this.request<Reading[]>(`/api/v1/machines/${machineId}/readings?limit=${limit}`)
  }

  // --- Baseline & Training ---
  async getBaselineStatus(machineId: string): Promise<any> {
    return this.request<any>(`/api/v1/machines/${machineId}/baseline`)
  }

  async approveBaseline(machineId: string): Promise<any> {
    return this.request<any>(`/api/v1/machines/${machineId}/baseline/approve`, {
      method: "POST",
      body: JSON.stringify({ confirmed_healthy: true })
    })
  }

  async trainBaseline(machineId: string): Promise<any> {
    return this.request<any>(`/api/v1/machines/${machineId}/baseline/train`, {
      method: "POST"
    })
  }

  async predict(machineId: string): Promise<any> {
    return this.request<any>(`/api/v1/machines/${machineId}/predict`, {
      method: "POST"
    })
  }

  // --- Alerts ---
  async getAlerts(machineId?: string): Promise<Alert[]> {
    const query = machineId ? `?machine_id=${machineId}` : ""
    return this.request<Alert[]>(`/api/v1/alerts${query}`)
  }

  async acknowledgeAlert(alertId: number, acknowledgedBy?: string): Promise<Alert> {
    return this.request<Alert>(`/api/v1/alerts/${alertId}/ack`, {
      method: "POST",
      body: JSON.stringify({ acknowledged_by: acknowledgedBy })
    })
  }

  // --- Maintenance ---
  async getMaintenance(machineId?: string): Promise<MaintenanceRecord[]> {
    const query = machineId ? `?machine_id=${machineId}` : ""
    return this.request<MaintenanceRecord[]>(`/api/v1/maintenance${query}`)
  }

  async addMaintenance(record: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    return this.request<MaintenanceRecord>("/api/v1/maintenance", {
      method: "POST",
      body: JSON.stringify(record)
    })
  }

  // --- AI Analysis ---
  async runAiAnalysis(machineId: string, windowMinutes = 30): Promise<AiAnalysis> {
    return this.request<AiAnalysis>(`/api/v1/machines/${machineId}/analyze`, {
      method: "POST",
      body: JSON.stringify({ window_minutes: windowMinutes })
    })
  }

  async getAiAnalyses(machineId: string): Promise<AiAnalysis[]> {
    return this.request<AiAnalysis[]>(`/api/v1/machines/${machineId}/analyses`)
  }

  // --- Devices ---
  async getDevices(machineId: string): Promise<Device[]> {
    return this.request<Device[]>(`/api/v1/machines/${machineId}/devices`)
  }

  async createDevice(machineId: string, name: string): Promise<Device> {
    return this.request<Device>(`/api/v1/machines/${machineId}/devices`, {
      method: "POST",
      body: JSON.stringify({ name })
    })
  }

  // --- SSE Stream URL ---
  getStreamUrl(machineId: string): string {
    return `${this.getBaseUrl()}/api/v1/stream/${machineId}`
  }

  // --- CSV Export URL ---
  getCsvUrl(machineId: string): string {
    return `${this.getBaseUrl()}/download.csv?machine_id=${machineId}`
  }
}

export const api = new ApiClient()
