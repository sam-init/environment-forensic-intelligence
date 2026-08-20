"""
NDWI — Normalized Difference Water Index
Formula: (Green - NIR) / (Green + NIR)
Bands: B3 (Green), B8 (NIR) for Sentinel-2

Range: -1.0 to 1.0
Interpretation:
  > 0.3  Open water / water body
  0.0–0.3 Turbid water / moist surfaces
  -0.1–0.0 No significant water
  < -0.1 Vegetation, dry soil, bare land

Relevance to EFI:
  - Water body reduction may indicate filling/draining
  - Riverbeds: NDWI temporal decrease indicates dry season or extraction
  - NDWI increase in non-water areas may indicate flooding (confound)

Reference:
  McFeeters, S. K. (1996). The use of the Normalized Difference Water Index (NDWI)
  in the delineation of open water features. Int. Journal of Remote Sensing, 17(7).
"""
from __future__ import annotations

import numpy as np


def compute_ndwi(green: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """
    Compute NDWI from Green and NIR reflectance arrays.

    Args:
        green: Green reflectance (Sentinel-2 B3), float32, range 0–1
        nir:   NIR reflectance (Sentinel-2 B8), float32, range 0–1

    Returns:
        NDWI array, float32, range -1.0 to 1.0.
        Pixels where denominator = 0 are set to NaN.
    """
    green = green.astype(np.float32)
    nir = nir.astype(np.float32)

    denominator = green + nir
    ndwi = np.where(
        denominator == 0,
        np.nan,
        (green - nir) / denominator,
    ).astype(np.float32)

    return np.clip(ndwi, -1.0, 1.0)


def ndwi_stats(ndwi: np.ndarray) -> dict:
    """Summary statistics for NDWI. Only valid (non-NaN) pixels."""
    valid = ndwi[~np.isnan(ndwi)]
    if valid.size == 0:
        return {"min": None, "max": None, "mean": None, "valid_pixel_count": 0}
    return {
        "min": float(valid.min()),
        "max": float(valid.max()),
        "mean": float(valid.mean()),
        "std": float(valid.std()),
        "p5": float(np.percentile(valid, 5)),
        "p95": float(np.percentile(valid, 95)),
        "water_fraction": float((valid > 0.3).sum() / valid.size),
        "valid_pixel_count": int(valid.size),
    }
