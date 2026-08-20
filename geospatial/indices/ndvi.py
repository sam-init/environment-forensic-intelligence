"""
NDVI — Normalized Difference Vegetation Index
Formula: (NIR - Red) / (NIR + Red)
Bands: B8 (NIR), B4 (Red) for Sentinel-2

Range: -1.0 to 1.0
Interpretation:
  > 0.6  Dense healthy vegetation
  0.3–0.6 Moderate vegetation
  0.1–0.3 Sparse vegetation / stressed vegetation
  < 0.1  Bare soil, water, urban, or disturbed land

References:
  Rouse et al. (1974) — original NDVI formulation
  ESA Sentinel-2 Band Reference: https://sentinel.esa.int/web/sentinel/user-guides/sentinel-2-msi/resolutions/radiometric
"""
from __future__ import annotations

import numpy as np


def compute_ndvi(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    """
    Compute NDVI from NIR and Red reflectance arrays.

    Args:
        nir: Near-infrared reflectance (Sentinel-2 B8 or B8A), float32, range 0–1
        red: Red reflectance (Sentinel-2 B4), float32, range 0–1

    Returns:
        NDVI array, float32, range -1.0 to 1.0.
        NoData pixels (where denominator = 0) are set to NaN.

    Notes:
        This function does NOT assume normalization — if bands are still in
        DN (Digital Number) or scaled integer form, convert first using
        the appropriate scale factor (typically 10000 for Sentinel-2 L2A).
    """
    nir = nir.astype(np.float32)
    red = red.astype(np.float32)

    denominator = nir + red
    # Avoid division by zero
    ndvi = np.where(
        denominator == 0,
        np.nan,
        (nir - red) / denominator,
    ).astype(np.float32)

    # Clamp to valid range (floating point arithmetic can exceed bounds)
    ndvi = np.clip(ndvi, -1.0, 1.0)
    return ndvi


def ndvi_stats(ndvi: np.ndarray) -> dict:
    """
    Compute summary statistics for an NDVI array.
    Only considers non-NaN valid pixels.
    """
    valid = ndvi[~np.isnan(ndvi)]
    if valid.size == 0:
        return {
            "min": None, "max": None, "mean": None,
            "std": None, "p5": None, "p95": None,
            "valid_pixel_count": 0,
        }
    return {
        "min": float(valid.min()),
        "max": float(valid.max()),
        "mean": float(valid.mean()),
        "std": float(valid.std()),
        "p5": float(np.percentile(valid, 5)),
        "p95": float(np.percentile(valid, 95)),
        "valid_pixel_count": int(valid.size),
    }
