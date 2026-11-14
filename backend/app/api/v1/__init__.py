from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.ingest import router as ingest_router
from app.api.v1.machines import router as machines_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.maintenance import router as maintenance_router
from app.api.v1.stream import router as stream_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(health_router)
api_v1_router.include_router(ingest_router)
api_v1_router.include_router(machines_router)
api_v1_router.include_router(alerts_router)
api_v1_router.include_router(maintenance_router)
api_v1_router.include_router(stream_router)
