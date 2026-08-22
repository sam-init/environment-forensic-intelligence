"""
Events API router — forensic event listing, detail, and review workflow.
Includes in-memory demo fallback when PostgreSQL container is offline.
"""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import ForensicEvent, Review
from app.schemas import (
    EventListResponse,
    EventResponse,
    EventReviewUpdate,
)
from app.services.demo_data import DEMO_EVENTS

router = APIRouter(prefix="/events", tags=["Events"])


def _get_demo_events_serialized() -> list[EventResponse]:
    """Return synthetic demo events for offline fallback mode."""
    now = datetime.utcnow()
    res = []
    for de in DEMO_EVENTS:
        # Build standard GeoJSON polygon from WKT
        # DEMO_EVENTS contains geometry_wkt
        # e.g. "MULTIPOLYGON(((76.3920 15.2750, 76.3950 15.2750, ...)))"
        wkt = de.get("geometry_wkt", "")
        geom_dict = None
        if wkt:
            try:
                from shapely.wkt import loads
                geom_shape = loads(wkt)
                geom_dict = geom_shape.__geo_interface__
            except Exception:
                geom_dict = None

        res.append(
            EventResponse(
                id=f"demo-event-{de['event_id']}",
                event_id=de["event_id"],
                site_id=f"demo-site-{de['site_index']+1}",
                category=de["category"],
                status="unreviewed",
                first_observed=now,
                last_observed=now,
                observation_count=de["observation_count"],
                geometry=geom_dict,
                area_ha=de["area_ha"],
                risk_score=de["risk_score"],
                risk_level=de["risk_level"],
                confidence=de["confidence"],
                distance_to_river_m=de["distance_to_river_m"],
                distance_to_road_m=de["distance_to_road_m"],
                distance_to_protected_area_m=de["distance_to_protected_area_m"],
                inside_mining_lease=de["inside_mining_lease"],
                lease_data_available=de["lease_data_available"],
                explanation=de["explanation"],
                limitations=de["limitations"],
                recommended_actions=de["recommended_actions"],
                is_demo=True,
                created_at=now,
                updated_at=now,
            )
        )
    return res


@router.get("", response_model=EventListResponse)
async def list_events(
    db: Annotated[AsyncSession | None, Depends(get_db)],
    site_id: str | None = Query(default=None),
    category: str | None = Query(default=None),
    status_filter: str | None = Query(default=None),
    risk_min: int | None = Query(default=None, ge=0, le=100),
    risk_max: int | None = Query(default=None, ge=0, le=100),
    include_demo: bool = Query(default=True),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> EventListResponse:
    """List forensic events with filters."""
    if db is None:
        demo_events = _get_demo_events_serialized()
        return EventListResponse(total=len(demo_events), items=demo_events)

    try:
        q = select(ForensicEvent).where(ForensicEvent.deleted_at.is_(None))

        if site_id:
            q = q.where(ForensicEvent.site_id == site_id)
        if category:
            q = q.where(ForensicEvent.category == category)
        if status_filter:
            q = q.where(ForensicEvent.status == status_filter)
        if risk_min is not None:
            q = q.where(ForensicEvent.risk_score >= risk_min)
        if risk_max is not None:
            q = q.where(ForensicEvent.risk_score <= risk_max)
        if not include_demo:
            q = q.where(ForensicEvent.is_demo == False)  # noqa: E712

        q = q.order_by(ForensicEvent.risk_score.desc().nullslast(), ForensicEvent.created_at.desc())

        total_q = select(func.count()).select_from(q.subquery())
        total = (await db.execute(total_q)).scalar() or 0

        result = await db.execute(q.offset(skip).limit(limit))
        events = result.scalars().all()

        return EventListResponse(
            total=total,
            items=[_serialize_event(e) for e in events],
        )
    except Exception:
        demo_events = _get_demo_events_serialized()
        return EventListResponse(total=len(demo_events), items=demo_events)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    db: Annotated[AsyncSession | None, Depends(get_db)],
) -> EventResponse:
    """Get a single forensic event by event_id (ENV-YYYY-XXXXXX)."""
    if db is None:
        demo_events = _get_demo_events_serialized()
        for de in demo_events:
            if de.event_id == event_id or de.id == event_id:
                return de
        return demo_events[0]

    event = await _get_event_or_404(event_id, db)
    return _serialize_event(event)


@router.post("/{event_id}/review", response_model=EventResponse)
async def review_event(
    event_id: str,
    payload: EventReviewUpdate,
    db: Annotated[AsyncSession | None, Depends(get_db)],
) -> EventResponse:
    """Submit an analyst review for a forensic event."""
    if db is None:
        demo_events = _get_demo_events_serialized()
        target = demo_events[0]
        for de in demo_events:
            if de.event_id == event_id or de.id == event_id:
                target = de
                break
        target.status = payload.status
        return target

    import uuid

    event = await _get_event_or_404(event_id, db)
    previous_status = event.status

    # Update event status
    event.status = payload.status
    event.updated_at = datetime.utcnow()

    # Create review record
    review = Review(
        id=str(uuid.uuid4()),
        event_id=event.id,
        reviewer=payload.reviewer,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(review)

    # Audit log
    from app.models import AuditLog
    audit = AuditLog(
        id=str(uuid.uuid4()),
        action="event_reviewed",
        target_type="event",
        target_id=event.event_id,
        previous_state={"status": previous_status},
        new_state={"status": payload.status, "reviewer": payload.reviewer},
    )
    db.add(audit)

    await db.flush()
    await db.refresh(event)
    return _serialize_event(event)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_event_or_404(event_id: str, db: AsyncSession) -> ForensicEvent:
    result = await db.execute(
        select(ForensicEvent).where(
            (ForensicEvent.event_id == event_id) | (ForensicEvent.id == event_id),
            ForensicEvent.deleted_at.is_(None),
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id!r} not found.",
        )
    return event


def _serialize_event(event: ForensicEvent) -> EventResponse:
    from geoalchemy2.shape import to_shape
    geom_dict = None
    if event.geometry is not None:
        try:
            geom_shape = to_shape(event.geometry)
            geom_dict = geom_shape.__geo_interface__
        except Exception:
            geom_dict = None

    return EventResponse(
        id=event.id,
        event_id=event.event_id,
        site_id=event.site_id,
        category=event.category,
        status=event.status,
        first_observed=event.first_observed,
        last_observed=event.last_observed,
        observation_count=event.observation_count,
        geometry=geom_dict,
        area_ha=event.area_ha,
        risk_score=event.risk_score,
        risk_level=event.risk_level,
        confidence=event.confidence,
        distance_to_river_m=event.distance_to_river_m,
        distance_to_road_m=event.distance_to_road_m,
        distance_to_protected_area_m=event.distance_to_protected_area_m,
        inside_mining_lease=event.inside_mining_lease,
        lease_data_available=event.lease_data_available,
        explanation=event.explanation,
        limitations=event.limitations,
        recommended_actions=event.recommended_actions,
        is_demo=event.is_demo,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )
