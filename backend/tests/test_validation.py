from app.services.validation import validate_sensor_reading

def test_validate_normal_reading():
    is_valid, errors = validate_sensor_reading(
        temperature=45.2,
        humidity=50.0,
        current=7.1,
        voltage=230.0,
        vibration=1.5
    )
    assert is_valid is True
    assert len(errors) == 0

def test_validate_out_of_range_reading():
    is_valid, errors = validate_sensor_reading(
        temperature=250.0,  # too high
        humidity=-5.0,     # negative
        current=7.1,
        voltage=230.0,
        vibration=1.5
    )
    assert is_valid is False
    assert len(errors) == 2
