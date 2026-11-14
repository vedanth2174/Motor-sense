from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field


# --- Machine Schemas ---
class MachineCreate(BaseModel):
    machine_id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    type: str = "AC_MOTOR"
    rated_voltage: float = Field(gt=0)
    rated_current: float = Field(gt=0)
    rated_temp_max: float = Field(default=80.0, gt=0)
    location: Optional[str] = None


class MachineResponse(BaseModel):
    id: int
    machine_id: str
    name: str
    type: str
    rated_voltage: float
    rated_current: float
    rated_temp_max: float
    location: Optional[str]
    learning_status: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Device Schemas ---
class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class DeviceResponse(BaseModel):
    id: int
    machine_id: str
    name: str
    is_active: bool
    last_seen_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceCreatedWithKey(DeviceResponse):
    api_key: str  # Only returned once on creation


# --- Sensor Ingestion Schemas ---
class SensorIngest(BaseModel):
    machine_id: Optional[str] = "MOTOR_001"
    temperature: Optional[float] = Field(default=None, ge=-40, le=150)
    humidity: Optional[float] = Field(default=None, ge=0, le=100)
    current: Optional[float] = Field(default=None, ge=0)
    voltage: Optional[float] = Field(default=None, ge=0)
    vibration: Optional[float] = Field(default=None, ge=0)
    recorded_at: Optional[datetime] = None


class SensorReadingResponse(BaseModel):
    id: int
    machine_id: str
    temperature: Optional[float]
    humidity: Optional[float]
    current: Optional[float]
    voltage: Optional[float]
    vibration: Optional[float]
    condition: str
    anomaly_score: Optional[float]
    is_valid: bool
    recorded_at: datetime

    class Config:
        from_attributes = True


# --- Baseline & Training Schemas ---
class BaselineStatusResponse(BaseModel):
    machine_id: str
    status: str
    usable_readings: int
    required_readings: int
    message: str
    statistics: Optional[Dict[str, Dict[str, float]]] = None


class BaselineApprovalRequest(BaseModel):
    confirmed_healthy: bool


# --- Prediction Schemas ---
class PredictResponse(BaseModel):
    machine_id: str
    condition: str
    status: str
    anomaly_score: Optional[float]
    rule_violations: List[str]
    confidence: float
    recommendation: str


# --- Alert Schemas ---
class AlertResponse(BaseModel):
    id: int
    machine_id: str
    severity: str
    source: str
    message: str
    reading_id: Optional[int]
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class AlertAcknowledgeRequest(BaseModel):
    acknowledged_by: Optional[str] = None


# --- Maintenance Schemas ---
class MaintenanceCreate(BaseModel):
    machine_id: str = "MOTOR_001"
    description: str
    status: str = "OPEN"
    scheduled_for: Optional[datetime] = None


class MaintenanceResponse(BaseModel):
    id: int
    machine_id: str
    description: str
    status: str
    scheduled_for: Optional[datetime]
    completed_at: Optional[datetime]
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# --- AI Analysis Schemas ---
class AiAnalysisRequest(BaseModel):
    window_minutes: int = 30


class AiAnalysisOutput(BaseModel):
    summary: str
    likely_causes: List[str]
    severity: str = "low"  # low, medium, high
    recommended_actions: List[str]
    confidence: str = "medium"  # low, medium, high


class AiAnalysisResponse(BaseModel):
    id: Optional[int] = None
    machine_id: str
    window_start: datetime
    window_end: datetime
    provider: str
    model: str
    input_summary: Dict[str, Any]
    output: AiAnalysisOutput
    latency_ms: int
    created_at: datetime
    ai_available: bool = True
