from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.all_models import MaintenanceRecord
from app.schemas.all_schemas import MaintenanceCreate, MaintenanceResponse

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("", response_model=List[MaintenanceResponse])
def list_maintenance_records(
    machine_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    query = db.query(MaintenanceRecord)
    if machine_id:
        query = query.filter(MaintenanceRecord.machine_id == machine_id)
    return query.order_by(MaintenanceRecord.created_at.desc()).limit(limit).all()


@router.post("", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
def create_maintenance_record(
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("engineer"))
):
    creator = user.get("preferred_username") or "engineer"
    record = MaintenanceRecord(
        machine_id=payload.machine_id,
        description=payload.description,
        status=payload.status,
        scheduled_for=payload.scheduled_for,
        created_by=creator
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
