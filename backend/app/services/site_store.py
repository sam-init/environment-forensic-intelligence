"""
Persistent Site & Complaint Store for Environmental Forensic Intelligence.
Stores real monitoring sites and statutory complaints in JSON storage to ensure persistence
across server restarts and environments without PostgreSQL.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import math

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

SITES_FILE = DATA_DIR / "user_sites.json"
COMPLAINTS_FILE = DATA_DIR / "complaints.json"


# ── Real Monitoring Sites in Belagavi District, Karnataka ─────────────────────
DEFAULT_REAL_SITES: List[Dict[str, Any]] = [
    {
        "id": "site-ghataprabha-gokak",
        "name": "Ghataprabha River Basin Sand Reach (Gokak Sector)",
        "description": "Active riparian monitoring corridor along the Ghataprabha River near Gokak Falls. Monitored for mechanized sand mining and riverbed geometry disruption under Karnataka Minor Mineral Concession Rules.",
        "area_name": "Gokak Taluk, Belagavi District",
        "latitude": 16.1685,
        "longitude": 74.8352,
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [74.825, 16.155],
                    [74.845, 16.155],
                    [74.845, 16.175],
                    [74.825, 16.175],
                    [74.825, 16.155],
                ]
            ],
        },
        "area_ha": 440.0,
        "status": "active",
        "is_demo": False,
        "monitoring_enabled": True,
        "monitoring_interval_days": 5,
        "monitoring_duration_months": 3,
        "monitoring_end_date": (datetime.utcnow() + timedelta(days=90)).isoformat(),
        "cloud_threshold": 20.0,
        "min_valid_pixels": 80.0,
        "risk_threshold": 45,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    },
    {
        "id": "site-bailhongal-malaprabha",
        "name": "Malaprabha River Wetland & Riparian Buffer (Bailhongal)",
        "description": "Wetland and riverbed conservation zone on the Malaprabha River near Bailhongal. Monitored for illegal soil excavation, brick kiln expansion, and embankment cutting.",
        "area_name": "Bailhongal Taluk, Belagavi District",
        "latitude": 15.8150,
        "longitude": 74.8650,
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [74.855, 15.805],
                    [74.875, 15.805],
                    [74.875, 15.825],
                    [74.855, 15.825],
                    [74.855, 15.805],
                ]
            ],
        },
        "area_ha": 440.0,
        "status": "active",
        "is_demo": False,
        "monitoring_enabled": True,
        "monitoring_interval_days": 5,
        "monitoring_duration_months": 6,
        "monitoring_end_date": (datetime.utcnow() + timedelta(days=180)).isoformat(),
        "cloud_threshold": 25.0,
        "min_valid_pixels": 75.0,
        "risk_threshold": 40,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    },
    {
        "id": "site-khanapur-western-ghats",
        "name": "Khanapur Western Ghats Eco-Sensitive Forest Buffer",
        "description": "Buffer zone bordering Bhimgad Wildlife Sanctuary in Khanapur Taluk. Monitored for unpermitted tree canopy clearance, laterite stone quarrying, and forest border encroachment.",
        "area_name": "Khanapur Taluk, Belagavi District",
        "latitude": 15.6320,
        "longitude": 74.5120,
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [74.502, 15.622],
                    [74.522, 15.622],
                    [74.522, 15.642],
                    [74.502, 15.642],
                    [74.502, 15.622],
                ]
            ],
        },
        "area_ha": 440.0,
        "status": "active",
        "is_demo": False,
        "monitoring_enabled": True,
        "monitoring_interval_days": 5,
        "monitoring_duration_months": 12,
        "monitoring_end_date": (datetime.utcnow() + timedelta(days=365)).isoformat(),
        "cloud_threshold": 30.0,
        "min_valid_pixels": 70.0,
        "risk_threshold": 35,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    },
]


def _generate_bounding_polygon(lat: float, lon: float, radius_meters: float = 1000.0) -> Dict[str, Any]:
    """Generates a square polygon around (lat, lon) with side approx 2 * radius."""
    # 1 deg lat ~ 111,320m
    d_lat = radius_meters / 111320.0
    # 1 deg lon ~ 111,320m * cos(lat)
    d_lon = radius_meters / (111320.0 * math.cos(math.radians(lat)))
    
    min_lat = round(lat - d_lat, 5)
    max_lat = round(lat + d_lat, 5)
    min_lon = round(lon - d_lon, 5)
    max_lon = round(lon + d_lon, 5)
    
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [min_lon, min_lat],
                [max_lon, min_lat],
                [max_lon, max_lat],
                [min_lon, max_lat],
                [min_lon, min_lat],
            ]
        ],
    }


def load_sites() -> List[Dict[str, Any]]:
    if not SITES_FILE.exists():
        save_sites(DEFAULT_REAL_SITES)
        return DEFAULT_REAL_SITES
    try:
        data = json.loads(SITES_FILE.read_text(encoding="utf-8"))
        if not data:
            save_sites(DEFAULT_REAL_SITES)
            return DEFAULT_REAL_SITES
        return data
    except Exception:
        return DEFAULT_REAL_SITES


def save_sites(sites: List[Dict[str, Any]]) -> None:
    SITES_FILE.write_text(json.dumps(sites, indent=2), encoding="utf-8")


def add_site(payload: Dict[str, Any]) -> Dict[str, Any]:
    sites = load_sites()
    site_id = f"site-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()
    
    duration_months = int(payload.get("monitoring_duration_months", 3))
    end_date = now + timedelta(days=duration_months * 30)

    lat = float(payload.get("latitude", 15.85))
    lon = float(payload.get("longitude", 74.50))
    radius = float(payload.get("radius_meters", 1000.0))

    geom = payload.get("geometry")
    if not geom or not geom.get("coordinates"):
        geom = _generate_bounding_polygon(lat, lon, radius)

    area_ha = payload.get("area_ha")
    if not area_ha:
        # approx area from radius
        area_ha = round((math.pi * (radius ** 2)) / 10000.0, 1)

    new_site = {
        "id": site_id,
        "name": payload.get("name", "Monitored Land Parcel"),
        "description": payload.get("description", "Dedicated environmental monitoring site."),
        "area_name": payload.get("area_name", "Belagavi District, Karnataka"),
        "latitude": lat,
        "longitude": lon,
        "geometry": geom,
        "area_ha": area_ha,
        "status": "active",
        "is_demo": False,
        "monitoring_enabled": True,
        "monitoring_interval_days": int(payload.get("monitoring_interval_days", 5)),
        "monitoring_duration_months": duration_months,
        "monitoring_end_date": end_date.isoformat(),
        "cloud_threshold": float(payload.get("cloud_threshold", 25.0)),
        "min_valid_pixels": float(payload.get("min_valid_pixels", 75.0)),
        "risk_threshold": int(payload.get("risk_threshold", 40)),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    sites.insert(0, new_site)
    save_sites(sites)
    return new_site


def delete_site(site_id: str) -> bool:
    sites = load_sites()
    filtered = [s for s in sites if s["id"] != site_id]
    if len(filtered) != len(sites):
        save_sites(filtered)
        return True
    return False


# ── Complaints & Field Inspection Store ───────────────────────────────────────

DEFAULT_COMPLAINTS: List[Dict[str, Any]] = [
    {
        "id": "KSPCB-BLG-2026-0042",
        "site_id": "site-ghataprabha-gokak",
        "site_name": "Ghataprabha River Basin Sand Reach (Gokak Sector)",
        "area_name": "Gokak Taluk, Belagavi District",
        "latitude": 16.1685,
        "longitude": 74.8352,
        "target_authority": "Karnataka State Pollution Control Board (KSPCB) Regional Office & District Mines Department, Belagavi",
        "change_type": "Unauthorized Riverbed Sand Extraction",
        "severity": "CRITICAL",
        "status": "Filed - Inspection Requested",
        "urgency": "Immediate (Within 48 hours)",
        "statutory_violation": "Karnataka Minor Mineral Concession Rules (Rule 31R) & Environment Protection Act 1986",
        "summary": "Deep Siamese ResNet-18 neural detection identified physical excavation disturbance on Ghataprabha riverbank. Ground texture and edge continuity disrupted with heavy vehicle ingress. Requesting on-site physical inspection and boundary pegging.",
        "created_at": (datetime.utcnow() - timedelta(days=2)).isoformat(),
    }
]


def load_complaints() -> List[Dict[str, Any]]:
    if not COMPLAINTS_FILE.exists():
        save_complaints(DEFAULT_COMPLAINTS)
        return DEFAULT_COMPLAINTS
    try:
        data = json.loads(COMPLAINTS_FILE.read_text(encoding="utf-8"))
        if not data:
            save_complaints(DEFAULT_COMPLAINTS)
            return DEFAULT_COMPLAINTS
        return data
    except Exception:
        return DEFAULT_COMPLAINTS


def save_complaints(complaints: List[Dict[str, Any]]) -> None:
    COMPLAINTS_FILE.write_text(json.dumps(complaints, indent=2), encoding="utf-8")


def add_complaint(payload: Dict[str, Any]) -> Dict[str, Any]:
    complaints = load_complaints()
    c_num = f"KSPCB-BLG-2026-{uuid.uuid4().hex[:4].upper()}"
    now = datetime.utcnow()

    new_c = {
        "id": c_num,
        "site_id": payload.get("site_id", ""),
        "site_name": payload.get("site_name", "Belagavi Monitored Site"),
        "area_name": payload.get("area_name", "Belagavi District, Karnataka"),
        "latitude": float(payload.get("latitude", 15.85)),
        "longitude": float(payload.get("longitude", 74.50)),
        "target_authority": payload.get(
            "target_authority",
            "Karnataka State Pollution Control Board (KSPCB) Regional Office & District Mines Department, Belagavi",
        ),
        "change_type": payload.get("change_type", "Illegal Land Excavation / Unpermitted Ground Disturbance"),
        "severity": payload.get("severity", "HIGH"),
        "status": "Filed - Inspection Requested",
        "urgency": payload.get("urgency", "Urgent (Within 72 Hours)"),
        "statutory_violation": payload.get(
            "statutory_violation",
            "Karnataka Minor Mineral Concession Rules 1994 & Environment (Protection) Act 1986",
        ),
        "summary": payload.get("summary", "Satellite AI detected land change. Physical field inspection requested."),
        "officer_notes": payload.get("officer_notes", ""),
        "created_at": now.isoformat(),
    }

    complaints.insert(0, new_c)
    save_complaints(complaints)
    return new_c
