"""
Persistent Event Review Store for Environmental Forensic Intelligence.
Ensures analyst determinations ('under_review', 'confirmed_disturbance',
'requires_field_verification', 'false_positive') persist reliably across
server restarts and offline/demo execution without PostgreSQL.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

REVIEWS_FILE = DATA_DIR / "event_reviews.json"


def load_event_reviews() -> Dict[str, Dict[str, Any]]:
    """Load all event reviews keyed by event_id."""
    if not REVIEWS_FILE.exists():
        return {}
    try:
        data = json.loads(REVIEWS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
        return {}
    except Exception:
        return {}


def save_event_review(
    event_id: str,
    status: str,
    reviewer: str = "analyst",
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist an analyst review for an event."""
    reviews = load_event_reviews()
    record = {
        "event_id": event_id,
        "status": status,
        "reviewer": reviewer,
        "notes": notes,
        "reviewed_at": datetime.utcnow().isoformat(),
    }
    reviews[event_id] = record
    try:
        REVIEWS_FILE.write_text(json.dumps(reviews, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"Warning: Failed to persist review to {REVIEWS_FILE}: {e}")
    return record


def get_event_review(event_id: str) -> Optional[Dict[str, Any]]:
    """Get the latest review for an event."""
    reviews = load_event_reviews()
    return reviews.get(event_id)
