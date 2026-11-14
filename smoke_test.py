import os
import sys
import requests

BASE_URL = os.getenv("API_URL", "http://localhost:8005")

def test_e2e():
    print(f"\n========================================================")
    print(f"  MotorSense End-to-End (E2E) Test Suite")
    print(f"  Target: {BASE_URL}")
    print(f"========================================================\n")

    # 1. Health Checks
    print("[1/7] Testing Health Endpoints...")
    r = requests.get(f"{BASE_URL}/api/v1/health/live", timeout=5)
    assert r.status_code == 200, f"Health live failed: {r.status_code}"
    r = requests.get(f"{BASE_URL}/api/v1/health/ready", timeout=5)
    assert r.status_code == 200, f"Health ready failed: {r.status_code}"
    print("      PASSED: Backend is live and DB is ready.")

    # 2. Machine Registry
    print("[2/7] Checking Registered Machines...")
    r = requests.get(f"{BASE_URL}/api/v1/machines", timeout=5)
    assert r.status_code == 200, f"List machines failed: {r.status_code}"
    machines = r.json()
    assert len(machines) > 0, "No machines registered in DB!"
    motor = machines[0]
    machine_id = motor["machine_id"]
    print(f"      PASSED: Found active machine '{machine_id}' (Rated: {motor['rated_voltage']}V, {motor['rated_current']}A).")

    # 3. Healthy Telemetry Ingestion
    print("[3/7] Ingesting Nominal Sensor Reading...")
    nominal_payload = {
        "machine_id": machine_id,
        "temperature": 48.5,
        "humidity": 45.0,
        "current": 7.1,     # Healthy (< 8.5A)
        "voltage": 230.0,   # Nominal 230V
        "vibration": 1.2    # Normal (< 4.5 mm/s)
    }
    r = requests.post(f"{BASE_URL}/api/v1/ingest", json=nominal_payload, timeout=5)
    assert r.status_code in (200, 201), f"Nominal ingest failed: {r.text}"
    reading = r.json()
    assert reading["condition"] == "SAFE", f"Expected condition SAFE, got {reading['condition']}"
    print(f"      PASSED: Reading #{reading['id']} classified as '{reading['condition']}'.")

    # 4. Fault Injection & Instant Rule Trip
    print("[4/7] Testing Fault Detection (Injecting Overcurrent 11.2A > 110% rated)...")
    fault_payload = {
        "machine_id": machine_id,
        "temperature": 75.0,
        "humidity": 40.0,
        "current": 11.2,    # OVERCURRENT FAULT
        "voltage": 228.0,
        "vibration": 2.1
    }
    r = requests.post(f"{BASE_URL}/api/v1/ingest", json=fault_payload, timeout=5)
    assert r.status_code in (200, 201), f"Fault ingest failed: {r.text}"
    fault_reading = r.json()
    assert fault_reading["condition"] in ("CRITICAL", "WARNING"), f"Expected fault condition, got {fault_reading['condition']}"
    print(f"      PASSED: Ingested reading classified as '{fault_reading['condition']}'.")

    # 5. Alert Trigger & Verification
    print("[5/7] Verifying Alert Generation...")
    r = requests.get(f"{BASE_URL}/api/v1/alerts?machine_id={machine_id}", timeout=5)
    assert r.status_code == 200, f"Get alerts failed: {r.status_code}"
    alerts = r.json()
    assert len(alerts) > 0, "No alerts created after fault injection!"
    latest_alert = alerts[0]
    print(f"      PASSED: Alert #{latest_alert['id']} recorded: [{latest_alert['severity'].upper()}] {latest_alert['message']}")

    # 6. Engineer Alert Acknowledgment
    print("[6/7] Testing Engineer Workflow (Acknowledge Alert)...")
    ack_url = f"{BASE_URL}/api/v1/alerts/{latest_alert['id']}/ack"
    r = requests.post(ack_url, json={"acknowledged_by": "test_engineer"}, timeout=5)
    assert r.status_code == 200, f"Ack alert failed: {r.status_code}"
    ack_data = r.json()
    assert ack_data["acknowledged"] is True, "Alert not marked as acknowledged!"
    print(f"      PASSED: Alert #{latest_alert['id']} successfully acknowledged.")

    # 7. AI Diagnostic Narrative
    print("[7/7] Testing AI Root-Cause Diagnostic Analysis...")
    r = requests.post(f"{BASE_URL}/api/v1/machines/{machine_id}/analyze", json={"window_minutes": 30}, timeout=10)
    assert r.status_code == 200, f"AI analyze failed: {r.status_code}"
    analysis = r.json()
    assert "summary" in analysis, "Analysis missing summary field!"
    print(f"      PASSED: AI Diagnosis generated successfully.")
    print(f"      Summary: {analysis['summary']}")
    if analysis.get("likely_causes"):
        print(f"      Likely Causes: {', '.join(analysis['likely_causes'])}")

    print(f"\n========================================================")
    print(f"  🎉 ALL END-TO-END TESTS PASSED SUCCESSFULLY! (7/7)")
    print(f"========================================================\n")


if __name__ == "__main__":
    try:
        test_e2e()
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        sys.exit(1)
