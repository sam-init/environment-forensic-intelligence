"""
Observations API router.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Observation
from app.schemas import ObservationListResponse, ObservationResponse

router = APIRouter(prefix="/observations", tags=["Observations"])


@router.get("", response_model=ObservationListResponse)
async def list_observations(
    db: Annotated[AsyncSession, Depends(get_db)],
    site_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None),
    include_demo: bool = Query(default=True),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> ObservationListResponse:
    """List satellite observations, optionally filtered by site."""
    q = select(Observation)
    if site_id:
        q = q.where(Observation.site_id == site_id)
    if status_filter:
        q = q.where(Observation.status == status_filter)
    if not include_demo:
        q = q.where(Observation.is_demo == False)  # noqa: E712

    q = q.order_by(Observation.acquisition_date.desc())

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar() or 0
    result = await db.execute(q.offset(skip).limit(limit))
    observations = result.scalars().all()

    return ObservationListResponse(
        total=total,
        items=[
            ObservationResponse.model_validate(obs)
            for obs in observations
        ],
    )
