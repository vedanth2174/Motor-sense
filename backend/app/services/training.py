import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.models.all_models import Machine, SensorReading, MachineBaseline
from app.services.baseline import prepare_readings_matrix, FEATURES


def train_and_persist_baseline(
    machine_id: str,
    db: Session,
    min_samples: Optional[int] = None
) -> Dict[str, Any]:
    min_required = min_samples or settings.BASELINE_MIN_SAMPLES

    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise ValueError(f"Machine {machine_id} does not exist.")

    readings = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .order_by(SensorReading.recorded_at.asc())
        .all()
    )

    matrix, ids = prepare_readings_matrix(readings)
    if len(matrix) < min_required:
        raise ValueError(
            f"Insufficient valid readings for machine {machine_id}: "
            f"have {len(matrix)}, required {min_required}."
        )

    # Train Isolation Forest
    model = IsolationForest(
        n_estimators=100,
        contamination=0.03,
        random_state=42
    )
    model.fit(matrix)

    # Compute baseline metrics
    feature_stats = {}
    for idx, feat in enumerate(FEATURES):
        feature_stats[feat] = {
            "mean": float(np.mean(matrix[:, idx])),
            "std": float(np.std(matrix[:, idx])),
            "min": float(np.min(matrix[:, idx])),
            "max": float(np.max(matrix[:, idx]))
        }

    # Versioning & model directory
    model_dir = Path(settings.MODEL_DIR) / machine_id
    model_dir.mkdir(parents=True, exist_ok=True)

    version = f"v_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    model_filename = f"{version}.joblib"
    model_path = model_dir / model_filename

    joblib.dump(model, str(model_path))
    logger.info(f"Saved trained baseline model to {model_path}")

    # Register in DB
    baseline = db.query(MachineBaseline).filter(MachineBaseline.machine_id == machine_id).first()
    now = datetime.now(timezone.utc)
    if not baseline:
        baseline = MachineBaseline(machine_id=machine_id)
        db.add(baseline)

    baseline.status = "TRAINED"
    baseline.sample_count = len(matrix)
    baseline.model_version = version
    baseline.model_path = str(model_path)
    baseline.metrics = feature_stats
    baseline.trained_at = now

    machine.learning_status = "HEALTHY_BASELINE_READY"
    db.commit()
    db.refresh(baseline)

    return {
        "machine_id": machine_id,
        "status": baseline.status,
        "model_version": version,
        "sample_count": len(matrix),
        "trained_at": now.isoformat(),
        "metrics": feature_stats
    }
