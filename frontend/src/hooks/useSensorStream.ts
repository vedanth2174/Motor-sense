import { useEffect, useState, useRef } from "react"
import { Reading, Status } from "../types"
import { api } from "../api/client"

export function useSensorStream(machineId: string) {
  const [readings, setReadings] = useState<Reading[]>([])
  const [latestReading, setLatestReading] = useState<Reading | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>("Connecting...")
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true

    // 1. Initial history fetch
    const loadInitialHistory = async () => {
      try {
        const history = await api.getReadings(machineId, 60)
        if (active && Array.isArray(history)) {
          const mapped: Reading[] = history.map((r: any) => ({
            id: r.id,
            timestamp: r.recorded_at || r.timestamp,
            temperature: r.temperature,
            humidity: r.humidity,
            current: r.current,
            voltage: r.voltage,
            vibration: r.vibration,
            condition: r.condition,
            status: r.condition as Status,
            anomaly_score: r.anomaly_score
          }))
          setReadings(mapped)
          if (mapped.length > 0) {
            setLatestReading(mapped[0])
            setLastUpdated(new Date(mapped[0].timestamp).toLocaleTimeString())
          }
        }
      } catch (err) {
        console.warn("Could not fetch initial reading history:", err)
      }
    }

    loadInitialHistory()

    // 2. Setup Server-Sent Events (SSE)
    const connectSSE = () => {
      try {
        const streamUrl = api.getStreamUrl(machineId)
        const es = new EventSource(streamUrl)
        eventSourceRef.current = es

        es.onopen = () => {
          if (active) {
            setIsLive(true)
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
          }
        }

        es.onmessage = (event) => {
          if (!active) return
          try {
            const raw = JSON.parse(event.data)
            if (raw.type === "reading" && raw.data) {
              const r = raw.data
              const newReading: Reading = {
                id: r.id,
                timestamp: r.recorded_at,
                temperature: r.temperature,
                humidity: r.humidity,
                current: r.current,
                voltage: r.voltage,
                vibration: r.vibration,
                condition: r.condition,
                status: r.condition as Status,
                anomaly_score: r.anomaly_score
              }

              setReadings((prev) => [newReading, ...prev.slice(0, 99)])
              setLatestReading(newReading)
              setIsLive(true)
              setLastUpdated(new Date(r.recorded_at).toLocaleTimeString())
            }
          } catch (e) {
            // ignore parse errors
          }
        }

        es.onerror = () => {
          if (active) {
            setIsLive(false)
            es.close()
            startPollingFallback()
          }
        }
      } catch (e) {
        startPollingFallback()
      }
    }

    // 3. Fallback Polling if SSE is unavailable or disconnects
    const startPollingFallback = () => {
      if (pollingRef.current) return
      console.info("Using polling fallback (every 4s) for machine:", machineId)

      const poll = async () => {
        try {
          const latest = await api.getLatestReading(machineId)
          if (active && latest && latest.reading) {
            const r = latest.reading
            const newReading: Reading = {
              id: r.id,
              timestamp: r.recorded_at,
              temperature: r.temperature,
              humidity: r.humidity,
              current: r.current,
              voltage: r.voltage,
              vibration: r.vibration,
              condition: latest.condition,
              status: latest.status as Status,
              anomaly_score: latest.anomaly_score
            }
            setLatestReading(newReading)
            setIsLive(true)
            setLastUpdated(new Date().toLocaleTimeString())
          }
        } catch (e) {
          if (active) setIsLive(false)
        }
      }

      poll()
      pollingRef.current = window.setInterval(poll, 4000)
    }

    connectSSE()

    return () => {
      active = false
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [machineId])

  return { readings, latestReading, isLive, lastUpdated }
}
