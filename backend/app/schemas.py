
from pydantic import BaseModel, Field


class MachineRegistration(BaseModel):
    machine_id: str = Field(min_length=1, max_length=50)
    machine_name: str = Field(min_length=1, max_length=100)
    machine_type: str = "AC_MOTOR"
    rated_voltage: float = Field(gt=0)
    rated_current: float = Field(gt=0)


class LearningStatus(BaseModel):
    machine_id: str
    status: str
    total_readings: int
    usable_readings: int
    message: str


class SensorData(BaseModel):
    machine_id: str = Field(min_length=1, max_length=50)
    temperature: float | None = None
    humidity: float | None = None
    current: float | None = None
    voltage: float | None = None
    vibration: float | None = None
