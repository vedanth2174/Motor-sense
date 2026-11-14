import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.models.all_models import Machine, SensorReading

SQLITE_PATH = os.getenv("SQLITE_SOURCE", "motor_data_backup.db")

def migrate():
    sqlite_file = Path(SQLITE_PATH)
    if not sqlite_file.exists():
        sqlite_file = Path("..") / SQLITE_PATH
    if not sqlite_file.exists():
        print(f"Source SQLite database not found at {SQLITE_PATH}")
        return

    print(f"Connecting to source SQLite: {sqlite_file}")
    conn = sqlite3.connect(sqlite_file)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print(f"Connecting to target database: {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # 1. Ensure default machine exists
        machine = db.query(Machine).filter(Machine.machine_id == "MOTOR_001").first()
        if not machine:
            machine = Machine(
                machine_id="MOTOR_001",
                name="AC Motor 01",
                type="AC_MOTOR",
                rated_voltage=230.0,
                rated_current=8.5,
                rated_temp_max=80.0,
                location="Production Line A",
                learning_status="COLLECTING_BASELINE"
            )
            db.add(machine)
            db.commit()
            print("Created default target machine 'MOTOR_001'.")

        # 2. Migrate sensor readings
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sensor_readings'")
        if not cursor.fetchone():
            print("No sensor_readings table found in SQLite DB.")
            return

        cursor.execute("""
            SELECT id, machine_id, temperature, humidity, current, voltage, vibration, condition, recorded_at
            FROM sensor_readings
        """)
        rows = cursor.fetchall()
        print(f"Found {len(rows)} records in source database.")

        inserted = 0
        for row in rows:
            rec_at = row["recorded_at"]
            if isinstance(rec_at, str):
                try:
                    dt = datetime.fromisoformat(rec_at)
                except Exception:
                    dt = datetime.now(timezone.utc)
            else:
                dt = datetime.now(timezone.utc)

            reading = SensorReading(
                machine_id=row["machine_id"] or "MOTOR_001",
                temperature=row["temperature"],
                humidity=row["humidity"],
                current=row["current"],
                voltage=row["voltage"],
                vibration=row["vibration"],
                condition=row["condition"] or "UNKNOWN",
                is_valid=True,
                recorded_at=dt
            )
            db.add(reading)
            inserted += 1

            if inserted % 200 == 0:
                db.commit()
                print(f"Migrated {inserted}/{len(rows)} records...")

        db.commit()
        print(f"Migration completed successfully! Total records migrated: {inserted}")
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        conn.close()
        db.close()


if __name__ == "__main__":
    migrate()
