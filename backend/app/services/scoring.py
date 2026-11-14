import os
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import joblib
import numpy as np
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.models.all_models import Machine, SensorReading, MachineBaseline, Alert
from app.services.rules import evaluate_threshold_rules, RuleViolation
from app.services.baseline import FEATURES

# Cache for loaded models: machine_id -> (version, model_object)
_cached_models: Dict[str, Tuple[str, Any]] = {}


def get_loaded_model(machine_id: str, db: Session) -> Optional[Any]:
    baseline = db.query(MachineBaseline).filter(
        MachineBaseline.machine_id == machine_id,
        MachineBaseline.status == "TRAINED"
    ).first()

    if not baseline or not baseline.model_path or not os.path.exists(baseline.model_path):
        return None

    cached = _cached_models.get(machine_id)
    if cached and cached[0] == baseline.model_version:
        return cached[1]

    try:
        model = joblib.load(baseline.model_path)
        _cached_models[machine_id] = (baseline.model_version, model)
        logger.info(f"Loaded ML model version {baseline.model_version} for {machine_id}")
        return model
    except Exception as e:
        logger.error(f"Failed to load model from {baseline.model_path}: {e}")
        return None


def score_reading(
    machine: Machine,
    reading: SensorReading,
    db: Session
) -> Dict[str, Any]:
    """
    Executes layered detection pipeline:
    1. Validation: physical validity
    2. Rules: deterministic over-limit checks
    3. ML Baseline: Isolation Forest anomaly score
    4. Condition determination (SAFE, WARNING, CRITICAL, SENSOR ERROR)
    5. Alert generation
    """
    rule_violations = evaluate_threshold_rules(machine, reading)
    
    # Check ML anomaly if model exists and reading has all features
    ml_anomaly = False
    anomaly_score = None
    model = get_loaded_model(machine.machine_id, db)

    if model is not None and reading.is_valid:
        vals = [getattr(reading, feat, None) for feat in FEATURES]
        if all(v is not None and np.isfinite(v) for v in vals):
            sample = np.asarray([vals], dtype=float)
            try:
                # Decision function: lower values mean more anomalous; < 0 is anomaly
                raw_score = float(model.decision_function(sample)[0])
                anomaly_score = round(raw_score, 4)
                prediction = int(model.predict(sample)[0])
                ml_anomaly = (prediction == -1)
            except Exception as e:
                logger.warning(f"Model inference error on {machine.machine_id}: {e}")

    # Determine condition
    critical_rules = [v for v in rule_violations if v.severity == "critical"]
    warning_rules = [v for v in rule_violations if v.severity == "warning"]

    if not reading.is_valid:
        condition = "SENSOR ERROR"
        status_text = "SENSOR ERROR"
    elif critical_rules:
        condition = "CRITICAL"
        status_text = "CRITICAL"
    elif warning_rules or ml_anomaly:
        condition = "WARNING"
        status_text = "WARNING"
    else:
        condition = "SAFE"
        status_text = "SAFE"

    # Persist score to reading
    reading.condition = condition
    reading.anomaly_score = anomaly_score

    # Create alerts if needed
    for v in rule_violations:
        alert = Alert(
            machine_id=machine.machine_id,
            severity=v.severity,
            source="rule",
            message=v.message,
            reading_id=reading.id
        )
        db.add(alert)

    if ml_anomaly and not rule_violations:
        alert = Alert(
            machine_id=machine.machine_id,
            severity="warning",
            source="ml",
            message=f"Statistical anomaly detected by baseline model (score: {anomaly_score})",
            reading_id=reading.id
        )
        db.add(alert)

    db.commit()

    # Recommendations
    if condition == "CRITICAL":
        rec = "Immediate inspection required. Motor operating outside safe operational envelope."
    elif condition == "WARNING":
        rec = "Advisory: Schedule preventive inspection. Elevated physical or statistical readings."
    elif condition == "SENSOR ERROR":
        rec = "Check sensor wiring, power supply, or ESP32 calibration."
    else:
        rec = "Motor operating within normal healthy baseline parameters."

    return {
        "machine_id": machine.machine_id,
        "condition": condition,
        "status": status_text,
        "anomaly_score": anomaly_score,
        "rule_violations": [v.message for v in rule_violations],
        "ml_anomaly": ml_anomaly,
        "has_trained_model": model is not None,
        "confidence": 0.95 if rule_violations else (0.88 if model is not None else 0.70),
        "recommendation": rec
    }
