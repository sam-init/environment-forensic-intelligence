"""
Sites API router — CRUD for monitoring sites & AOIs.
Uses persistent site_store for reliable real-site management, custom monitoring durations,
and Belagavi district real-site monitoring.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import SiteCreate, SiteListResponse, SiteResponse, SiteUpdate
from app.services.site_store import add_site, delete_site as remove_site, load_sites


router = APIRouter(prefix="/sites", tags=["Sites"])


def _to_site_response(s: dict) -> SiteResponse:
    # Ensure datetime parsing for ISO strings
    created = s.get("created_at")
    if isinstance(created, str):
        try:
            created = datetime.fromisoformat(created)
        except Exception:
            created = datetime.utcnow()
    elif not created:
        created = datetime.utcnow()

    updated = s.get("updated_at")
    if isinstance(updated, str):
        try:
            updated = datetime.fromisoformat(updated)
        except Exception:
            updated = datetime.utcnow()
    elif not updated:
        updated = datetime.utcnow()

    end_date = s.get("monitoring_end_date")
    if isinstance(end_date, str):
        try:
            end_date = datetime.fromisoformat(end_date)
        except Exception:
            end_date = None

    return SiteResponse(
        id=s["id"],
        name=s["name"],
        description=s.get("description"),
        area_name=s.get("area_name"),
        latitude=s.get("latitude"),
        longitude=s.get("longitude"),
        geometry=s["geometry"],
        area_ha=s.get("area_ha"),
        status=s.get("status", "active"),
        is_demo=bool(s.get("is_demo", False)),
        monitoring_enabled=bool(s.get("monitoring_enabled", True)),
        monitoring_duration_months=s.get("monitoring_duration_months", 3),
        monitoring_end_date=end_date,
        monitoring_interval_days=s.get("monitoring_interval_days", 5),
        cloud_threshold=float(s.get("cloud_threshold", 25.0)),
        min_valid_pixels=float(s.get("min_valid_pixels", 75.0)),
        risk_threshold=int(s.get("risk_threshold", 40)),
        created_at=created,
        updated_at=updated,
    )


@router.get("", response_model=SiteListResponse)
async def list_sites(
    db: Annotated[AsyncSession | None, Depends(get_db)] = None,
    include_demo: bool = Query(default=False),
    status_filter: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> SiteListResponse:
    """List all active real monitoring sites (demo sites excluded by default)."""
    all_sites = load_sites()

    # Filter out demo sites unless explicitly requested
    filtered = [
        s for s in all_sites
        if (include_demo or not s.get("is_demo", False))
        and (not status_filter or s.get("status") == status_filter)
    ]

    total = len(filtered)
    paged = filtered[skip : skip + limit]

    return SiteListResponse(
        total=total,
        items=[_to_site_response(s) for s in paged],
    )


@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def create_site(
    payload: SiteCreate,
    db: Annotated[AsyncSession | None, Depends(get_db)] = None,
) -> SiteResponse:
    """
    Create a new real monitoring site.
    Supports monitoring duration (e.g. 1 month, 3 months, 6 months) and lat/long coordinates.
    """
    raw_payload = payload.model_dump()
    if payload.geometry:
        raw_payload["geometry"] = payload.geometry.model_dump()

    created = add_site(raw_payload)
    return _to_site_response(created)


@router.get("/{site_id}", response_model=SiteResponse)
async def get_site(site_id: str) -> SiteResponse:
    """Get site details by ID."""
    sites = load_sites()
    match = next((s for s in sites if s["id"] == site_id), None)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitoring site '{site_id}' not found.",
        )
    return _to_site_response(match)


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_monitoring_site(site_id: str) -> None:
    """Remove a site from monitoring."""
    success = remove_site(site_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitoring site '{site_id}' not found.",
        )
