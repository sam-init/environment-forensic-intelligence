"""Bounded, tile-based satellite change-detection endpoints."""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import MultiPolygon, shape
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.earth_engine import _require_ee
from app.core.database import get_db
from app.models import ChangeCandidate, Job, JobStatus, JobType, ProcessingTile
from app.schemas.schemas import GenerateTileGridRequest, QueueTileRunRequest, SingleTileChangeRequest
from app.services.change_detection import ComparisonPeriod, generate_grid_tiles, processing_signature
from app.services.earth_engine import detect_single_tile_change, get_karnataka_boundary

router = APIRouter(prefix="/change-detection", tags=["Tile Change Detection"])


def _as_multipolygon(geojson: dict):
    geometry = shape(geojson)
    return MultiPolygon([geometry]) if geometry.geom_type == "Polygon" else geometry


@router.post("/tiles/generate")
async def generate_karnataka_grid(
    payload: GenerateTileGridRequest,
    db: Annotated[AsyncSession | None, Depends(get_db)],
) -> dict:
    """Fetch the GEE Karnataka boundary and persist an intersected metric grid."""
    _require_ee()
    if db is None:
        raise HTTPException(status_code=503, detail="PostGIS is required to persist processing tiles.")
    boundary = await asyncio.get_running_loop().run_in_executor(None, get_karnataka_boundary)
    tiles = generate_grid_tiles(boundary, payload.tile_size_m)
    inserted = 0
    for tile in tiles:
        existing = (await db.execute(select(ProcessingTile).where(ProcessingTile.tile_id == tile["tile_id"]))).scalar_one_or_none()
        if existing:
            continue
        db.add(ProcessingTile(tile_id=tile["tile_id"], geometry=from_shape(_as_multipolygon(tile["geometry"]), srid=4326), tile_size_m=payload.tile_size_m, processing_log=[{"at": datetime.utcnow().isoformat(), "message": "Grid generated from GEE GAUL Karnataka boundary"}]))
        inserted += 1
    await db.flush()
    return {"boundary_source": "FAO/GAUL/2015/level1 via Google Earth Engine", "tile_size_m": payload.tile_size_m, "tile_count": len(tiles), "inserted": inserted}


@router.post("/tiles/{tile_id}/prototype")
async def process_single_tile_prototype(
    tile_id: str,
    payload: SingleTileChangeRequest,
    db: Annotated[AsyncSession | None, Depends(get_db)],
) -> dict:
    """Process exactly one stored tile; this is intentionally not a state-wide request."""
    _require_ee()
    if db is None:
        raise HTTPException(status_code=503, detail="PostGIS is required for tile processing.")
    tile = (await db.execute(select(ProcessingTile).where(ProcessingTile.tile_id == tile_id))).scalar_one_or_none()
    if tile is None:
        raise HTTPException(status_code=404, detail="Processing tile not found.")
    before, after = ComparisonPeriod(payload.before.start, payload.before.end), ComparisonPeriod(payload.after.start, payload.after.end)
    signature = processing_signature(before, after, payload.thresholds)
    if tile.last_input_signature == signature and tile.status == "completed":
        return {"tile_id": tile_id, "status": "cached", "message": "Unchanged inputs; tile was not processed again."}
    tile.status = "running"
    try:
        geojson = to_shape(tile.geometry).__geo_interface__
        result = await asyncio.get_running_loop().run_in_executor(None, detect_single_tile_change, geojson, before, after, payload.thresholds)
        for candidate in result["candidates"]:
            candidate_id = f"{tile_id}-{signature[:10]}-{candidate['candidate_index']:04d}"
            existing = (await db.execute(select(ChangeCandidate).where(ChangeCandidate.candidate_id == candidate_id))).scalar_one_or_none()
            if existing:
                continue
            db.add(ChangeCandidate(candidate_id=candidate_id, tile_id=tile.id, geometry=from_shape(_as_multipolygon(candidate["geometry"]), srid=4326), area_ha=candidate["area_ha"], before_start=datetime.combine(before.start, datetime.min.time()), before_end=datetime.combine(before.end, datetime.min.time()), after_start=datetime.combine(after.start, datetime.min.time()), after_end=datetime.combine(after.end, datetime.min.time()), imagery_ids={"before": result["before_scene_ids"], "after": result["after_scene_ids"]}, indicators=candidate["indicators"], change_score=candidate["change_score"], input_signature=signature, is_demo=False))
        tile.status, tile.last_input_signature, tile.last_processed_at = "completed", signature, datetime.utcnow()
        tile.processing_log = (tile.processing_log or []) + [{"at": datetime.utcnow().isoformat(), "message": f"Prototype complete: {len(result['candidates'])} spectral candidates"}]
        await db.flush()
        return {"tile_id": tile_id, "status": "completed", **result}
    except Exception as exc:
        tile.status, tile.error_message, tile.retries = "failed", str(exc), tile.retries + 1
        raise HTTPException(status_code=500, detail=f"Tile processing failed: {exc}") from exc


