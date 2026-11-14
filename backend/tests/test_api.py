def test_health_endpoints(client):
    r_live = client.get("/api/v1/health/live")
    assert r_live.status_code == 200
    assert r_live.json()["status"] == "alive"

    r_ready = client.get("/api/v1/health/ready")
    assert r_ready.status_code == 200
    assert r_ready.json()["status"] == "ready"


def test_machines_flow(client):
    # List machines
    res = client.get("/api/v1/machines")
    assert res.status_code == 200
    assert any(m["machine_id"] == "MOTOR_TEST" for m in res.json())

    # Register new machine
    new_m = {
        "machine_id": "MOTOR_NEW_1",
        "name": "New Chiller Motor",
        "type": "AC_MOTOR",
        "rated_voltage": 400.0,
        "rated_current": 12.0,
        "rated_temp_max": 85.0
    }
    r_post = client.post("/api/v1/machines", json=new_m)
    assert r_post.status_code == 201
    assert r_post.json()["machine_id"] == "MOTOR_NEW_1"


def test_ingest_and_score(client):
    payload = {
        "machine_id": "MOTOR_TEST",
        "temperature": 48.0,
        "humidity": 45.0,
        "current": 7.0,
        "voltage": 230.0,
        "vibration": 1.2
    }
    res = client.post("/api/v1/ingest", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["machine_id"] == "MOTOR_TEST"
    assert data["condition"] == "SAFE"

    # Test critical overcurrent
    crit_payload = {
        "machine_id": "MOTOR_TEST",
        "temperature": 48.0,
        "humidity": 45.0,
        "current": 12.0,  # critical overcurrent
        "voltage": 230.0,
        "vibration": 1.2
    }
    res_crit = client.post("/api/v1/ingest", json=crit_payload)
    assert res_crit.status_code == 200
    assert res_crit.json()["condition"] == "CRITICAL"

    # Verify alert was created
    alerts_res = client.get("/api/v1/alerts?machine_id=MOTOR_TEST")
    assert alerts_res.status_code == 200
    assert len(alerts_res.json()) >= 1
    assert alerts_res.json()[0]["severity"] == "critical"


def test_maintenance_records(client):
    payload = {
        "machine_id": "MOTOR_TEST",
        "description": "Replaced drive belt",
        "status": "COMPLETED"
    }
    r = client.post("/api/v1/maintenance", json=payload)
    assert r.status_code == 201
    assert r.json()["description"] == "Replaced drive belt"

    list_r = client.get("/api/v1/maintenance?machine_id=MOTOR_TEST")
    assert list_r.status_code == 200
    assert len(list_r.json()) >= 1
