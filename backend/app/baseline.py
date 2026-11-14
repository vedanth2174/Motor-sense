import numpy as np
from sklearn.ensemble import IsolationForest

FEATURES = [
    "temperature",
    "current",
    "voltage",
    "vibration"
]

MINIMUM_READINGS = 500


def prepare_readings(readings):
    valid = []

    for reading in readings:
        raw_values = [getattr(reading, feature, None) for feature in FEATURES]

        try:
            values = [float(value) for value in raw_values]
        except (TypeError, ValueError):
            continue

        if not np.isfinite(values).all():
            continue

        if any(value < 0 for value in values):
            continue

        valid.append(values)

    return np.asarray(valid, dtype=float).reshape(-1, len(FEATURES))


def assess_baseline(readings):
    data = prepare_readings(readings)

    if len(data) < MINIMUM_READINGS:
        return {
            "status": "COLLECTING_BASELINE",
            "usable_readings": len(data),
            "required_readings": MINIMUM_READINGS,
            "message": "Collecting more valid sensor readings."
        }

    return {
        "status": "VALIDATION_REQUIRED",
        "usable_readings": len(data),
        "required_readings": MINIMUM_READINGS,
        "message": (
            "Enough readings are available for initial analysis. "
            "Verify healthy operation and operating-condition coverage "
            "before training the baseline model."
        )
    }


def train_baseline(readings):
    data = prepare_readings(readings)

    if len(data) < MINIMUM_READINGS:
        raise ValueError(
            f"At least {MINIMUM_READINGS} valid readings are required."
        )

    model = IsolationForest(
        n_estimators=100,
        contamination="auto",
        random_state=42
    )

    model.fit(data)

    return model


def detect_anomaly(model, temperature, current, voltage, vibration):
    try:
        sample = np.asarray([[
            temperature,
            current,
            voltage,
            vibration
        ]], dtype=float)
    except (TypeError, ValueError):
        raise ValueError("All sensor values must be numeric and available.")

    if not np.isfinite(sample).all() or (sample < 0).any():
        raise ValueError("Sensor values must be finite and non-negative.")

    prediction = model.predict(sample)[0]

    return {
        "result": "ANOMALY" if prediction == -1 else "NORMAL_PATTERN",
        "score": float(model.decision_function(sample)[0])
    }
