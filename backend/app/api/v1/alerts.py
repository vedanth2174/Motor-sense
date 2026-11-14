from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.all_models import Alert
from app.schemas.all_schemas import AlertResponse, AlertAcknowledgeRequest

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertResponse])
def list_alerts(
    machine_id: Optional[str] = None,
    severity: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    query = db.query(Alert)
    if machine_id:
        query = query.filter(Alert.machine_id == machine_id)
    if severity:
        query = query.filter(Alert.severity == severity)
    if acknowledged is not None:
        if acknowledged:
            query = query.filter(Alert.acknowledged_at.isnot(None))
        else:
            query = query.filter(Alert.acknowledged_at.is_(None))

    return query.order_by(Alert.created_at.desc()).limit(limit).all()


@router.post("/{alert_id}/ack", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    payload: AlertAcknowledgeRequest = AlertAcknowledgeRequest(),
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("engineer"))
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    ack_by = payload.acknowledged_by or user.get("preferred_username") or "engineer"
    alert.acknowledged_by = ack_by
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return alert
