import os
import sqlite3
from pathlib import Path

DB_PATH = os.getenv("DATABASE_PATH", "/data/motor_data.db")

if not Path(DB_PATH).exists():
    raise SystemExit(f"Database not found: {DB_PATH}")

connection = sqlite3.connect(DB_PATH)

try:
    connection.execute("PRAGMA foreign_keys = OFF")

    columns = {
        row[1]: row
        for row in connection.execute("PRAGMA table_info(sensor_readings)")
    }

    if not columns:
        raise RuntimeError("Table sensor_readings was not found.")

    required = {
        "id", "machine_id", "temperature", "humidity",
        "current", "voltage", "vibration", "condition", "recorded_at"
    }
    missing = required - set(columns)
    if missing:
        raise RuntimeError(f"Unexpected table structure; missing columns: {sorted(missing)}")

    nullable_fields = {"temperature", "humidity", "current", "voltage", "vibration"}
    already_nullable = all(columns[field][3] == 0 for field in nullable_fields)

    if already_nullable:
        print("Migration not needed: all sensor fields already allow NULL.")
    else:
        connection.execute("BEGIN")
        connection.execute("""
            CREATE TABLE sensor_readings_new (
                id INTEGER NOT NULL PRIMARY KEY,
                machine_id VARCHAR NOT NULL,
                temperature FLOAT,
                humidity FLOAT,
                current FLOAT,
                voltage FLOAT,
                vibration FLOAT,
                condition VARCHAR NOT NULL,
                recorded_at DATETIME NOT NULL
            )
        """)

        connection.execute("""
            INSERT INTO sensor_readings_new (
                id, machine_id, temperature, humidity, current,
                voltage, vibration, condition, recorded_at
            )
            SELECT
                id, machine_id, temperature, humidity, current,
                voltage, vibration, condition, recorded_at
            FROM sensor_readings
        """)

        connection.execute("DROP TABLE sensor_readings")
        connection.execute(
            "ALTER TABLE sensor_readings_new RENAME TO sensor_readings"
        )

        connection.execute("""
            CREATE INDEX IF NOT EXISTS ix_sensor_readings_id
            ON sensor_readings (id)
        """)
        connection.execute("""
            CREATE INDEX IF NOT EXISTS ix_sensor_readings_machine_id
            ON sensor_readings (machine_id)
        """)

        connection.commit()
        print("Migration successful. Existing sensor readings were preserved.")

    updated = {
        row[1]: row
        for row in connection.execute("PRAGMA table_info(sensor_readings)")
    }
    print("Sensor field NULL settings:")
    for field in sorted(nullable_fields):
        print(f"  {field}: {'NULL allowed' if updated[field][3] == 0 else 'NOT NULL'}")

except Exception:
    connection.rollback()
    raise
finally:
    connection.close()
