"""
System / analysis / jobs / demo API routes.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import check_database_connection, check_postgis_available, get_db
from app.models import ForensicEvent, Job, Observation, Site
from app.schemas import HealthResponse, JobResponse, ReadinessResponse

router = APIRouter(tags=["System"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """
    Basic liveness check.
    Returns 200 even if dependencies are not ready.
    Use /ready for full dependency check.
    """
    settings = get_settings()
    return HealthResponse(
        status="ok",
        timestamp=datetime.utcnow(),
        version="0.1.0",
        demo_mode=settings.demo_mode,
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness() -> ReadinessResponse:
    """
    Readiness check — verifies all critical dependencies.
    Returns 503 if any dependency is unavailable.
    """
    checks: dict[str, str] = {}

    db_ok = await check_database_connection()
    checks["database"] = "ok" if db_ok else "unavailable"

    postgis_ok = await check_postgis_available()
    checks["postgis"] = "ok" if postgis_ok else "unavailable"

    # Redis check
    try:
        import redis.asyncio as aioredis
        settings = get_settings()
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "unavailable"

    all_ok = all(v == "ok" for v in checks.values())
    overall_status = "ok" if all_ok else "degraded"

    return ReadinessResponse(
        status=overall_status,
        checks=checks,
        timestamp=datetime.utcnow(),
    )


@router.get("/api/v1/system/status")
async def system_status(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """System statistics for the dashboard header."""
    settings = get_settings()

    critical = (await db.execute(
        select(ForensicEvent).where(
            ForensicEvent.risk_score >= 75,
            ForensicEvent.deleted_at.is_(None),
            ForensicEvent.status.not_in(["false_positive", "closed"]),
        )
    )).scalars().all()

    high = (await db.execute(
        select(ForensicEvent).where(
            ForensicEvent.risk_score >= 50,
            ForensicEvent.risk_score < 75,
            ForensicEvent.deleted_at.is_(None),
            ForensicEvent.status.not_in(["false_positive", "closed"]),
        )
    )).scalars().all()

    moderate = (await db.execute(
        select(ForensicEvent).where(
            ForensicEvent.risk_score >= 25,
            ForensicEvent.risk_score < 50,
            ForensicEvent.deleted_at.is_(None),
            ForensicEvent.status.not_in(["false_positive", "closed"]),
        )
    )).scalars().all()

    site_count = (await db.execute(
        select(Site).where(Site.deleted_at.is_(None))
    )).scalars().all()

    return {
        "demo_mode": settings.demo_mode,
        "copernicus_available": settings.copernicus_available,
        "active_signals": {
            "critical": len(critical),
            "high": len(high),
            "moderate": len(moderate),
        },
        "sites_monitored": len(site_count),
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/api/v1/jobs", response_model=list[JobResponse])
async def list_jobs(
    db: Annotated[AsyncSession, Depends(get_db)],
    site_id: str | None = None,
    limit: int = 20,
) -> list[JobResponse]:
    """List recent background jobs."""
    q = select(Job).order_by(Job.created_at.desc())
    if site_id:
        q = q.where(Job.site_id == site_id)
    q = q.limit(limit)
    result = await db.execute(q)
    jobs = result.scalars().all()
    return [JobResponse.model_validate(j) for j in jobs]


@router.post("/api/v1/demo/seed", status_code=status.HTTP_201_CREATED)
async def seed_demo_data(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Seed the database with clearly marked DEMO DATA for Karnataka, India.
    This endpoint only inserts demo records — never real incidents.
    All records are flagged is_demo=True.
    Demo mode must be active to call this endpoint.
    """
    settings = get_settings()
    if not settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo seeding is only available in DEMO_MODE=true.",
        )

    from app.services.demo_data import seed_karnataka_demo
    result = await seed_karnataka_demo(db)
    return {"status": "seeded", "summary": result}
