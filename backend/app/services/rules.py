from typing import List, Dict, Any, Optional
from app.models.all_models import Machine, SensorReading


class RuleViolation:
    def __init__(self, severity: str, message: str, metric: str, value: float, threshold: float):
        self.severity = severity  # "warning" or "critical"
        self.message = message
        self.metric = metric
        self.value = value
        self.threshold = threshold


def evaluate_threshold_rules(machine: Machine, reading: SensorReading) -> List[RuleViolation]:
    """
    Evaluates deterministic physical safety rules against the machine's rated parameters.
    Rules:
    - Current > 110% rated -> CRITICAL
    - Current > 100% rated -> WARNING
    - Voltage outside ±10% rated -> CRITICAL
    - Voltage outside ±5% rated -> WARNING
    - Temperature > rated_temp_max -> CRITICAL
    - Temperature > rated_temp_max - 10 -> WARNING
    - Vibration > 4.5 m/s² -> CRITICAL
    - Vibration > 2.8 m/s² -> WARNING
    """
    violations: List[RuleViolation] = []

    # Current checks
    if reading.current is not None and machine.rated_current > 0:
        if reading.current > (machine.rated_current * 1.10):
            violations.append(RuleViolation(
                severity="critical",
                message=f"Overcurrent detected: {reading.current:.2f}A exceeds 110% rated ({machine.rated_current * 1.10:.2f}A)",
                metric="current",
                value=reading.current,
                threshold=machine.rated_current * 1.10
            ))
        elif reading.current > machine.rated_current:
            violations.append(RuleViolation(
                severity="warning",
                message=f"Elevated current: {reading.current:.2f}A exceeds rated {machine.rated_current:.2f}A",
                metric="current",
                value=reading.current,
                threshold=machine.rated_current
            ))

    # Voltage checks
    if reading.voltage is not None and machine.rated_voltage > 0:
        v_low_crit = machine.rated_voltage * 0.90
        v_high_crit = machine.rated_voltage * 1.10
        v_low_warn = machine.rated_voltage * 0.95
        v_high_warn = machine.rated_voltage * 1.05

        if reading.voltage < v_low_crit or reading.voltage > v_high_crit:
            violations.append(RuleViolation(
                severity="critical",
                message=f"Severe voltage anomaly: {reading.voltage:.1f}V outside ±10% rated ({v_low_crit:.1f}V - {v_high_crit:.1f}V)",
                metric="voltage",
                value=reading.voltage,
                threshold=v_high_crit if reading.voltage > v_high_crit else v_low_crit
            ))
        elif reading.voltage < v_low_warn or reading.voltage > v_high_warn:
            violations.append(RuleViolation(
                severity="warning",
                message=f"Moderate voltage deviation: {reading.voltage:.1f}V outside ±5% rated ({v_low_warn:.1f}V - {v_high_warn:.1f}V)",
                metric="voltage",
                value=reading.voltage,
                threshold=v_high_warn if reading.voltage > v_high_warn else v_low_warn
            ))

    # Temperature checks
    if reading.temperature is not None and machine.rated_temp_max > 0:
        if reading.temperature > machine.rated_temp_max:
            violations.append(RuleViolation(
                severity="critical",
                message=f"Critical motor overtemperature: {reading.temperature:.1f}°C exceeds max rating {machine.rated_temp_max:.1f}°C",
                metric="temperature",
                value=reading.temperature,
                threshold=machine.rated_temp_max
            ))
        elif reading.temperature > (machine.rated_temp_max - 10.0):
            violations.append(RuleViolation(
                severity="warning",
                message=f"Elevated motor temperature: {reading.temperature:.1f}°C approaches thermal limit ({machine.rated_temp_max:.1f}°C)",
                metric="temperature",
                value=reading.temperature,
                threshold=machine.rated_temp_max - 10.0
            ))

    # Vibration checks (ISO 10816 standards for small/medium industrial motors)
    if reading.vibration is not None:
        if reading.vibration > 4.5:
            violations.append(RuleViolation(
                severity="critical",
                message=f"Severe vibration severity: {reading.vibration:.2f} m/s² exceeds ISO limit 4.50 m/s²",
                metric="vibration",
                value=reading.vibration,
                threshold=4.5
            ))
        elif reading.vibration > 2.8:
            violations.append(RuleViolation(
                severity="warning",
                message=f"Elevated vibration: {reading.vibration:.2f} m/s² exceeds ISO advisory threshold 2.80 m/s²",
                metric="vibration",
                value=reading.vibration,
                threshold=2.8
            ))

    return violations
