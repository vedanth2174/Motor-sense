import io
import csv
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.db.base import Base
from app.db.session import engine, get_db
from app.api.v1 import api_v1_router
from app.models.all_models import Machine, SensorReading, MaintenanceRecord
from app.schemas.all_schemas import SensorIngest, MaintenanceCreate, MachineCreate
from app.services.scoring import score_reading
from app.api.v1.ingest import ingest_sensor_reading

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing MotorSense API...")
    # Initialize DB tables (for dev SQLite or fallback before migrations)
    try:
        Base.metadata.create_all(bind=engine)
        # Create default machine if not present
        db = next(get_db())
        try:
            default_motor = db.query(Machine).filter(Machine.machine_id == "MOTOR_001").first()
            if not default_motor:
                default_motor = Machine(
                    machine_id="MOTOR_001",
                    name="AC Motor 01",
                    type="AC_MOTOR",
                    rated_voltage=230.0,
                    rated_current=8.5,
                    rated_temp_max=80.0,
                    location="Production Line A",
                    learning_status="COLLECTING_BASELINE"
                )
                db.add(default_motor)
                db.commit()
                logger.info("Created default machine 'MOTOR_001'")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Database initialization notice: {e}")

    yield
    logger.info("Shutting down MotorSense API...")


app = FastAPI(
    title="MotorSense Predictive Maintenance API",
    version="2.0.0",
    description="Enterprise IoT & AI-assisted AC Motor Predictive Maintenance System",
    lifespan=lifespan
)

# CORS Middleware
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 router
app.include_router(api_v1_router)

# Prometheus instrumentation (optional)
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except Exception:
    pass


# -------------------------------------------------------------
# Root & Legacy Compatibility Endpoints
# -------------------------------------------------------------
@app.get("/")
def root():
    return {
        "system": "MotorSense Predictive Systems API",
        "version": "2.0.0",
        "status": "online",
        "docs": "/docs",
        "api_v1": "/api/v1"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/sensor-data")
async def legacy_sensor_data_post(payload: SensorIngest, db: Session = Depends(get_db)):
    return await ingest_sensor_reading(payload=payload, device=None, db=db)


@app.get("/sensor-data")
def legacy_sensor_data_get(
    limit: int = 100,
    machine_id: str = "MOTOR_001",
    db: Session = Depends(get_db)
):
    limit = max(1, min(limit, 1000))
    readings = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .order_by(SensorReading.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "machine_id": r.machine_id,
            "temperature": r.temperature,
            "humidity": r.humidity,
            "current": r.current,
            "voltage": r.voltage,
            "vibration": r.vibration,
            "condition": r.condition,
            "recorded_at": r.recorded_at.isoformat()
        }
        for r in readings
    ]


@app.get("/api/sensors")
def legacy_latest_sensor(db: Session = Depends(get_db)):
    reading = (
        db.query(SensorReading)
        .order_by(SensorReading.recorded_at.desc())
        .first()
    )
    if not reading:
        return {
            "temperature": None,
            "humidity": None,
            "current": None,
            "voltage": None,
            "vibration": None,
            "status": "SENSOR ERROR",
            "message": "No sensor readings available"
        }
    return {
        "timestamp": reading.recorded_at.isoformat(),
        "temperature": reading.temperature,
        "humidity": reading.humidity,
        "current": reading.current,
        "voltage": reading.voltage,
        "vibration": reading.vibration,
        "status": reading.condition
    }


@app.post("/api/predict")
def legacy_predict(payload: dict, db: Session = Depends(get_db)):
    machine_id = payload.get("machine_id", "MOTOR_001")
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        return {
            "prediction": "UNKNOWN",
            "status": "SENSOR ERROR",
            "confidence": 0,
            "faultClass": "Machine not registered",
            "recommendation": "Register machine first."
        }

    reading = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .order_by(SensorReading.recorded_at.desc())
        .first()
    )
    if not reading:
        return {
            "prediction": "UNKNOWN",
            "status": "SENSOR ERROR",
            "confidence": 0,
            "faultClass": "No readings",
            "recommendation": "Awaiting sensor data."
        }

    scored = score_reading(machine, reading, db)
    return {
        "prediction": scored["condition"],
        "status": scored["status"],
        "confidence": scored["confidence"],
        "faultClass": "Anomaly" if scored["condition"] != "SAFE" else "Normal",
        "recommendation": scored["recommendation"]
    }


@app.get("/download.csv")
def download_csv(machine_id: str = "MOTOR_001", db: Session = Depends(get_db)):
    readings = (
        db.query(SensorReading)
        .filter(SensorReading.machine_id == machine_id)
        .order_by(SensorReading.recorded_at.asc())
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Timestamp", "MachineID", "Temperature", "Humidity", "Current", "Voltage", "Vibration", "Condition", "AnomalyScore"
    ])
    for r in readings:
        writer.writerow([
            r.recorded_at.isoformat(),
            r.machine_id,
            r.temperature if r.temperature is not None else "",
            r.humidity if r.humidity is not None else "",
            r.current if r.current is not None else "",
            r.voltage if r.voltage is not None else "",
            r.vibration if r.vibration is not None else "",
            r.condition,
            r.anomaly_score if r.anomaly_score is not None else ""
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=motorsense_{machine_id}_telemetry.csv"}
    )
