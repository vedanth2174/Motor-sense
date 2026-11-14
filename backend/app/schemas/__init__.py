from app.schemas.all_schemas import (
    MachineCreate,
    MachineResponse,
    DeviceCreate,
    DeviceResponse,
    DeviceCreatedWithKey,
    SensorIngest,
    SensorReadingResponse,
    BaselineStatusResponse,
    BaselineApprovalRequest,
    PredictResponse,
    AlertResponse,
    AlertAcknowledgeRequest,
    MaintenanceCreate,
    MaintenanceResponse,
    AiAnalysisRequest,
    AiAnalysisOutput,
    AiAnalysisResponse
)

# Compatibility aliases
MachineRegistration = MachineCreate
SensorData = SensorIngest
MaintenanceInput = MaintenanceCreate

__all__ = [
    "MachineCreate",
    "MachineResponse",
    "MachineRegistration",
    "DeviceCreate",
    "DeviceResponse",
    "DeviceCreatedWithKey",
    "SensorIngest",
    "SensorData",
    "SensorReadingResponse",
    "BaselineStatusResponse",
    "BaselineApprovalRequest",
    "PredictResponse",
    "AlertResponse",
    "AlertAcknowledgeRequest",
    "MaintenanceCreate",
    "MaintenanceInput",
    "MaintenanceResponse",
    "AiAnalysisRequest",
    "AiAnalysisOutput",
    "AiAnalysisResponse"
]
