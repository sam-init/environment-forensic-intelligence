"""
BSI — Bare Soil Index
Formula: ((SWIR1 + Red) - (NIR + Blue)) / ((SWIR1 + Red) + (NIR + Blue))
Bands: B11 (SWIR1), B4 (Red), B8 (NIR), B2 (Blue) for Sentinel-2

Range: -1.0 to 1.0
Interpretation:
  High BSI (> 0.0) → bare/disturbed soil, excavation zones
  Moderate BSI (−0.1 to 0.0) → sparse vegetation or transition
  Low BSI (< −0.1) → dense vegetation

Relevance to EFI:
  - BSI increase over time is a strong indicator of soil disturbance
  - Persistent high BSI in non-agricultural areas → mining/excavation signal
  - Combine with NDVI decrease for stronger evidence

Reference:
  Rikimaru, A., Roy, P. S., & Miyatake, S. (2002). Tropical forest cover
  density mapping. Tropical Ecology, 43(1).
"""
from __future__ import annotations

import numpy as np


def compute_bsi(
    swir1: np.ndarray,
    red: np.ndarray,
    nir: np.ndarray,
    blue: np.ndarray,
) -> np.ndarray:
    """
    Compute Bare Soil Index.

    Args:
        swir1: SWIR-1 reflectance (Sentinel-2 B11), float32, range 0–1
        red:   Red reflectance (Sentinel-2 B4), float32, range 0–1
        nir:   NIR reflectance (Sentinel-2 B8), float32, range 0–1
        blue:  Blue reflectance (Sentinel-2 B2), float32, range 0–1

    Returns:
        BSI array, float32, range -1.0 to 1.0.
        Pixels where denominator = 0 → NaN.
    """
    swir1 = swir1.astype(np.float32)
    red = red.astype(np.float32)
    nir = nir.astype(np.float32)
    blue = blue.astype(np.float32)

    numerator = (swir1 + red) - (nir + blue)
    denominator = (swir1 + red) + (nir + blue)

    bsi = np.where(
        denominator == 0,
        np.nan,
        numerator / denominator,
    ).astype(np.float32)

    return np.clip(bsi, -1.0, 1.0)


def bsi_stats(bsi: np.ndarray) -> dict:
    """Summary statistics for BSI."""
    valid = bsi[~np.isnan(bsi)]
    if valid.size == 0:
        return {"min": None, "max": None, "mean": None, "valid_pixel_count": 0}
    return {
        "min": float(valid.min()),
        "max": float(valid.max()),
        "mean": float(valid.mean()),
        "std": float(valid.std()),
        "p5": float(np.percentile(valid, 5)),
        "p95": float(np.percentile(valid, 95)),
        # Fraction of pixels with BSI > 0 (bare/disturbed soil)
        "bare_soil_fraction": float((valid > 0.0).sum() / valid.size),
        "valid_pixel_count": int(valid.size),
    }
