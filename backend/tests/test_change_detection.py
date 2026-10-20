from datetime import date

import pytest

from app.schemas.schemas import GenerateTileGridRequest
from app.services.change_detection import ComparisonPeriod, candidate_from_vector, generate_grid_tiles, score_change, validate_periods


def test_grid_tiles_are_clipped_and_stably_named():
    boundary = {"type": "Polygon", "coordinates": [[[76.0, 15.0], [76.08, 15.0], [76.08, 15.08], [76.0, 15.08], [76.0, 15.0]]]}
    tiles = generate_grid_tiles(boundary, 5000)
    assert len(tiles) > 1
    assert len({tile["tile_id"] for tile in tiles}) == len(tiles)
    assert all(tile["geometry"]["type"] == "MultiPolygon" for tile in tiles)


def test_default_grid_is_one_km_and_belagavi_prefixed():
    assert GenerateTileGridRequest().tile_size_m == 1000
    boundary = {"type": "Polygon", "coordinates": [[[74.50, 15.80], [74.53, 15.80], [74.53, 15.83], [74.50, 15.83], [74.50, 15.80]]]}
    tiles = generate_grid_tiles(boundary)
    assert len(tiles) >= 4
    assert all(tile["tile_id"].startswith("BEL-1000m-") for tile in tiles)


def test_grid_generation_honours_max_tiles():
    boundary = {"type": "Polygon", "coordinates": [[[74.50, 15.80], [74.60, 15.80], [74.60, 15.90], [74.50, 15.90], [74.50, 15.80]]]}
    with pytest.raises(ValueError, match="exceeds"):
        generate_grid_tiles(boundary, 1000, max_tiles=2)


def test_date_filtering_requires_season_matched_non_overlapping_periods():
    validate_periods(ComparisonPeriod(date(2024, 1, 1), date(2024, 2, 28)), ComparisonPeriod(date(2025, 1, 1), date(2025, 2, 28)))
    with pytest.raises(ValueError, match="matching calendar months"):
        validate_periods(ComparisonPeriod(date(2024, 1, 1), date(2024, 2, 28)), ComparisonPeriod(date(2025, 3, 1), date(2025, 4, 30)))


def test_change_score_increases_for_exposed_land_and_vegetation_loss():
    assert score_change(-0.35, 0.25, 2.0) > score_change(-0.05, 0.02, 0.1)


def test_candidate_polygon_generation_retains_geometry_and_indicators():
    feature = {"geometry": {"type": "Polygon", "coordinates": [[[76, 15], [76.01, 15], [76.01, 15.01], [76, 15.01], [76, 15]]]}, "properties": {"area_m2": 12_000, "ndvi_delta": -0.3, "bsi_delta": 0.2}}
    candidate = candidate_from_vector(feature, 4)
    assert candidate["candidate_index"] == 4
    assert candidate["area_ha"] == pytest.approx(1.2)
    assert candidate["indicators"]["exposed_land"] is True
