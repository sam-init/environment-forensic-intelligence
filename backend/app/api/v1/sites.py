"""
Sites API router — CRUD for monitoring sites + AOIs.
Includes in-memory demo fallback when PostgreSQL container is offline.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Site, SiteStatus
from app.schemas import SiteCreate, SiteListResponse, SiteResponse, SiteUpdate
from app.services.geometry import validate_and_normalize_geometry
from app.services.demo_data import DEMO_SITES

router = APIRouter(prefix="/sites", tags=["Sites"])


@router.get("", response_model=SiteListResponse)
async def list_sites(
    db: Annotated[AsyncSession | None, Depends(get_db)],
    include_demo: bool = Query(default=True),
    status_filter: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> SiteListResponse:
    """List all monitoring sites."""
    if db is None:
        # Fallback for standalone demo mode without Postgres container
        demo_items = [
            SiteResponse(
                id=f"demo-site-{i+1}",
                name=ds["name"],
                description=ds["description"],
                geometry=ds["geometry"],
                area_ha=ds["area_ha"],
                status="active",
                is_demo=True,
                monitoring_enabled=True,
                monitoring_interval_days=5,
                cloud_threshold=20.0,
                min_valid_pixels=80.0,
                risk_threshold=50,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            for i, ds in enumerate(DEMO_SITES)
        ]
        return SiteListResponse(total=len(demo_items), items=demo_items)

    try:
        q = select(Site).where(Site.deleted_at.is_(None))
        if not include_demo:
            q = q.where(Site.is_demo == False)  # noqa: E712
        if status_filter:
            q = q.where(Site.status == status_filter)

        total_q = select(func.count()).select_from(q.subquery())
        total = (await db.execute(total_q)).scalar() or 0

        result = await db.execute(q.offset(skip).limit(limit))
        sites = result.scalars().all()

        return SiteListResponse(
            total=total,
            items=[_serialize_site(s) for s in sites],
        )
    except Exception:
        # Fallback if DB query fails
        demo_items = [
            SiteResponse(
                id=f"demo-site-{i+1}",
                name=ds["name"],
                description=ds["description"],
                geometry=ds["geometry"],
                area_ha=ds["area_ha"],
                status="active",
                is_demo=True,
                monitoring_enabled=True,
                monitoring_interval_days=5,
                cloud_threshold=20.0,
                min_valid_pixels=80.0,
                risk_threshold=50,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            for i, ds in enumerate(DEMO_SITES)
        ]
        return SiteListResponse(total=len(demo_items), items=demo_items)


@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def create_site(
    payload: SiteCreate,
    db: Annotated[AsyncSession | None, Depends(get_db)],
) -> SiteResponse:
    """Create a new monitoring site with an AOI polygon."""
    try:
        geojson_str = json.dumps(payload.geometry.model_dump())
        normalized_wkt, area_ha = validate_and_normalize_geometry(geojson_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    if db is None:
        # Return in-memory created site response when DB offline
        return SiteResponse(
            id=str(uuid.uuid4()),
            name=payload.name,
            description=payload.description,
            geometry=payload.geometry.model_dump(),
            area_ha=area_ha,
            status="active",
            is_demo=True,
            monitoring_enabled=True,
            monitoring_interval_days=payload.monitoring_interval_days,
            cloud_threshold=payload.cloud_threshold,
            min_valid_pixels=payload.min_valid_pixels,
            risk_threshold=payload.risk_threshold,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

    site = Site(
        id=str(uuid.uuid4()),
        name=payload.name,
        description=payload.description,
        geometry=f"SRID=4326;{normalized_wkt}",
        area_ha=area_ha,
        monitoring_interval_days=payload.monitoring_interval_days,
        cloud_threshold=payload.cloud_threshold,
        min_valid_pixels=payload.min_valid_pixels,
        risk_threshold=payload.risk_threshold,
    )
    db.add(site)
    await db.flush()
    await db.refresh(site)
    return _serialize_site(site)


@router.get("/{site_id}", response_model=SiteResponse)
async def get_site(
    site_id: str,
    db: Annotated[AsyncSession | None, Depends(get_db)],
) -> SiteResponse:
    """Get a single monitoring site by ID."""
    if db is None:
        ds = DEMO_SITES[0]
        return SiteResponse(
            id=site_id,
            name=ds["name"],
            description=ds["description"],
            geometry=ds["geometry"],
            area_ha=ds["area_ha"],
            status="active",
            is_demo=True,
            monitoring_enabled=True,
            monitoring_interval_days=5,
            cloud_threshold=20.0,
            min_valid_pixels=80.0,
            risk_threshold=50,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    site = await _get_site_or_404(site_id, db)
    return _serialize_site(site)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_site_or_404(site_id: str, db: AsyncSession) -> Site:
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.deleted_at.is_(None))
    )
    site = result.scalar_one_or_none()
    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id!r} not found.",
        )
    return site


def _serialize_site(site: Site) -> SiteResponse:
    from geoalchemy2.shape import to_shape
    geom_dict: dict = {}
    if site.geometry is not None:
        try:
            geom_shape = to_shape(site.geometry)
            geom_dict = {
                "type": geom_shape.geom_type,
                "coordinates": list(geom_shape.__geo_interface__["coordinates"]),
            }
        except Exception:
            geom_dict = {}

    return SiteResponse(
        id=site.id,
        name=site.name,
        description=site.description,
        geometry=geom_dict,
        area_ha=site.area_ha,
        status=site.status,
        is_demo=site.is_demo,
        monitoring_enabled=site.monitoring_enabled,
        monitoring_interval_days=site.monitoring_interval_days,
        cloud_threshold=site.cloud_threshold,
        min_valid_pixels=site.min_valid_pixels,
        risk_threshold=site.risk_threshold,
        created_at=site.created_at,
        updated_at=site.updated_at,
    )
