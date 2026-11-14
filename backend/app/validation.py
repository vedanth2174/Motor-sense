
import numpy as np

FEATURES = ["temperature", "current", "voltage", "vibration"]
MINIMUM_READINGS = 500


def validate_baseline(readings):
    valid_rows = []

    for reading in readings:
        values = [getattr(reading, key, None) for key in FEATURES]

        try:
            values = [float(value) for value in values]
        except (TypeError, ValueError):
            continue

        if not np.isfinite(values).all():
            continue

        if any(value < 0 for value in values):
            continue

        valid_rows.append(values)

    count = len(valid_rows)

    if count < MINIMUM_READINGS:
        return {
            "ready": False,
            "status": "COLLECTING_BASELINE",
            "usable_readings": count,
            "required_readings": MINIMUM_READINGS,
            "message": "More valid readings are required."
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
        "ready": False,
        "status": "VALIDATION_REQUIRED",
        "usable_readings": count,
        "required_readings": MINIMUM_READINGS,
        "statistics": statistics,
        "message": (
            "Data quantity is sufficient for review. Verify sensor "
            "calibration, healthy operation, stability and operating "
            "condition coverage before training."
        )
    }
