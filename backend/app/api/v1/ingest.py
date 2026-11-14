from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import verify_device_api_key
from app.db.session import get_db
from app.models.all_models import Machine, SensorReading, Device, MachineBaseline
from app.schemas.all_schemas import SensorIngest, SensorReadingResponse
from app.services.validation import validate_sensor_reading
from app.services.scoring import score_reading
from app.services.training import train_and_persist_baseline
from app.events import broadcaster

router = APIRouter(tags=["ingest"])


@router.post("/ingest", response_model=SensorReadingResponse)
async def ingest_sensor_reading(
    payload: SensorIngest,
    device: Optional[Device] = Depends(verify_device_api_key),
    db: Session = Depends(get_db)
):
    # Determine machine_id (from device if authenticated, else from payload)
    machine_id = device.machine_id if device else (payload.machine_id or "MOTOR_001")

    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine '{machine_id}' is not registered. Register the machine first."
        )

    # Validate physical sensor data
    is_valid, validation_errors = validate_sensor_reading(
        temperature=payload.temperature,
        humidity=payload.humidity,
        current=payload.current,
        voltage=payload.voltage,
        vibration=payload.vibration
    )

    reading = SensorReading(
        machine_id=machine_id,
        temperature=payload.temperature,
        humidity=payload.humidity,
        current=payload.current,
        voltage=payload.voltage,
        vibration=payload.vibration,
        is_valid=is_valid,
        condition="UNKNOWN",
        recorded_at=payload.recorded_at or datetime.now(timezone.utc)
    )

    db.add(reading)
    db.commit()
    db.refresh(reading)

    # Execute scoring pipeline (rules + baseline model)
    score_result = score_reading(machine, reading, db)

    # Check auto-train trigger (if baseline approved by engineer and sample count reached)
    baseline = db.query(MachineBaseline).filter(MachineBaseline.machine_id == machine_id).first()
    if baseline and baseline.status == "APPROVED_FOR_TRAINING":
        valid_count = (
            db.query(SensorReading)
            .filter(SensorReading.machine_id == machine_id, SensorReading.is_valid == True)
            .count()
        )
        if valid_count >= 500:
            try:
                train_and_persist_baseline(machine_id, db)
            except Exception as e:
                pass

    # Broadcast via SSE
    event_data = {
        "id": reading.id,
        "machine_id": reading.machine_id,
        "temperature": reading.temperature,
        "humidity": reading.humidity,
        "current": reading.current,
        "voltage": reading.voltage,
        "vibration": reading.vibration,
        "condition": reading.condition,
        "anomaly_score": reading.anomaly_score,
        "recorded_at": reading.recorded_at.isoformat(),
        "status": score_result.get("status")
    }
    await broadcaster.broadcast(machine_id, "reading", event_data)

    return reading
