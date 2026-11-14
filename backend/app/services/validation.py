import numpy as np
from typing import List, Dict, Any, Tuple
from app.models.all_models import SensorReading

FEATURES = ["temperature", "current", "voltage", "vibration"]
MINIMUM_READINGS = 500


def validate_sensor_reading(
    temperature: float | None,
    humidity: float | None,
    current: float | None,
    voltage: float | None,
    vibration: float | None
) -> Tuple[bool, List[str]]:
    """
    Checks physical plausibility of a single sensor reading.
    Returns (is_valid, list_of_errors).
    """
    errors = []
    
    if temperature is not None:
        if not np.isfinite(temperature) or temperature < -40 or temperature > 150:
            errors.append(f"Temperature out of plausible range (-40 to 150°C): {temperature}")

    if humidity is not None:
        if not np.isfinite(humidity) or humidity < 0 or humidity > 100:
            errors.append(f"Humidity out of range (0 to 100%): {humidity}")

    if current is not None:
        if not np.isfinite(current) or current < 0 or current > 100:
            errors.append(f"Current out of range (0 to 100A): {current}")

    if voltage is not None:
        if not np.isfinite(voltage) or voltage < 0 or voltage > 600:
            errors.append(f"Voltage out of range (0 to 600V): {voltage}")

    if vibration is not None:
        if not np.isfinite(vibration) or vibration < 0 or vibration > 100:
            errors.append(f"Vibration out of range (0 to 100 m/s²): {vibration}")

    is_valid = len(errors) == 0
    return is_valid, errors


def validate_baseline(readings: List[SensorReading], min_readings: int = MINIMUM_READINGS) -> Dict[str, Any]:
    valid_rows = []

    for reading in readings:
        if not reading.is_valid:
            continue
        values = [getattr(reading, key, None) for key in FEATURES]
        try:
            values = [float(v) for v in values if v is not None]
        except (TypeError, ValueError):
            continue

        if len(values) == len(FEATURES) and np.isfinite(values).all() and all(v >= 0 for v in values):
            valid_rows.append(values)

    count = len(valid_rows)

    if count < min_readings:
        return {
            "ready": False,
            "status": "COLLECTING_BASELINE",
            "usable_readings": count,
            "required_readings": min_readings,
            "message": f"Collecting sensor readings ({count}/{min_readings})."
        }

    data = np.asarray(valid_rows)
    statistics = {}

    for index, feature in enumerate(FEATURES):
        statistics[feature] = {
            "mean": round(float(np.mean(data[:, index])), 4),
            "std": round(float(np.std(data[:, index])), 4),
            "min": round(float(np.min(data[:, index])), 4),
            "max": round(float(np.max(data[:, index])), 4)
        }

    return {
        "ready": True,
        "status": "VALIDATION_REQUIRED",
        "usable_readings": count,
        "required_readings": min_readings,
        "statistics": statistics,
        "message": (
            "Sufficient readings collected. Verify stability, calibration, "
            "and healthy operational envelope before baseline model training."
        )
    }
