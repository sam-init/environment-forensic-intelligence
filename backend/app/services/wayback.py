"""Esri World Imagery Wayback historical high-resolution tiles.

Wayback releases are global snapshots, not per-scene acquisition dates. The
release date is the best available approximation of when the imagery became
available in that release.
"""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime
from functools import lru_cache
from typing import Any

WAYBACK_CONFIG_URL = (
    "https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json"
)
MAX_RELEASE_GAP_DAYS = 550
REQUEST_TIMEOUT_SECONDS = 30


@lru_cache(maxsize=1)
def _load_releases() -> tuple[dict[str, Any], ...]:
    request = urllib.request.Request(
        WAYBACK_CONFIG_URL,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        payload = json.load(response)

    releases: list[dict[str, Any]] = []
    for release_id, meta in payload.items():
        title = str(meta.get("itemTitle", ""))
        match = re.search(r"Wayback (\d{4}-\d{2}-\d{2})", title)
        tile_url = meta.get("itemURL")
        if not match or not tile_url:
            continue
        releases.append(
            {
                "release_id": str(release_id),
                "release_date": match.group(1),
                "title": title,
                "tile_url": str(tile_url)
                .replace("{level}", "{z}")
                .replace("{row}", "{y}")
                .replace("{col}", "{x}"),
            }
        )

    releases.sort(key=lambda release: release["release_date"])
    return tuple(releases)


def _nearest_release(target_date: str) -> dict[str, Any] | None:
    try:
        target = datetime.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
        return None

    releases = _load_releases()
    if not releases:
        return None

    nearest = min(
        releases,
        key=lambda release: abs(
            (datetime.strptime(release["release_date"], "%Y-%m-%d").date() - target).days
        ),
    )
    age_days = abs(
        (datetime.strptime(nearest["release_date"], "%Y-%m-%d").date() - target).days
    )
    if age_days > MAX_RELEASE_GAP_DAYS:
        return None

    return {
        **nearest,
        "age_days": age_days,
        "source": "Esri World Imagery Wayback (historical high-resolution basemap)",
    }


def get_wayback_comparison(before_date: str, after_date: str) -> dict[str, Any]:
    """Return the nearest Wayback release tiles for a before/after pair."""
    return {
        "before": _nearest_release(before_date),
        "after": _nearest_release(after_date),
        "max_release_gap_days": MAX_RELEASE_GAP_DAYS,
    }
