from datetime import datetime, timezone, timedelta
import random
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models.all_models import Machine, Device, SensorReading, MachineBaseline
from app.core.security import hash_api_key

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Create Machine
        motor = db.query(Machine).filter(Machine.machine_id == "MOTOR_001").first()
        if not motor:
            motor = Machine(
                machine_id="MOTOR_001",
                name="AC Induction Motor #1",
                type="AC_MOTOR",
                rated_voltage=230.0,
                rated_current=8.5,
                rated_temp_max=80.0,
                location="Packaging Line A",
                learning_status="COLLECTING_BASELINE"
            )
            db.add(motor)
            db.commit()
            print("Seeded machine MOTOR_001")

        # 2. Create Device with known key
        demo_key = "ms_demo_esp32_device_key_12345"
        device = db.query(Device).filter(Device.machine_id == "MOTOR_001").first()
        if not device:
            device = Device(
                machine_id="MOTOR_001",
                name="ESP32 Factory Gateway",
                api_key_hash=hash_api_key(demo_key),
                is_active=True
            )
            db.add(device)
            db.commit()
            print(f"Seeded demo device with API key: {demo_key}")

        # 3. Create Machine 2 for multi-machine testing
        motor2 = db.query(Machine).filter(Machine.machine_id == "MOTOR_002").first()
        if not motor2:
            motor2 = Machine(
                machine_id="MOTOR_002",
                name="Centrifugal Pump Motor",
                type="AC_MOTOR",
                rated_voltage=415.0,
                rated_current=14.2,
                rated_temp_max=85.0,
                location="Water Treatment Plant",
                learning_status="COLLECTING_BASELINE"
            )
            db.add(motor2)
            db.commit()
            print("Seeded machine MOTOR_002")

        print("Database seeded successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
