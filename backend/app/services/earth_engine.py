"""
Google Earth Engine Service
Provides real-time Sentinel-2 satellite tile URLs with proper XYZ tile serving.

KEY DESIGN PRINCIPLE:
    Tile URLs are generated WITHOUT clipping to any geometry.
    GEE's tile server serves full native-resolution (10m Sentinel-2) tiles
    at all zoom levels — exactly like the GEE Code Editor.
    Geometry is ONLY used to filter which Sentinel-2 scenes are included
    in the median composite (to avoid scenes from far away dominating).

Authentication: Uses credentials stored by `earthengine authenticate`
(~/.config/earthengine/credentials) via ee.Initialize().
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Any

import ee

logger = logging.getLogger(__name__)

EE_PROJECT = "forensic-intelligence-511405"

# Sentinel-2 Surface Reflectance (harmonised)
S2_COLLECTION = "COPERNICUS/S2_SR_HARMONIZED"

# Default focus area — Karnataka mining hotspots (Hubli-Dharwad area)
# Used only for scene FILTERING, never for clipping tiles
_DEFAULT_FILTER_COORDS = [75.5, 14.0, 76.5, 15.5]  # ~150km × 150km

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
    """Remove clouds using Sentinel-2 QA60 band, scaling reflectance to 0..1."""
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
    """Compute NDVI, NDWI, and BSI bands on reflectance (0..1)."""
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
    ndwi = image.normalizedDifference(["B3", "B8"]).rename("NDWI")
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


def _get_composite_unclipped(filter_geometry: ee.Geometry, days_back: int = 60) -> ee.Image:
    """
    Build a cloud-free Sentinel-2 median composite.

    IMPORTANT: The composite is filtered by geometry (so only scenes covering
    the AOI are included), but is NOT clipped — the returned image has global
    extent so GEE can serve sharp XYZ tiles at any zoom level.
    """
    start, end = _date_range(days_back)
    collection = (
        ee.ImageCollection(S2_COLLECTION)
        .filterBounds(filter_geometry)        # filter SCENES only, don't clip
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 25))
        .map(_mask_s2_clouds)
        .map(_add_indices)
    )
    # mosaic() preserves global coverage; median() also works but is slower
    return collection.median()


def _geometry_from_geojson(geojson: dict) -> ee.Geometry:
    """Convert a GeoJSON geometry dict to an EE Geometry."""
    return ee.Geometry(geojson)


# ── Standard Visualization Configurations ────────────────────────────────────
VIS_PARAMS: dict[str, dict] = {
    "true_color": {
        "bands": ["B4", "B3", "B2"],  # Red, Green, Blue
        "min": 0.0,
        "max": 0.3,
        "gamma": 1.6,
    },
    "false_color": {
        "bands": ["B8", "B4", "B3"],  # NIR, Red, Green
        "min": 0.0,
        "max": 0.4,
        "gamma": 1.3,
    },
    "ndvi": {
        "bands": ["NDVI"],
        "min": -0.1,
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


# ─────────────────────────────────────────────────────────────────────────────
#  Public API — Thread-Pool Execution
# ─────────────────────────────────────────────────────────────────────────────

async def get_ee_tile_url(
    vis_type: str = "true_color",
    geometry: dict | None = None,
    days_back: int = 60,
) -> dict[str, Any]:
    """
    Return a MapLibre-compatible XYZ tile URL from Earth Engine.
    Tiles are NOT clipped — GEE serves native 10m resolution at all zoom levels.
    """
    def _fetch():
        # Use provided geometry for scene filtering, or default focus area
        if geometry:
            filter_geom = _geometry_from_geojson(geometry)
        else:
            filter_geom = ee.Geometry.Rectangle(_DEFAULT_FILTER_COORDS)

        composite = _get_composite_unclipped(filter_geom, days_back)
        params = VIS_PARAMS.get(vis_type, VIS_PARAMS["true_color"])
        map_id = composite.getMapId(params)
        tile_url = map_id["tile_fetcher"].url_format
        start, end = _date_range(days_back)
        return {
            "tile_url": tile_url,
            "vis_type": vis_type,
            "date_range": {"start": start, "end": end},
            "source": "Google Earth Engine / Sentinel-2 SR Harmonized (10m)",
        }

    return await asyncio.get_event_loop().run_in_executor(None, _fetch)


async def get_date_scene_tile(
    target_date: str,
    geometry: dict | None = None,
    vis_type: str = "true_color",
    window_days: int = 25,
) -> dict[str, Any]:
    """
    Find the clearest Sentinel-2 scene around `target_date` (+/- `window_days`)
    and generate a high-resolution tile URL.
    Tiles are NOT clipped — sharp at all zoom levels.
    """
    def _fetch():
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        start = (dt - timedelta(days=window_days)).strftime("%Y-%m-%d")
        end = (dt + timedelta(days=window_days)).strftime("%Y-%m-%d")

        if geometry:
            filter_geom = _geometry_from_geojson(geometry)
        else:
            filter_geom = ee.Geometry.Rectangle(_DEFAULT_FILTER_COORDS)

        col = (
            ee.ImageCollection(S2_COLLECTION)
            .filterBounds(filter_geom)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 35))
            .sort("CLOUDY_PIXEL_PERCENTAGE")
        )

        count = col.size().getInfo()
        if count > 0:
            best = col.first()
            scene_date = ee.Date(best.get("system:time_start")).format("YYYY-MM-dd").getInfo()
            cloud_pct = round(best.get("CLOUDY_PIXEL_PERCENTAGE").getInfo() or 0, 1)
            scene_id = str(best.get("system:index").getInfo())
            # Scale to 0-1 range and add indices — do NOT clip
            scaled = best.divide(10000)
        else:
            # Fallback: median composite of the window
            col_all = (
                ee.ImageCollection(S2_COLLECTION)
                .filterBounds(filter_geom)
                .filterDate(start, end)
            )
            scaled = col_all.median().divide(10000)
            scene_date = f"{start} to {end}"
            cloud_pct = 0.0
            scene_id = "composite"

        ndvi = scaled.normalizedDifference(["B8", "B4"]).rename("NDVI")
        ndwi = scaled.normalizedDifference(["B3", "B8"]).rename("NDWI")
        bsi = scaled.expression(
            "((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))",
            {
                "B11": scaled.select("B11"),
                "B4": scaled.select("B4"),
                "B8": scaled.select("B8"),
                "B2": scaled.select("B2"),
            },
        ).rename("BSI")

        all_bands = scaled.addBands([ndvi, ndwi, bsi])
        # NO .clip() — let GEE serve global tiles at native resolution

        params = VIS_PARAMS.get(vis_type, VIS_PARAMS["true_color"])
        map_id = all_bands.getMapId(params)
        tile_url = map_id["tile_fetcher"].url_format

        return {
            "tile_url": tile_url,
            "scene_date": scene_date,
            "cloud_percentage": cloud_pct,
            "scene_id": scene_id,
            "vis_type": vis_type,
            "target_date": target_date,
            "source": "Google Earth Engine / Sentinel-2 SR Harmonized (10m)",
        }

    return await asyncio.get_event_loop().run_in_executor(None, _fetch)


async def get_before_after_comparison(
    before_date: str,
    after_date: str,
    geometry: dict | None = None,
    vis_type: str = "true_color",
    window_days: int = 25,
) -> dict[str, Any]:
    """
    Generate paired before & after Sentinel-2 tile URLs for side-by-side comparison.
    Tiles are NOT clipped — full native resolution at any zoom.
    Change metrics are computed separately via reduceRegion (geometry used only there).
    """
    def _fetch():
        if geometry:
            filter_geom = _geometry_from_geojson(geometry)
        else:
            filter_geom = ee.Geometry.Rectangle(_DEFAULT_FILTER_COORDS)

        def _get_scene_image(target_dt_str: str):
            dt = datetime.strptime(target_dt_str, "%Y-%m-%d")
            start = (dt - timedelta(days=window_days)).strftime("%Y-%m-%d")
            end = (dt + timedelta(days=window_days)).strftime("%Y-%m-%d")

            col = (
                ee.ImageCollection(S2_COLLECTION)
                .filterBounds(filter_geom)
                .filterDate(start, end)
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 35))
                .sort("CLOUDY_PIXEL_PERCENTAGE")
            )
            count = col.size().getInfo()
            if count > 0:
                best = col.first()
                sc_date = ee.Date(best.get("system:time_start")).format("YYYY-MM-dd").getInfo()
                cloud = round(best.get("CLOUDY_PIXEL_PERCENTAGE").getInfo() or 0, 1)
                sc_id = str(best.get("system:index").getInfo())
                scaled = best.divide(10000)
            else:
                col_all = ee.ImageCollection(S2_COLLECTION).filterBounds(filter_geom).filterDate(start, end)
                scaled = col_all.median().divide(10000)
                sc_date = f"{start} to {end}"
                cloud = 0.0
                sc_id = "composite"

            ndvi = scaled.normalizedDifference(["B8", "B4"]).rename("NDVI")
            ndwi = scaled.normalizedDifference(["B3", "B8"]).rename("NDWI")
            bsi = scaled.expression(
                "((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))",
                {
                    "B11": scaled.select("B11"),
                    "B4": scaled.select("B4"),
                    "B8": scaled.select("B8"),
                    "B2": scaled.select("B2"),
                },
            ).rename("BSI")
            # NO .clip() here
            img = scaled.addBands([ndvi, ndwi, bsi])
            return img, sc_date, cloud, sc_id

        before_img, b_date, b_cloud, b_id = _get_scene_image(before_date)
        after_img, a_date, a_cloud, a_id = _get_scene_image(after_date)

        params = VIS_PARAMS.get(vis_type, VIS_PARAMS["true_color"])
        before_mid = before_img.getMapId(params)
        after_mid = after_img.getMapId(params)

        # Change metrics — geometry IS used here (only for stats, not tiles)
        stats: dict = {}
        if geometry:
            b_stats = before_img.select(["NDVI", "NDWI", "BSI"]).reduceRegion(
                reducer=ee.Reducer.mean(), geometry=filter_geom, scale=20,
                maxPixels=1e9, bestEffort=True
            ).getInfo()
            a_stats = after_img.select(["NDVI", "NDWI", "BSI"]).reduceRegion(
                reducer=ee.Reducer.mean(), geometry=filter_geom, scale=20,
                maxPixels=1e9, bestEffort=True
            ).getInfo()

            b_ndvi = round(b_stats.get("NDVI") or 0, 3)
            a_ndvi = round(a_stats.get("NDVI") or 0, 3)
            b_bsi = round(b_stats.get("BSI") or 0, 3)
            a_bsi = round(a_stats.get("BSI") or 0, 3)

            stats = {
                "ndvi_before": b_ndvi,
                "ndvi_after": a_ndvi,
                "ndvi_delta": round(a_ndvi - b_ndvi, 3),
                "bsi_before": b_bsi,
                "bsi_after": a_bsi,
                "bsi_delta": round(a_bsi - b_bsi, 3),
                "excavation_signal": a_bsi > b_bsi,
                "vegetation_loss_signal": a_ndvi < b_ndvi,
            }

        return {
            "before": {
                "target_date": before_date,
                "scene_date": b_date,
                "cloud_percentage": b_cloud,
                "scene_id": b_id,
                "tile_url": before_mid["tile_fetcher"].url_format,
            },
            "after": {
                "target_date": after_date,
                "scene_date": a_date,
                "cloud_percentage": a_cloud,
                "scene_id": a_id,
                "tile_url": after_mid["tile_fetcher"].url_format,
            },
            "vis_type": vis_type,
            "metrics": stats,
            "source": "Google Earth Engine / Sentinel-2 SR Harmonized (10m)",
        }

    return await asyncio.get_event_loop().run_in_executor(None, _fetch)


async def get_site_stats(
    geometry: dict,
    days_back: int = 60,
) -> dict[str, Any]:
    """
    Compute mean NDVI, NDWI, and BSI for the given GeoJSON geometry
    over the last `days_back` days.
    """
    def _fetch():
        aoi = _geometry_from_geojson(geometry)
        composite = _get_composite_unclipped(aoi, days_back)

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
        scene_count = (
            ee.ImageCollection(S2_COLLECTION)
            .filterBounds(aoi)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 25))
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
    Return tile URLs for all key visualisations over the Karnataka mining hotspot area,
    plus a recent scene count.

    Tiles are NOT clipped — sharp at any zoom level, exactly like GEE Code Editor.
    """
    def _fetch():
        # Filter area: Hubli-Dharwad mining belt (tight AOI for best scene selection)
        filter_geom = ee.Geometry.Rectangle(_DEFAULT_FILTER_COORDS)
        start, end = _date_range(60)

        scene_count = (
            ee.ImageCollection(S2_COLLECTION)
            .filterBounds(filter_geom)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 25))
            .size()
            .getInfo()
        )

        # Unclipped composite — tiles will be sharp at all zoom levels
        composite = _get_composite_unclipped(filter_geom, 60)

        def _url(vis: str) -> str:
            return composite.getMapId(VIS_PARAMS[vis])["tile_fetcher"].url_format

        return {
            "scene_count": scene_count,
            "date_range": {"start": start, "end": end},
            "tiles": {
                "true_color": _url("true_color"),
                "ndvi": _url("ndvi"),
                "ndwi": _url("ndwi"),
                "bsi": _url("bsi"),
            },
            "source": "Google Earth Engine / Sentinel-2 SR Harmonized (10m)",
            "ee_project": EE_PROJECT,
        }

    return await asyncio.get_event_loop().run_in_executor(None, _fetch)
