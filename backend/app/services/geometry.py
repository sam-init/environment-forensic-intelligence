"""
Geometry validation and normalization service.
All coordinate system operations must use projected CRS for area/distance.
NEVER calculate hectares from raw lat/lon degrees.
"""
from __future__ import annotations

import json
import math

import pyproj
from shapely.geometry import mapping, shape
from shapely.ops import transform


# Karnataka UTM zone — EPSG:32643 (UTM Zone 43N, covers most of Karnataka)
# For general India coverage, we use the appropriate UTM zone based on centroid.
_WGS84 = pyproj.CRS("EPSG:4326")
_UTM_43N = pyproj.CRS("EPSG:32643")  # Covers Karnataka / southern India


def _get_utm_crs_for_geometry(geom) -> pyproj.CRS:
    """
    Select the best UTM CRS for a geometry based on its centroid longitude.
    This provides accurate area/distance calculations for India.
    """
    centroid = geom.centroid
    lon = centroid.x
    # UTM zone number from longitude
    zone_number = math.floor((lon + 180) / 6) + 1
    # India is in northern hemisphere
    epsg = 32600 + zone_number
    try:
        return pyproj.CRS(f"EPSG:{epsg}")
    except Exception:
        return _UTM_43N


def _project_to_utm(geom, utm_crs: pyproj.CRS):
    """Project a WGS84 Shapely geometry to UTM."""
    project = pyproj.Transformer.from_crs(
        _WGS84, utm_crs, always_xy=True
    ).transform
    return transform(project, geom)


def _project_to_wgs84(geom, utm_crs: pyproj.CRS):
    """Project a UTM Shapely geometry back to WGS84."""
    project = pyproj.Transformer.from_crs(
        utm_crs, _WGS84, always_xy=True
    ).transform
    return transform(project, geom)


def validate_and_normalize_geometry(geojson_str: str) -> tuple[str, float]:
    """
    Validate a GeoJSON geometry string.

    Returns:
        (wkt_string, area_ha) — normalized WKT in WGS84, area in hectares.

    Raises:
        ValueError with a human-readable message on any validation failure.
    """
    # Parse GeoJSON
    try:
        geojson = json.loads(geojson_str)
        geom = shape(geojson)
    except (json.JSONDecodeError, Exception) as exc:
        raise ValueError(f"Invalid GeoJSON geometry: {exc}") from exc

    # Non-empty check
    if geom.is_empty:
        raise ValueError("Geometry is empty. Please provide a non-empty polygon.")

    # Validity check
    if not geom.is_valid:
        geom = geom.buffer(0)  # Attempt auto-fix for common topology errors
        if not geom.is_valid:
            raise ValueError(
                "Geometry is topologically invalid and could not be repaired. "
                "Please check your polygon for self-intersections."
            )

    # Coordinate bounds check (WGS84 valid range)
    bounds = geom.bounds  # (minx, miny, maxx, maxy)
    if not (-180 <= bounds[0] <= 180 and -180 <= bounds[2] <= 180):
        raise ValueError("Longitude coordinates must be between -180 and 180.")
    if not (-90 <= bounds[1] <= 90 and -90 <= bounds[3] <= 90):
        raise ValueError("Latitude coordinates must be between -90 and 90.")

    # Project to UTM for accurate area
    utm_crs = _get_utm_crs_for_geometry(geom)
    geom_utm = _project_to_utm(geom, utm_crs)

    # Area in hectares (1 m² = 0.0001 ha)
    area_ha = geom_utm.area / 10_000.0

    # Reasonable area check (0.001 ha minimum, 500,000 ha maximum per site)
    if area_ha < 0.001:
        raise ValueError(
            f"AOI area is too small ({area_ha:.4f} ha). "
            "Minimum area is 0.001 ha. Please draw a larger polygon."
        )
    if area_ha > 500_000:
        raise ValueError(
            f"AOI area is very large ({area_ha:,.1f} ha). "
            "Maximum area per site is 500,000 ha. "
            "Consider splitting into multiple sites for efficient processing."
        )

    return geom.wkt, round(area_ha, 4)


def calculate_distance_m(geom1, geom2, reference_geom=None) -> float:
    """
    Calculate distance in metres between two WGS84 Shapely geometries.
    Projects both to UTM before measuring.
    """
    ref = reference_geom or geom1
    utm_crs = _get_utm_crs_for_geometry(ref)
    g1_utm = _project_to_utm(geom1, utm_crs)
    g2_utm = _project_to_utm(geom2, utm_crs)
    return g1_utm.distance(g2_utm)


def calculate_area_ha(geom) -> float:
    """Calculate area in hectares for a WGS84 Shapely geometry."""
    utm_crs = _get_utm_crs_for_geometry(geom)
    geom_utm = _project_to_utm(geom, utm_crs)
    return geom_utm.area / 10_000.0
