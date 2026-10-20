"""Pure utilities shared by the tile-grid API and change-detection workers.

These functions deliberately make no claim that a spectral change is unlawful.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date
from math import floor
from typing import Any

from pyproj import Transformer
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, box, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform
from shapely.prepared import prep

# Belagavi district lies inside UTM zone 43N.
REGION_UTM_EPSG = 32643
KARNATAKA_UTM_EPSG = REGION_UTM_EPSG

DEFAULT_TILE_SIZE_M = 1000
DEFAULT_MAX_TILES = 50_000
DEFAULT_TILE_PREFIX = "BEL"


@dataclass(frozen=True)
class ComparisonPeriod:
    start: date
    end: date

    @property
    def signature(self) -> str:
        return f"{self.start.isoformat()}:{self.end.isoformat()}"


def validate_periods(before: ComparisonPeriod, after: ComparisonPeriod) -> None:
    """Reject invalid or non-season-matched periods before any EE work."""
    if before.start > before.end or after.start > after.end:
        raise ValueError("Each comparison period must have start <= end.")
    if before.end >= after.start:
        raise ValueError("The before period must end before the after period begins.")
    # Same calendar months avoids the most obvious seasonal false positives.
    if (before.start.month, before.end.month) != (after.start.month, after.end.month):
        raise ValueError("Comparison periods must use matching calendar months.")


def processing_signature(before: ComparisonPeriod, after: ComparisonPeriod, thresholds: dict[str, float]) -> str:
    payload = f"{before.signature}|{after.signature}|{sorted(thresholds.items())}"
    return hashlib.sha256(payload.encode()).hexdigest()


def polygonal_geometry(geometry: BaseGeometry) -> MultiPolygon | None:
    """Return only polygon parts as a MultiPolygon (or None if there are none).

    MultiPolygon is required because the database columns enforcing the type are
    geometry(MultiPolygon, 4326); PostGIS rejects a bare Polygon there.
    """
    if geometry.is_empty:
        return None
    if isinstance(geometry, Polygon):
        return MultiPolygon([geometry])
    if isinstance(geometry, MultiPolygon):
        return geometry
    if isinstance(geometry, GeometryCollection):
        polygons = []
        for part in geometry.geoms:
            if isinstance(part, Polygon):
                polygons.append(part)
            elif isinstance(part, MultiPolygon):
                polygons.extend(part.geoms)
        if polygons:
            return MultiPolygon(polygons)
    return None


def generate_grid_tiles(
    boundary_geojson: dict[str, Any],
    tile_size_m: int = DEFAULT_TILE_SIZE_M,
    tile_prefix: str = DEFAULT_TILE_PREFIX,
    max_tiles: int = DEFAULT_MAX_TILES,
) -> list[dict[str, Any]]:
    """Intersect a fixed UTM grid with a boundary and return WGS84 tile polygons.

    Cells are clipped to the district outline; interior cells remain exactly
    tile_size_m × tile_size_m. The grid is a processing unit, not an incident.
    """
    if tile_size_m <= 0:
        raise ValueError("tile_size_m must be positive")
    if max_tiles <= 0:
        raise ValueError("max_tiles must be positive")
    to_utm = Transformer.from_crs(4326, REGION_UTM_EPSG, always_xy=True).transform
    to_wgs84 = Transformer.from_crs(REGION_UTM_EPSG, 4326, always_xy=True).transform
    boundary = polygonal_geometry(transform(to_utm, shape(boundary_geojson)))
    if boundary is None:
        return []
    prepared = prep(boundary)
    min_x, min_y, max_x, max_y = boundary.bounds
    start_x, start_y = floor(min_x / tile_size_m) * tile_size_m, floor(min_y / tile_size_m) * tile_size_m
    tiles: list[dict[str, Any]] = []
    x = start_x
    while x < max_x:
        y = start_y
        while y < max_y:
            cell = box(x, y, x + tile_size_m, y + tile_size_m)
            if prepared.intersects(cell):
                clipped = polygonal_geometry(cell.intersection(boundary))
                if clipped is not None and clipped.area > 0:
                    if len(tiles) >= max_tiles:
                        raise ValueError(
                            f"Grid exceeds {max_tiles} tiles; reduce the region or increase tile_size_m."
                        )
                    tile_id = f"{tile_prefix}-{tile_size_m}m-{int(x // tile_size_m)}-{int(y // tile_size_m)}"
                    tiles.append({"tile_id": tile_id, "geometry": mapping(transform(to_wgs84, clipped))})
            y += tile_size_m
        x += tile_size_m
    return tiles


def score_change(ndvi_delta: float, bsi_delta: float, exposed_area_ha: float) -> int:
    """Transparent prioritisation score, not a probability or legal conclusion."""
    score = max(0.0, -ndvi_delta) * 180 + max(0.0, bsi_delta) * 220 + min(exposed_area_ha, 10) * 3
    return min(100, round(score))


def candidate_from_vector(feature: dict[str, Any], index: int) -> dict[str, Any]:
    """Convert one GEE vector feature into an explainable, unclassified candidate."""
    properties = feature.get("properties", {})
    area_ha = float(properties.get("area_m2") or 0) / 10_000
    ndvi_delta, bsi_delta = float(properties.get("ndvi_delta") or 0), float(properties.get("bsi_delta") or 0)
    return {"geometry": feature["geometry"], "area_ha": area_ha, "candidate_index": index,
            "indicators": {"ndvi_delta": ndvi_delta, "bsi_delta": bsi_delta, "exposed_land": True},
            "change_score": score_change(ndvi_delta, bsi_delta, area_ha)}
