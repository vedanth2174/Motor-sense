from app.models.all_models import Machine, SensorReading
from app.services.rules import evaluate_threshold_rules

def test_rules_safe_operation():
    machine = Machine(
        machine_id="MOTOR_TEST",
        name="Test Motor",
        type="AC_MOTOR",
        rated_voltage=230.0,
        rated_current=8.5,
        rated_temp_max=80.0
    )
    reading = SensorReading(
        machine_id="MOTOR_TEST",
        voltage=228.0,
        current=7.2,
        temperature=45.0,
        vibration=1.4,
        is_valid=True
    )
    violations = evaluate_threshold_rules(machine, reading)
    assert len(violations) == 0

def test_rules_overcurrent_critical():
    machine = Machine(
        machine_id="MOTOR_TEST",
        name="Test Motor",
        type="AC_MOTOR",
        rated_voltage=230.0,
        rated_current=8.5,
        rated_temp_max=80.0
    )
    reading = SensorReading(
        machine_id="MOTOR_TEST",
        voltage=228.0,
        current=10.5,  # > 110% of 8.5 (9.35A)
        temperature=45.0,
        vibration=1.4,
        is_valid=True
    )
    violations = evaluate_threshold_rules(machine, reading)
    assert any(v.severity == "critical" and v.metric == "current" for v in violations)

def test_rules_vibration_critical():
    machine = Machine(
        machine_id="MOTOR_TEST",
        name="Test Motor",
        type="AC_MOTOR",
        rated_voltage=230.0,
        rated_current=8.5,
        rated_temp_max=80.0
    )
    reading = SensorReading(
        machine_id="MOTOR_TEST",
        voltage=228.0,
        current=7.0,
        temperature=45.0,
        vibration=5.5,  # > 4.5 m/s2 ISO critical
        is_valid=True
    )
    violations = evaluate_threshold_rules(machine, reading)
    assert any(v.severity == "critical" and v.metric == "vibration" for v in violations)