@router.post("/runs")
async def queue_tile_run(payload: QueueTileRunRequest, db: Annotated[AsyncSession | None, Depends(get_db)]) -> dict:
    """Queue a limited batch of independent tiles; repeated unchanged inputs are skipped."""
    _require_ee()
    if db is None:
        raise HTTPException(status_code=503, detail="PostGIS is required to queue tile jobs.")
    before, after = ComparisonPeriod(payload.before.start, payload.before.end), ComparisonPeriod(payload.after.start, payload.after.end)
    signature = processing_signature(before, after, payload.thresholds)
    query = select(ProcessingTile).where(or_(ProcessingTile.last_input_signature.is_(None), ProcessingTile.last_input_signature != signature))
    if payload.tile_ids:
        query = query.where(ProcessingTile.tile_id.in_(payload.tile_ids))
    tiles = (await db.execute(query.limit(payload.limit))).scalars().all()
    if not tiles:
        return {"queued": 0, "skipped": "All selected tiles already have this input signature."}
    try:
        from arq import create_pool
        from arq.connections import RedisSettings
        from app.core.config import get_settings
        redis = await create_pool(RedisSettings.from_dsn(get_settings().redis_url))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Redis/ARQ is unavailable: {exc}") from exc
    queued = []
    for tile in tiles:
        job = Job(job_type=JobType.PROCESS_CHANGE_TILE.value, status=JobStatus.PENDING.value, params={"tile_id": tile.tile_id, "signature": signature})
        db.add(job)
        await db.flush()
        await redis.enqueue_job("process_change_tile_job", job.id, tile.tile_id, before.start.isoformat(), before.end.isoformat(), after.start.isoformat(), after.end.isoformat(), payload.thresholds, signature, _job_id=f"change:{tile.tile_id}:{signature}")
        queued.append({"tile_id": tile.tile_id, "job_id": job.id})
    await redis.aclose()
    return {"queued": len(queued), "jobs": queued, "input_signature": signature}


@router.get("/candidates")
async def list_candidates(db: Annotated[AsyncSession | None, Depends(get_db)], limit: int = 200) -> dict:
    """List real, satellite-derived candidates only; synthetic events are excluded."""
    if db is None:
        return {"total": 0, "items": []}
    rows = (await db.execute(select(ChangeCandidate).where(ChangeCandidate.is_demo == False).order_by(ChangeCandidate.change_score.desc()).limit(limit))).scalars().all()  # noqa: E712
    return {"total": len(rows), "items": [{"candidate_id": row.candidate_id, "geometry": to_shape(row.geometry).__geo_interface__, "area_ha": row.area_ha, "before": {"start": row.before_start, "end": row.before_end, "scene_ids": row.imagery_ids.get("before", [])}, "after": {"start": row.after_start, "end": row.after_end, "scene_ids": row.imagery_ids.get("after", [])}, "indicators": row.indicators, "change_score": row.change_score, "status": row.status, "source": row.source, "high_resolution_source": row.high_resolution_source} for row in rows]}
