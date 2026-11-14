from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_role, generate_api_key, hash_api_key
from app.db.session import get_db
from app.models.all_models import Machine, SensorReading, MachineBaseline, Device, Alert, MaintenanceRecord, AiAnalysis
from app.schemas.all_schemas import (
    MachineCreate, MachineResponse,
    DeviceCreate, DeviceCreatedWithKey, DeviceResponse,
    SensorReadingResponse,
    BaselineStatusResponse, BaselineApprovalRequest,
    PredictResponse,
    AiAnalysisRequest, AiAnalysisResponse
)
from app.services.baseline import assess_baseline
from app.services.validation import validate_baseline
from app.services.training import train_and_persist_baseline
from app.services.scoring import score_reading, get_loaded_model
from app.services.rules import evaluate_threshold_rules
from app.services.llm.prompts import SYSTEM_PROMPT, build_compact_window_summary, build_user_prompt
from app.services.llm.providers import get_llm_provider

router = APIRouter(prefix="/machines", tags=["machines"])


@router.get("", response_model=List[MachineResponse])
def list_machines(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    return db.query(Machine).order_by(Machine.id.asc()).all()


@router.post("", response_model=MachineResponse, status_code=status.HTTP_201_CREATED)
def register_machine(
    payload: MachineCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin"))
):
    existing = db.query(Machine).filter(Machine.machine_id == payload.machine_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Machine with ID '{payload.machine_id}' already exists"
        )

    machine = Machine(
        machine_id=payload.machine_id,
        name=payload.name,
        type=payload.type,
        rated_voltage=payload.rated_voltage,
        rated_current=payload.rated_current,
        rated_temp_max=payload.rated_temp_max,
        location=payload.location,
        learning_status="COLLECTING_BASELINE"
    )
    db.add(machine)

    baseline = MachineBaseline(
        machine_id=payload.machine_id,
        status="COLLECTING_BASELINE",
        sample_count=0
    )
    db.add(baseline)
    db.commit()
    db.refresh(machine)
    return machine


@router.get("/{machine_id}/readings", response_model=List[SensorReadingResponse])
def get_machine_readings(
    machine_id: str,
    from_time: Optional[datetime] = Query(None, alias="from"),
    to_time: Optional[datetime] = Query(None, alias="to"),
    limit: int = Query(100, ge=1, le=5000),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    query = db.query(SensorReading).filter(SensorReading.machine_id == machine_id)
    if from_time:
        query = query.filter(SensorReading.recorded_at >= from_time)
    if to_time:
        query = query.filter(SensorReading.recorded_at <= to_time)
    
    readings = query.order_by(SensorReading.recorded_at.desc()).limit(limit).all()
    return readings


@router.get("/{machine_id}/latest")
def get_latest_machine_reading(
    machine_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    reading = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .order_by(SensorReading.recorded_at.desc())
        .first()
    )

    if not reading:
        return {
            "machine_id": machine_id,
            "status": "NO DATA",
            "condition": "UNKNOWN",
            "reading": None,
            "has_trained_model": False
        }

    rules = evaluate_threshold_rules(machine, reading)
    model = get_loaded_model(machine_id, db)

    return {
        "machine_id": machine_id,
        "machine_name": machine.name,
        "status": reading.condition,
        "condition": reading.condition,
        "anomaly_score": reading.anomaly_score,
        "has_trained_model": model is not None,
        "rule_violations": [r.message for r in rules],
        "reading": {
            "id": reading.id,
            "temperature": reading.temperature,
            "humidity": reading.humidity,
            "current": reading.current,
            "voltage": reading.voltage,
            "vibration": reading.vibration,
            "recorded_at": reading.recorded_at.isoformat()
        }
    }


@router.get("/{machine_id}/baseline", response_model=BaselineStatusResponse)
def get_machine_baseline_status(
    machine_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    readings = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .order_by(SensorReading.recorded_at.asc())
        .all()
    )

    baseline_stats = validate_baseline(readings)
    return {
        "machine_id": machine_id,
        "status": machine.learning_status,
        "usable_readings": baseline_stats["usable_readings"],
        "required_readings": baseline_stats["required_readings"],
        "message": baseline_stats["message"],
        "statistics": baseline_stats.get("statistics")
    }


@router.post("/{machine_id}/baseline/approve")
def approve_machine_baseline(
    machine_id: str,
    approval: BaselineApprovalRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("engineer"))
):
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    if not approval.confirmed_healthy:
        raise HTTPException(
            status_code=400,
            detail="Healthy operation confirmation is required to approve baseline"
        )

    baseline = db.query(MachineBaseline).filter(MachineBaseline.machine_id == machine_id).first()
    if not baseline:
        baseline = MachineBaseline(machine_id=machine_id)
        db.add(baseline)

    baseline.status = "APPROVED_FOR_TRAINING"
    machine.learning_status = "APPROVED_FOR_TRAINING"
    db.commit()

    return {
        "machine_id": machine_id,
        "status": baseline.status,
        "message": "Healthy baseline operation approved by engineer. Model training is unlocked."
    }


@router.post("/{machine_id}/baseline/train")
def trigger_baseline_training(
    machine_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("engineer"))
):
    try:
        result = train_and_persist_baseline(machine_id, db)
        return {
            "message": "Baseline model trained and persisted successfully.",
            **result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.post("/{machine_id}/predict", response_model=PredictResponse)
def predict_machine_health(
    machine_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    latest_reading = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .order_by(SensorReading.recorded_at.desc())
        .first()
    )

    if not latest_reading:
        return {
            "machine_id": machine_id,
            "condition": "UNKNOWN",
            "status": "NO DATA",
            "anomaly_score": None,
            "rule_violations": [],
            "confidence": 0.0,
            "recommendation": "Awaiting sensor readings."
        }

    score_result = score_reading(machine, latest_reading, db)
    return score_result


@router.post("/{machine_id}/analyze", response_model=AiAnalysisResponse)
async def analyze_machine_with_llm(
    machine_id: str,
    req: AiAnalysisRequest = AiAnalysisRequest(),
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("engineer"))
):
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(minutes=req.window_minutes)

    readings = (
        db.query(SensorReading)
        .filter(
            SensorReading.machine_id == machine_id,
            SensorReading.recorded_at >= window_start
        )
        .order_by(SensorReading.recorded_at.asc())
        .all()
    )

    alerts = (
        db.query(Alert)
        .filter(
            Alert.machine_id == machine_id,
            Alert.created_at >= window_start
        )
        .order_by(Alert.created_at.desc())
        .all()
    )

    maintenance = (
        db.query(MaintenanceRecord)
        .filter(MaintenanceRecord.machine_id == machine_id)
        .order_by(MaintenanceRecord.created_at.desc())
        .limit(5)
        .all()
    )

    summary = build_compact_window_summary(machine, readings, alerts, maintenance)
    user_prompt = build_user_prompt(summary)

    provider = get_llm_provider()
    t_start = datetime.now(timezone.utc)
    try:
        output_dict = await provider.complete(SYSTEM_PROMPT, user_prompt)
        ai_available = True
    except Exception as e:
        # Fallback cleanly
        ai_available = False
        output_dict = {
            "summary": "AI Diagnostics service offline. Layered threshold rules and baseline scoring remain active.",
            "likely_causes": ["LLM service unavailable"],
            "severity": "medium" if alerts else "low",
            "recommended_actions": ["Review active alerts panel", "Verify physical telemetry"],
            "confidence": "low"
        }

    latency = int((datetime.now(timezone.utc) - t_start).total_seconds() * 1000)

    analysis_record = AiAnalysis(
        machine_id=machine_id,
        window_start=window_start,
        window_end=window_end,
        provider=type(provider).__name__,
        model=getattr(provider, "model", "rule_fallback"),
        input_summary=summary,
        output=output_dict,
        latency_ms=latency
    )
    db.add(analysis_record)
    db.commit()
    db.refresh(analysis_record)

    return {
        "id": analysis_record.id,
        "machine_id": machine_id,
        "window_start": window_start,
        "window_end": window_end,
        "provider": analysis_record.provider,
        "model": analysis_record.model,
        "input_summary": summary,
        "output": output_dict,
        "latency_ms": latency,
        "created_at": analysis_record.created_at,
        "ai_available": ai_available
    }


@router.get("/{machine_id}/analyses", response_model=List[AiAnalysisResponse])
def get_past_analyses(
    machine_id: str,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    return (
        db.query(AiAnalysis)
        .filter(AiAnalysis.machine_id == machine_id)
        .order_by(AiAnalysis.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/{machine_id}/devices", response_model=DeviceCreatedWithKey)
def create_device_for_machine(
    machine_id: str,
    payload: DeviceCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin"))
):
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    raw_key = generate_api_key()
    device = Device(
        machine_id=machine_id,
        name=payload.name,
        api_key_hash=hash_api_key(raw_key),
        is_active=True
    )
    db.add(device)
    db.commit()
    db.refresh(device)

    return {
        "id": device.id,
        "machine_id": device.machine_id,
        "name": device.name,
        "is_active": device.is_active,
        "last_seen_at": device.last_seen_at,
        "created_at": device.created_at,
        "api_key": raw_key  # Returned once
    }


@router.get("/{machine_id}/devices", response_model=List[DeviceResponse])
def list_machine_devices(
    machine_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin"))
):
    return db.query(Device).filter(Device.machine_id == machine_id).all()
