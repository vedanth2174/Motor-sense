import requests
import sys

BASE_URL = "http://localhost:8000"

def main():
    print(f"Running MotorSense smoke test against {BASE_URL}...")
    try:
        # 1. Health check
        r = requests.get(f"{BASE_URL}/api/v1/health/live", timeout=3)
        if r.status_code != 200:
            print(f"FAILED: Health check returned {r.status_code}")
            sys.exit(1)
        print("  [OK] /api/v1/health/live")

        # 2. Ingest reading
        payload = {
            "machine_id": "MOTOR_001",
            "temperature": 45.0,
            "humidity": 50.0,
            "current": 7.2,
            "voltage": 230.0,
            "vibration": 1.3
        }
        r = requests.post(f"{BASE_URL}/api/v1/ingest", json=payload, timeout=3)
        if r.status_code not in (200, 201):
            print(f"FAILED: Ingest returned {r.status_code}: {r.text}")
            sys.exit(1)
        print("  [OK] /api/v1/ingest")

        # 3. Read back latest
        r = requests.get(f"{BASE_URL}/api/v1/machines/MOTOR_001/latest", timeout=3)
        if r.status_code != 200:
            print(f"FAILED: Latest reading returned {r.status_code}")
            sys.exit(1)
        data = r.json()
        print(f"  [OK] /api/v1/machines/MOTOR_001/latest (condition: {data.get('condition')})")

        print("Smoke test PASSED successfully!")
    except Exception as e:
        print(f"FAILED: Could not connect to {BASE_URL}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
