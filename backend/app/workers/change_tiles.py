"""ARQ jobs for bounded change-tile processing."""
from __future__ import annotations

import asyncio
from datetime import date, datetime

from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import MultiPolygon, shape
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models import ChangeCandidate, Job, JobStatus, ProcessingTile
from app.services.change_detection import ComparisonPeriod, polygonal_geometry
from app.services.earth_engine import detect_single_tile_change


def _multi(geojson: dict) -> MultiPolygon:
    value = polygonal_geometry(shape(geojson))
    if value is None:
        raise ValueError("Candidate geometry contains no polygonal area.")
    return value


async def process_change_tile_job(ctx: dict, job_id: str, tile_id: str, before_start: str, before_end: str, after_start: str, after_end: str, thresholds: dict, signature: str) -> None:
    """Idempotently process one tile. ARQ retry handling is configured in WorkerSettings."""
    async with AsyncSessionLocal() as db:
        job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one()
        tile = (await db.execute(select(ProcessingTile).where(ProcessingTile.tile_id == tile_id))).scalar_one()
        if tile.last_input_signature == signature and tile.status == JobStatus.COMPLETED.value:
            job.status, job.result, job.completed_at = JobStatus.COMPLETED.value, {"cached": True}, datetime.utcnow()
            await db.commit()
            return
        job.status, job.started_at, tile.status = JobStatus.RUNNING.value, datetime.utcnow(), JobStatus.RUNNING.value
        await db.commit()
        try:
            before = ComparisonPeriod(date.fromisoformat(before_start), date.fromisoformat(before_end))
            after = ComparisonPeriod(date.fromisoformat(after_start), date.fromisoformat(after_end))
            result = await asyncio.get_running_loop().run_in_executor(None, detect_single_tile_change, to_shape(tile.geometry).__geo_interface__, before, after, thresholds)
            for candidate in result["candidates"]:
                candidate_id = f"{tile_id}-{signature[:10]}-{candidate['candidate_index']:04d}"
                if (await db.execute(select(ChangeCandidate).where(ChangeCandidate.candidate_id == candidate_id))).scalar_one_or_none():
                    continue
                db.add(ChangeCandidate(candidate_id=candidate_id, tile_id=tile.id, geometry=from_shape(_multi(candidate["geometry"]), srid=4326), area_ha=candidate["area_ha"], before_start=datetime.combine(before.start, datetime.min.time()), before_end=datetime.combine(before.end, datetime.min.time()), after_start=datetime.combine(after.start, datetime.min.time()), after_end=datetime.combine(after.end, datetime.min.time()), imagery_ids={"before": result["before_scene_ids"], "after": result["after_scene_ids"]}, indicators=candidate["indicators"], change_score=candidate["change_score"], input_signature=signature, is_demo=False))
            tile.status, tile.last_input_signature, tile.last_processed_at = JobStatus.COMPLETED.value, signature, datetime.utcnow()
            job.status, job.result, job.completed_at = JobStatus.COMPLETED.value, {"candidate_count": len(result["candidates"])}, datetime.utcnow()
            await db.commit()
        except Exception as exc:
            tile.status, tile.error_message, tile.retries = JobStatus.RETRYING.value, str(exc), tile.retries + 1
            job.status, job.error_message, job.retries = JobStatus.RETRYING.value, str(exc), job.retries + 1
            await db.commit()
            raise
