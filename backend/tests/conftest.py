import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment
os.environ["AUTH_ENABLED"] = "false"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["MODEL_DIR"] = "./test_models"

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.all_models import Machine, Device
from app.core.security import hash_api_key

TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test machine
    machine = Machine(
        machine_id="MOTOR_TEST",
        name="Test AC Motor",
        type="AC_MOTOR",
        rated_voltage=230.0,
        rated_current=8.5,
        rated_temp_max=80.0,
        location="Lab Unit",
        learning_status="COLLECTING_BASELINE"
    )
    db.add(machine)
    
    device = Device(
        machine_id="MOTOR_TEST",
        name="Test Gateway",
        api_key_hash=hash_api_key("test_api_key_123"),
        is_active=True
    )
    db.add(device)
    db.commit()

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
