"""
Google Earth Engine Service
Provides real-time satellite tile URLs and band index statistics
for Karnataka monitoring sites using the authenticated EE Python API.

Authentication: Uses the credentials stored by `earthengine authenticate`
(~/.config/earthengine/credentials) via ee.Initialize().
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, timedelta
from functools import lru_cache
from typing import Any

import ee

logger = logging.getLogger(__name__)

EE_PROJECT = "forensic-intelligence-511405"

# ── Sentinel-2 collection (Surface Reflectance, harmonised) ──────────────────
S2_COLLECTION = "COPERNICUS/S2_SR_HARMONIZED"

# Default Karnataka bounding box coordinates
_KARNATAKA_COORDS = [74.0, 11.5, 78.6, 18.5]


# ─────────────────────────────────────────────────────────────────────────────
#  Initialisation
# ─────────────────────────────────────────────────────────────────────────────

_ee_initialized = False


def initialize_ee() -> bool:
    """
    Initialise Earth Engine using saved credentials.
    Returns True on success, False on failure.
    """
    global _ee_initialized
    if _ee_initialized:
        return True
    try:
        ee.Initialize(project=EE_PROJECT)
        _ee_initialized = True
        logger.info("Google Earth Engine initialised successfully (project=%s)", EE_PROJECT)
        return True
    except Exception as exc:
        logger.warning("Earth Engine initialisation failed: %s", exc)
        return False


def is_ee_available() -> bool:
    return _ee_initialized


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _date_range(days_back: int = 60) -> tuple[str, str]:
    end = date.today()
    start = end - timedelta(days=days_back)
    return start.isoformat(), end.isoformat()


def _mask_s2_clouds(image: ee.Image) -> ee.Image:
    """Remove clouds using the Sentinel-2 QA60 band."""
    qa = image.select("QA60")
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
        qa.bitwiseAnd(cirrus_bit_mask).eq(0)
    )
    return image.updateMask(mask).divide(10000).copyProperties(
        image, ["system:time_start"]
    )


def _add_indices(image: ee.Image) -> ee.Image:
    """Compute NDVI, NDWI, and BSI bands."""
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
    ndwi = image.normalizedDifference(["B3", "B8"]).rename("NDWI")
    # BSI = ((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))
    bsi = image.expression(
        "((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))",
        {
            "B11": image.select("B11"),
            "B4": image.select("B4"),
            "B8": image.select("B8"),
            "B2": image.select("B2"),
        },
    ).rename("BSI")
    return image.addBands([ndvi, ndwi, bsi])


def _get_recent_composite(geometry: ee.Geometry, days_back: int = 60) -> ee.Image:
    """Return a cloud-free median composite over the last `days_back` days."""
    start, end = _date_range(days_back)
    collection = (
        ee.ImageCollection(S2_COLLECTION)
        .filterBounds(geometry)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        .map(_mask_s2_clouds)
        .map(_add_indices)
    )
    return collection.median()


def _geometry_from_bbox(bbox: list[float]) -> ee.Geometry:
    """Create an EE Geometry from [minLon, minLat, maxLon, maxLat]."""
    return ee.Geometry.Rectangle(bbox)


def _geometry_from_geojson(geojson: dict) -> ee.Geometry:
    """Convert a GeoJSON geometry dict to an EE Geometry."""
    return ee.Geometry(geojson)


# ─────────────────────────────────────────────────────────────────────────────
#  Public API — all functions run in a thread pool (EE calls are blocking)
# ─────────────────────────────────────────────────────────────────────────────

async def get_ee_tile_url(
    vis_type: str = "true_color",
    geometry: dict | None = None,
    days_back: int = 60,
) -> dict[str, Any]:
    """
    Return a MapLibre-compatible XYZ tile URL from Earth Engine.

    vis_type options:
        - "true_color"  → RGB (B4/B3/B2)
        - "false_color" → NIR composite (B8/B4/B3)
        - "ndvi"        → NDVI single-band
        - "ndwi"        → NDWI single-band
        - "bsi"         → BSI single-band
    """
    def _fetch():
        if geometry:
            aoi = _geometry_from_geojson(geometry)
        else:
            aoi = ee.Geometry.Rectangle(_KARNATAKA_COORDS)

        composite = _get_recent_composite(aoi, days_back)

        VIS_PARAMS: dict[str, dict] = {
            "true_color": {
                "bands": ["B4", "B3", "B2"],
                "min": 0,
                "max": 0.3,
                "gamma": 1.4,
            },
            "false_color": {
                "bands": ["B8", "B4", "B3"],
                "min": 0,
                "max": 0.4,
                "gamma": 1.2,
            },
            "ndvi": {
                "bands": ["NDVI"],
                "min": -0.2,
                "max": 0.8,
                "palette": ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"],
            },
            "ndwi": {
                "bands": ["NDWI"],
                "min": -0.5,
                "max": 0.5,
                "palette": ["#8c510a", "#f6e8c3", "#c7eae5", "#01665e"],
            },
            "bsi": {
                "bands": ["BSI"],
                "min": -0.5,
                "max": 0.5,
                "palette": ["#1a9850", "#ffffbf", "#d73027"],
            },
        }

        params = VIS_PARAMS.get(vis_type, VIS_PARAMS["true_color"])
        map_id = composite.getMapId(params)
        tile_url = map_id["tile_fetcher"].url_format

        start, end = _date_range(days_back)
        return {
            "tile_url": tile_url,
            "vis_type": vis_type,
            "date_range": {"start": start, "end": end},
            "source": "Google Earth Engine / Sentinel-2 SR Harmonized",
        }

    return await asyncio.get_event_loop().run_in_executor(None, _fetch)


async def get_site_stats(
    geometry: dict,
    days_back: int = 60,
) -> dict[str, Any]:
    """
    Compute mean NDVI, NDWI, and BSI for the given GeoJSON geometry
    over the last `days_back` days. Returns a dict with stats + date range.
    """
    def _fetch():
        aoi = _geometry_from_geojson(geometry)
        composite = _get_recent_composite(aoi, days_back)

        stats = composite.select(["NDVI", "NDWI", "BSI"]).reduceRegion(
            reducer=ee.Reducer.mean().combine(
                reducer2=ee.Reducer.stdDev(), sharedInputs=True
            ).combine(
                reducer2=ee.Reducer.minMax(), sharedInputs=True
            ),
            geometry=aoi,
            scale=20,
            maxPixels=1e9,
            bestEffort=True,
        ).getInfo()

        start, end = _date_range(days_back)
        # Count scenes used
        scene_count = (
            ee.ImageCollection(S2_COLLECTION)
            .filterBounds(aoi)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
            .size()
            .getInfo()
        )

        return {
            "ndvi_mean": round(stats.get("NDVI_mean") or 0, 4),
            "ndvi_stddev": round(stats.get("NDVI_stdDev") or 0, 4),
            "ndwi_mean": round(stats.get("NDWI_mean") or 0, 4),
            "ndwi_stddev": round(stats.get("NDWI_stdDev") or 0, 4),
            "bsi_mean": round(stats.get("BSI_mean") or 0, 4),
            "bsi_stddev": round(stats.get("BSI_stdDev") or 0, 4),
            "scene_count": scene_count,
            "date_range": {"start": start, "end": end},
            "source": "Google Earth Engine / Sentinel-2 SR Harmonized",
        }

    return await asyncio.get_event_loop().run_in_executor(None, _fetch)


async def get_karnataka_overview() -> dict[str, Any]:
    """
    Return tile URLs for all key visualisations over Karnataka
    plus a recent scene count — suitable for dashboard status widget.
    """
    def _fetch():
        aoi = ee.Geometry.Rectangle(_KARNATAKA_COORDS)
        start, end = _date_range(60)

        scene_count = (
            ee.ImageCollection(S2_COLLECTION)
            .filterBounds(aoi)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
            .size()
            .getInfo()
        )

        composite = _get_recent_composite(aoi, 60)

        def _url(vis):
            params = {
                "true_color": {"bands": ["B4", "B3", "B2"], "min": 0, "max": 0.3, "gamma": 1.4},
                "ndvi": {"bands": ["NDVI"], "min": -0.2, "max": 0.8,
                         "palette": ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"]},
                "ndwi": {"bands": ["NDWI"], "min": -0.5, "max": 0.5,
                         "palette": ["#8c510a", "#f6e8c3", "#c7eae5", "#01665e"]},
                "bsi":  {"bands": ["BSI"],  "min": -0.5, "max": 0.5,
                         "palette": ["#1a9850", "#ffffbf", "#d73027"]},
            }[vis]
            return composite.getMapId(params)["tile_fetcher"].url_format

        return {
            "scene_count": scene_count,
            "date_range": {"start": start, "end": end},
            "tiles": {
                "true_color": _url("true_color"),
                "ndvi": _url("ndvi"),
                "ndwi": _url("ndwi"),
                "bsi": _url("bsi"),
            },
            "source": "Google Earth Engine / Sentinel-2 SR Harmonized",
            "ee_project": EE_PROJECT,
        }

    return await asyncio.get_event_loop().run_in_executor(None, _fetch)
