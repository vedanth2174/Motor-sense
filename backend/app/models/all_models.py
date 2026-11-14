from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Index, JSON
)
from sqlalchemy.orm import relationship
from app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class Machine(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(50), default="AC_MOTOR", nullable=False)
    rated_voltage = Column(Float, nullable=False)
    rated_current = Column(Float, nullable=False)
    rated_temp_max = Column(Float, default=80.0, nullable=False)
    location = Column(String(100), nullable=True)
    learning_status = Column(String(50), default="COLLECTING_BASELINE", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    devices = relationship("Device", back_populates="machine", cascade="all, delete-orphan")
    readings = relationship("SensorReading", back_populates="machine", cascade="all, delete-orphan")
    baseline = relationship("MachineBaseline", back_populates="machine", uselist=False, cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="machine", cascade="all, delete-orphan")
    analyses = relationship("AiAnalysis", back_populates="machine", cascade="all, delete-orphan")
    maintenance_records = relationship("MaintenanceRecord", back_populates="machine", cascade="all, delete-orphan")


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50), ForeignKey("machines.machine_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    api_key_hash = Column(String(64), index=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    machine = relationship("Machine", back_populates="devices")


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50), ForeignKey("machines.machine_id", ondelete="CASCADE"), index=True, nullable=False)
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    current = Column(Float, nullable=True)
    voltage = Column(Float, nullable=True)
    vibration = Column(Float, nullable=True)
    condition = Column(String(50), default="UNKNOWN", nullable=False)
    anomaly_score = Column(Float, nullable=True)
    is_valid = Column(Boolean, default=True, nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=utc_now, index=True, nullable=False)

    machine = relationship("Machine", back_populates="readings")

    __table_args__ = (
        Index("ix_sensor_readings_machine_recorded", "machine_id", "recorded_at"),
    )


class MachineBaseline(Base):
    __tablename__ = "machine_baselines"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50), ForeignKey("machines.machine_id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    status = Column(String(50), default="COLLECTING_BASELINE", nullable=False)
    sample_count = Column(Integer, default=0, nullable=False)
    model_version = Column(String(50), nullable=True)
    model_path = Column(String(255), nullable=True)
    metrics = Column(JSON, nullable=True)
    trained_at = Column(DateTime(timezone=True), nullable=True)

    machine = relationship("Machine", back_populates="baseline")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50), ForeignKey("machines.machine_id", ondelete="CASCADE"), index=True, nullable=False)
    severity = Column(String(20), nullable=False)  # info, warning, critical
    source = Column(String(20), nullable=False)    # rule, ml
    message = Column(String(255), nullable=False)
    reading_id = Column(Integer, ForeignKey("sensor_readings.id", ondelete="SET NULL"), nullable=True)
    acknowledged_by = Column(String(100), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    machine = relationship("Machine", back_populates="alerts")


class AiAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50), ForeignKey("machines.machine_id", ondelete="CASCADE"), index=True, nullable=False)
    window_start = Column(DateTime(timezone=True), nullable=False)
    window_end = Column(DateTime(timezone=True), nullable=False)
    provider = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)
    input_summary = Column(JSON, nullable=False)
    output = Column(JSON, nullable=False)
    latency_ms = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    machine = relationship("Machine", back_populates="analyses")


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50), ForeignKey("machines.machine_id", ondelete="CASCADE"), index=True, nullable=False)
    description = Column(String(255), nullable=False)
    status = Column(String(50), default="OPEN", nullable=False)
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    machine = relationship("Machine", back_populates="maintenance_records")
