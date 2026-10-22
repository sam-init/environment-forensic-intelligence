"""API v1 router aggregator."""
from fastapi import APIRouter

from app.api.v1 import change_detection, earth_engine, events, observations, sites, system

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(sites.router)
api_router.include_router(events.router)
api_router.include_router(observations.router)
api_router.include_router(system.router)
api_router.include_router(earth_engine.router)
api_router.include_router(change_detection.router)
