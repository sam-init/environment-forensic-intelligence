"""
Earth Engine API router.
Provides endpoints for real-time GEE tile URLs, bicubic high-resolution scene tiles,
and before-and-after temporal comparison with change metrics.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.services.earth_engine import (
    get_before_after_comparison,
    get_date_scene_tile,
    get_ee_tile_url,
    get_karnataka_overview,
    get_site_stats,
    is_ee_available,
)

router = APIRouter(prefix="/earth-engine", tags=["Earth Engine"])


def _require_ee():
    if not is_ee_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Earth Engine is not initialised. "
                   "Run `earthengine authenticate` and restart the server.",
        )


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def ee_status() -> dict:
    """Return whether Earth Engine is available."""
    return {"available": is_ee_available(), "project": "forensic-intelligence-511405"}


# ── Karnataka Overview ────────────────────────────────────────────────────────

@router.get("/overview")
async def karnataka_overview() -> dict[str, Any]:
    """
    Return Sentinel-2 tile URLs and scene count for the full Karnataka AOI.
    Includes true-colour, NDVI, NDWI, and BSI tile sets with bicubic resampling.
    """
    _require_ee()
    try:
        return await get_karnataka_overview()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Earth Engine error: {exc}",
        ) from exc


# ── Tile URL (Composite) ──────────────────────────────────────────────────────

@router.get("/tiles")
async def tile_url(
    vis_type: str = Query(
        default="true_color",
        description="Visualisation type: true_color | false_color | ndvi | ndwi | bsi",
    ),
    days_back: int = Query(default=60, ge=10, le=365),
    min_lon: float | None = Query(default=None),
    min_lat: float | None = Query(default=None),
    max_lon: float | None = Query(default=None),
    max_lat: float | None = Query(default=None),
) -> dict[str, Any]:
    """
    Return a MapLibre-compatible XYZ tile URL for the requested visualisation.
    Optionally restrict to a bounding box (min_lon, min_lat, max_lon, max_lat).
    """
    _require_ee()

    geometry: dict | None = None
    if all(v is not None for v in [min_lon, min_lat, max_lon, max_lat]):
        geometry = {
            "type": "Polygon",
            "coordinates": [[
                [min_lon, min_lat],
                [max_lon, min_lat],
                [max_lon, max_lat],
                [min_lon, max_lat],
                [min_lon, min_lat],
            ]],
        }

    if vis_type not in {"true_color", "false_color", "ndvi", "ndwi", "bsi"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="vis_type must be one of: true_color, false_color, ndvi, ndwi, bsi",
        )

    try:
        return await get_ee_tile_url(vis_type=vis_type, geometry=geometry, days_back=days_back)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Earth Engine error: {exc}",
        ) from exc


# ── Specific Date Scene Tile ──────────────────────────────────────────────────

@router.get("/scene-tile")
async def scene_tile(
    target_date: str = Query(..., description="Target date in YYYY-MM-DD format"),
    vis_type: str = Query(default="true_color", description="true_color | false_color | ndvi | ndwi | bsi"),
    window_days: int = Query(default=25, ge=5, le=90),
    min_lon: float | None = Query(default=None),
    min_lat: float | None = Query(default=None),
    max_lon: float | None = Query(default=None),
    max_lat: float | None = Query(default=None),
) -> dict[str, Any]:
    """
    Find the clearest Sentinel-2 scene around target_date and return
    a razor-sharp bicubic-resampled tile URL.
    """
    _require_ee()

    geometry: dict | None = None
    if all(v is not None for v in [min_lon, min_lat, max_lon, max_lat]):
        geometry = {
            "type": "Polygon",
            "coordinates": [[
                [min_lon, min_lat],
                [max_lon, min_lat],
                [max_lon, max_lat],
                [min_lon, max_lat],
                [min_lon, min_lat],
            ]],
        }

    try:
        return await get_date_scene_tile(
            target_date=target_date,
            geometry=geometry,
            vis_type=vis_type,
            window_days=window_days,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Earth Engine error: {exc}",
        ) from exc


# ── Before & After Temporal Comparison ────────────────────────────────────────

@router.get("/compare")
async def compare_dates(
    before_date: str = Query(..., description="Before date (YYYY-MM-DD)"),
    after_date: str = Query(..., description="After / current date (YYYY-MM-DD)"),
    vis_type: str = Query(default="true_color", description="true_color | false_color | ndvi | ndwi | bsi"),
    window_days: int = Query(default=25, ge=5, le=90),
    min_lon: float | None = Query(default=None),
    min_lat: float | None = Query(default=None),
    max_lon: float | None = Query(default=None),
    max_lat: float | None = Query(default=None),
) -> dict[str, Any]:
    """
    Generate paired before & after high-resolution Sentinel-2 tile sets for side-by-side
    or split-screen comparison of land mining, sand extraction, or excavation.
    """
    _require_ee()

    geometry: dict | None = None
    if all(v is not None for v in [min_lon, min_lat, max_lon, max_lat]):
        geometry = {
            "type": "Polygon",
            "coordinates": [[
                [min_lon, min_lat],
                [max_lon, min_lat],
                [max_lon, max_lat],
                [min_lon, max_lat],
                [min_lon, min_lat],
            ]],
        }

    try:
        return await get_before_after_comparison(
            before_date=before_date,
            after_date=after_date,
            geometry=geometry,
            vis_type=vis_type,
            window_days=window_days,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Earth Engine error: {exc}",
        ) from exc


@router.post("/compare")
async def compare_dates_post(
    payload: dict,
    before_date: str = Query(..., description="Before date (YYYY-MM-DD)"),
    after_date: str = Query(..., description="After / current date (YYYY-MM-DD)"),
    vis_type: str = Query(default="true_color"),
    window_days: int = Query(default=25, ge=5, le=90),
) -> dict[str, Any]:
    """
    Generate paired before & after tiles with GeoJSON geometry in request body
    to compute change metrics (NDVI loss, BSI excavation increase).
    """
    _require_ee()
    geometry = payload.get("geometry")

    try:
        return await get_before_after_comparison(
            before_date=before_date,
            after_date=after_date,
            geometry=geometry,
            vis_type=vis_type,
            window_days=window_days,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Earth Engine error: {exc}",
        ) from exc


# ── Site Statistics ───────────────────────────────────────────────────────────

@router.post("/site-stats")
async def site_statistics(
    payload: dict,
    days_back: int = Query(default=60, ge=10, le=365),
) -> dict[str, Any]:
    """
    Compute mean NDVI, NDWI, and BSI for a GeoJSON geometry.
    POST body: { "geometry": { "type": "Polygon", "coordinates": [...] } }
    """
    _require_ee()

    geometry = payload.get("geometry")
    if not geometry:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Request body must contain a 'geometry' key with a GeoJSON geometry.",
        )

    try:
        return await get_site_stats(geometry=geometry, days_back=days_back)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Earth Engine error: {exc}",
        ) from exc
