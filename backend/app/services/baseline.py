import numpy as np
from typing import List, Dict, Any, Tuple
from app.models.all_models import SensorReading

FEATURES = ["temperature", "humidity", "current", "voltage", "vibration"]
MINIMUM_READINGS = 500


def prepare_readings_matrix(readings: List[SensorReading]) -> Tuple[np.ndarray, List[int]]:
    """
    Extracts valid numerical feature matrix for Isolation Forest.
    Returns (feature_matrix, reading_ids).
    """
    valid_rows = []
    valid_ids = []

    for reading in readings:
        if not reading.is_valid:
            continue
        
        values = []
        for feat in FEATURES:
            val = getattr(reading, feat, None)
            if val is None or not np.isfinite(val):
                break
            values.append(float(val))

        if len(values) == len(FEATURES) and all(v >= 0 for v in values):
            valid_rows.append(values)
            valid_ids.append(reading.id)

    if not valid_rows:
        return np.empty((0, len(FEATURES)), dtype=float), []

    return np.asarray(valid_rows, dtype=float), valid_ids


def assess_baseline(readings: List[SensorReading], min_readings: int = MINIMUM_READINGS) -> Dict[str, Any]:
    matrix, _ = prepare_readings_matrix(readings)
    usable_count = len(matrix)

    if usable_count < min_readings:
        return {
            "status": "COLLECTING_BASELINE",
            "usable_readings": usable_count,
            "required_readings": min_readings,
            "message": f"Collecting valid baseline data ({usable_count}/{min_readings})."
        }

    return {
        "status": "VALIDATION_REQUIRED",
        "usable_readings": usable_count,
        "required_readings": min_readings,
        "message": (
            f"Collected {usable_count} readings. Ready for engineer verification "
            "and baseline training."
        )
    }
