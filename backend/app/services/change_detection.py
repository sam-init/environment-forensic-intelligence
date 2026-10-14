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
from shapely.geometry import box, shape, mapping
from shapely.ops import transform

KARNATAKA_UTM_EPSG = 32643


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


def generate_grid_tiles(boundary_geojson: dict[str, Any], tile_size_m: int = 5000) -> list[dict[str, Any]]:
    """Intersect a fixed UTM grid with a boundary and return WGS84 tile polygons."""
    if tile_size_m <= 0:
        raise ValueError("tile_size_m must be positive")
    to_utm = Transformer.from_crs(4326, KARNATAKA_UTM_EPSG, always_xy=True).transform
    to_wgs84 = Transformer.from_crs(KARNATAKA_UTM_EPSG, 4326, always_xy=True).transform
    boundary = transform(to_utm, shape(boundary_geojson))
    min_x, min_y, max_x, max_y = boundary.bounds
    start_x, start_y = floor(min_x / tile_size_m) * tile_size_m, floor(min_y / tile_size_m) * tile_size_m
    tiles: list[dict[str, Any]] = []
    x = start_x
    while x < max_x:
        y = start_y
        while y < max_y:
            clipped = box(x, y, x + tile_size_m, y + tile_size_m).intersection(boundary)
            if not clipped.is_empty and clipped.area > 0:
                tile_id = f"KA-{tile_size_m}m-{int(x // tile_size_m)}-{int(y // tile_size_m)}"
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
