import json
from typing import Dict, Any, List
from app.models.all_models import Machine, SensorReading, Alert, MaintenanceRecord
import numpy as np


SYSTEM_PROMPT = """You are MotorSense AI, an expert industrial electrical and mechanical engineer specializing in AC induction motor predictive maintenance.
Analyze the provided motor metrics, sensor telemetry window, active alerts, and maintenance history.

Rules:
1. Base your diagnosis strictly on the supplied engineering numbers and alert history.
2. If data is sparse or indeterminate, state "insufficient data" clearly in your analysis.
3. NEVER override rule-based critical alerts.
4. You MUST respond with valid JSON ONLY matching this exact structure:
{
  "summary": "Brief 1-2 sentence engineering diagnosis",
  "likely_causes": ["Cause 1", "Cause 2"],
  "severity": "low" | "medium" | "high",
  "recommended_actions": ["Action 1", "Action 2"],
  "confidence": "low" | "medium" | "high"
}
"""


def build_compact_window_summary(
    machine: Machine,
    readings: List[SensorReading],
    alerts: List[Alert],
    maintenance_records: List[MaintenanceRecord]
) -> Dict[str, Any]:
    features = ["temperature", "humidity", "current", "voltage", "vibration"]
    stats: Dict[str, Any] = {}

    for feat in features:
        vals = [getattr(r, feat) for r in readings if getattr(r, feat) is not None and np.isfinite(getattr(r, feat))]
        if vals:
            trend = "stable"
            if len(vals) >= 5:
                first_half = np.mean(vals[:len(vals)//2])
                second_half = np.mean(vals[len(vals)//2:])
                diff = second_half - first_half
                if diff > 0.05 * first_half:
                    trend = "rising"
                elif diff < -0.05 * first_half:
                    trend = "falling"

            stats[feat] = {
                "min": round(float(np.min(vals)), 2),
                "mean": round(float(np.mean(vals)), 2),
                "max": round(float(np.max(vals)), 2),
                "latest": round(float(vals[-1]), 2),
                "trend": trend
            }
        else:
            stats[feat] = None

    active_alert_msgs = [f"[{a.severity.upper()}] {a.message}" for a in alerts[:5]]
    recent_maint = [f"{m.created_at.strftime('%Y-%m-%d')}: {m.description} ({m.status})" for m in maintenance_records[:3]]

    summary = {
        "machine_id": machine.machine_id,
        "machine_name": machine.name,
        "machine_type": machine.type,
        "rated_specs": {
            "voltage": machine.rated_voltage,
            "current": machine.rated_current,
            "max_temp": machine.rated_temp_max
        },
        "telemetry_window_samples": len(readings),
        "sensor_stats": stats,
        "recent_alerts": active_alert_msgs,
        "recent_maintenance": recent_maint
    }
    return summary


def build_user_prompt(summary: Dict[str, Any]) -> str:
    return f"""Please perform an engineering predictive maintenance diagnosis for the following motor telemetry data:
```json
{json.dumps(summary, indent=2)}
```
Respond ONLY with the JSON schema requested."""
