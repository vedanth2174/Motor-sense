from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String

from app.database import Base


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, index=True, nullable=False)
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    current = Column(Float, nullable=True)
    voltage = Column(Float, nullable=True)
    vibration = Column(Float, nullable=True)
    condition = Column(String, default="UNKNOWN", nullable=False)
    recorded_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, index=True, nullable=False)
    description = Column(String, nullable=False)
    status = Column(String, default="OPEN", nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )


class Machine(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, unique=True, index=True, nullable=False)
    machine_name = Column(String, nullable=False)
    machine_type = Column(String, default="AC_MOTOR", nullable=False)
    rated_voltage = Column(Float, nullable=False)
    rated_current = Column(Float, nullable=False)
    learning_status = Column(String, default="COLLECTING_BASELINE", nullable=False)


class MachineBaseline(Base):
    __tablename__ = "machine_baselines"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )
    status = Column(
        String,
        default="COLLECTING_BASELINE",
        nullable=False
    )
    sample_count = Column(Integer, default=0, nullable=False)
    model_version = Column(String, nullable=True)
    trained_at = Column(DateTime, nullable=True)
