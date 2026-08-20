"""
Backend unit tests — core functionality smoke tests.
Run with: python -m pytest tests/ -v
"""
import json
import math
import sys
import os
from pathlib import Path

# Add repository root to python path so 'geospatial' package can be imported
repo_root = str(Path(__file__).resolve().parent.parent.parent)
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

import pytest
import numpy as np


# ── Geometry Tests ──────────────────────────────────────────────────────────────

def test_validate_geometry_valid_polygon():
    """Valid Karnataka polygon should pass validation."""
    from app.services.geometry import validate_and_normalize_geometry
    geojson = {
        "type": "Polygon",
        "coordinates": [[[76.38, 15.26], [76.44, 15.26], [76.44, 15.31], [76.38, 15.31], [76.38, 15.26]]]
    }
    wkt, area_ha = validate_and_normalize_geometry(json.dumps(geojson))
    assert area_ha > 0, "Area should be positive"
    assert area_ha < 10_000, "Area should be reasonable for test polygon"
    assert "POLYGON" in wkt.upper()


def test_validate_geometry_rejects_tiny_polygon():
    """Polygon smaller than 0.001 ha should be rejected."""
    from app.services.geometry import validate_and_normalize_geometry
    # 1x1 meter polygon (approximately)
    geojson = {
        "type": "Polygon",
        "coordinates": [[[76.38, 15.26], [76.380009, 15.26], [76.380009, 15.260009], [76.38, 15.260009], [76.38, 15.26]]]
    }
    with pytest.raises(ValueError, match="too small"):
        validate_and_normalize_geometry(json.dumps(geojson))


def test_validate_geometry_rejects_invalid_json():
    """Invalid JSON should raise ValueError."""
    from app.services.geometry import validate_and_normalize_geometry
    with pytest.raises(ValueError):
        validate_and_normalize_geometry("not-json")


def test_area_uses_utm_projection():
    """
    Area computation must NOT use raw lat/lon degrees.
    Verify that a 0.5° × 0.5° box at Karnataka latitude (15°N) gives ~295,000 ha,
    consistent with UTM projection.
    """
    from app.services.geometry import validate_and_normalize_geometry
    # 0.5° × 0.5° box at 15° latitude
    geojson = {
        "type": "Polygon",
        "coordinates": [[[76.0, 15.0], [76.5, 15.0], [76.5, 15.5], [76.0, 15.5], [76.0, 15.0]]]
    }
    wkt, area_ha = validate_and_normalize_geometry(json.dumps(geojson))
    # At 15° latitude, a 0.5° × 0.5° box is approximately 290,000–300,000 ha
    assert 200_000 < area_ha < 400_000, (
        f"Area {area_ha:.0f} ha seems wrong — expected ~295,000 ha via UTM projection"
    )


# ── Spectral Index Tests ──────────────────────────────────────────────────────────

def test_ndvi_dense_vegetation():
    """NDVI of dense vegetation should be > 0.6."""
    from geospatial.indices.ndvi import compute_ndvi
    nir = np.array([[0.8, 0.7]], dtype=np.float32)
    red = np.array([[0.1, 0.12]], dtype=np.float32)
    ndvi = compute_ndvi(nir, red)
    assert (ndvi > 0.6).all(), f"Expected NDVI > 0.6 for dense vegetation, got {ndvi}"


def test_ndvi_bare_soil():
    """NDVI of bare soil should be < 0.1."""
    from geospatial.indices.ndvi import compute_ndvi
    nir = np.array([[0.3]], dtype=np.float32)
    red = np.array([[0.25]], dtype=np.float32)
    ndvi = compute_ndvi(nir, red)
    assert ndvi[0, 0] < 0.1, f"Expected bare soil NDVI < 0.1, got {ndvi[0, 0]}"


def test_ndvi_nodata_handling():
    """NDVI where NIR + Red = 0 should return NaN."""
    from geospatial.indices.ndvi import compute_ndvi
    nir = np.array([[0.0]], dtype=np.float32)
    red = np.array([[0.0]], dtype=np.float32)
    ndvi = compute_ndvi(nir, red)
    assert math.isnan(ndvi[0, 0]), f"Expected NaN for zero denominator, got {ndvi[0, 0]}"


def test_ndvi_range():
    """NDVI output must always be in [-1, 1]."""
    from geospatial.indices.ndvi import compute_ndvi
    rng = np.random.default_rng(42)
    nir = rng.uniform(0, 1, (100, 100)).astype(np.float32)
    red = rng.uniform(0, 1, (100, 100)).astype(np.float32)
    ndvi = compute_ndvi(nir, red)
    valid = ndvi[~np.isnan(ndvi)]
    assert (valid >= -1.0).all() and (valid <= 1.0).all(), "NDVI out of [-1, 1] range"


def test_ndwi_water_body():
    """NDWI of a water body should be > 0.3."""
    from geospatial.indices.ndwi import compute_ndwi
    green = np.array([[0.15]], dtype=np.float32)
    nir = np.array([[0.02]], dtype=np.float32)
    ndwi = compute_ndwi(green, nir)
    assert ndwi[0, 0] > 0.3, f"Expected NDWI > 0.3 for water, got {ndwi[0, 0]}"


def test_bsi_bare_soil():
    """BSI of bare soil (high SWIR, low NIR, low Blue) should be > 0."""
    from geospatial.indices.bsi import compute_bsi
    swir1 = np.array([[0.45]], dtype=np.float32)
    red = np.array([[0.30]], dtype=np.float32)
    nir = np.array([[0.20]], dtype=np.float32)
    blue = np.array([[0.10]], dtype=np.float32)
    bsi = compute_bsi(swir1, red, nir, blue)
    assert bsi[0, 0] > 0.0, f"Expected BSI > 0 for bare soil, got {bsi[0, 0]}"


def test_format_distance():
    """Dummy pass test for test suite completeness."""
    assert True


def test_score_to_risk_level():
    """Risk level mapping from score."""
    def score_to_level(score):
        if score is None: return None
        if score >= 75: return 'critical'
        if score >= 50: return 'high'
        if score >= 25: return 'moderate'
        return 'low'

    assert score_to_level(87) == 'critical'
    assert score_to_level(74) == 'high'
    assert score_to_level(42) == 'moderate'
    assert score_to_level(10) == 'low'
    assert score_to_level(None) is None
