"""
Demo data seeder for Karnataka, India.
Seeds clearly marked DEMO DATA — NOT real environmental incidents.
All records are flagged is_demo=True and labeled [DEMO DATA] in all relevant fields.

IMPORTANT: These are synthetic records for UI/system demonstration purposes only.
They do NOT represent actual detected mining activity.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    EventCategory,
    EventStatus,
    ForensicEvent,
    Observation,
    ObservationStatus,
    RiskLevel,
    SatelliteProvider,
    Site,
)


# ── Karnataka Demo AOIs ────────────────────────────────────────────────────────
# These are representative areas in Karnataka used only for demo purposes.
# Coordinates chosen to represent river valleys and mining-sensitive zones.

DEMO_SITES = [
    {
        "name": "[DEMO] Tungabhadra River Watch — Hospet",
        "description": "[DEMO DATA] Synthetic monitoring site on the Tungabhadra river near Hospet, Karnataka. Not a real active monitoring station.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[76.38, 15.26], [76.44, 15.26], [76.44, 15.31], [76.38, 15.31], [76.38, 15.26]]]
        },
        "area_ha": 330.0,
    },
    {
        "name": "[DEMO] Cauvery River — Mandya District",
        "description": "[DEMO DATA] Synthetic monitoring site on the Cauvery river near Mandya. Not a real active monitoring station.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[76.82, 12.52], [76.88, 12.52], [76.88, 12.57], [76.82, 12.57], [76.82, 12.52]]]
        },
        "area_ha": 280.0,
    },
    {
        "name": "[DEMO] Ballari Mining Zone",
        "description": "[DEMO DATA] Synthetic monitoring site near Ballari (Bellary) iron ore district. Not a real active monitoring station.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[76.92, 15.13], [76.98, 15.13], [76.98, 15.18], [76.92, 15.18], [76.92, 15.13]]]
        },
        "area_ha": 290.0,
    },
]


DEMO_EVENTS = [
    {
        "event_id": "ENV-DEMO-000001",
        "category": EventCategory.POTENTIAL_SAND_MINING.value,
        "risk_score": 87,
        "risk_level": RiskLevel.CRITICAL.value,
        "confidence": 0.91,
        "area_ha": 2.73,
        "distance_to_river_m": 120.0,
        "distance_to_road_m": 450.0,
        "distance_to_settlement_m": 1200.0,
        "distance_to_protected_area_m": 8500.0,
        "inside_mining_lease": False,
        "lease_data_available": False,
        "explanation": (
            "[DEMO DATA] Synthetic event flagged for demonstration purposes.\n\n"
            "Why flagged (synthetic demonstration):\n"
            "• Disturbed area increased by 2.73 ha across 3 synthetic observations\n"
            "• Change persisted over 3 consecutive observations (persistent, not one-off)\n"
            "• Vegetation index (NDVI) decreased from 0.42 to 0.09\n"
            "• SAR backscatter change corroborates optical disturbance\n"
            "• Location is 120 m from the mapped river channel\n"
            "• No matching mining lease polygon found in available datasets\n\n"
            "⚠ This is synthetic DEMO DATA. It does not represent a real environmental incident."
        ),
        "limitations": (
            "Regulatory boundary dataset is incomplete for this region. "
            "Field verification would be required before any legal conclusions. "
            "This event is DEMO DATA only."
        ),
        "recommended_actions": (
            "1. Field verification by environmental officer\n"
            "2. Cross-check with district mining department records\n"
            "3. This is DEMO DATA — no real action required"
        ),
        "first_observed_offset_days": -90,
        "last_observed_offset_days": -5,
        "observation_count": 3,
        "site_index": 0,
        # Polygon near Hospet on Tungabhadra
        "geometry_wkt": "MULTIPOLYGON(((76.3920 15.2750, 76.3950 15.2750, 76.3950 15.2780, 76.3920 15.2780, 76.3920 15.2750)))",
    },
    {
        "event_id": "ENV-DEMO-000002",
        "category": EventCategory.POTENTIAL_LAND_EXCAVATION.value,
        "risk_score": 74,
        "risk_level": RiskLevel.HIGH.value,
        "confidence": 0.78,
        "area_ha": 5.1,
        "distance_to_river_m": 800.0,
        "distance_to_road_m": 200.0,
        "distance_to_settlement_m": 2500.0,
        "distance_to_protected_area_m": 3200.0,
        "inside_mining_lease": None,
        "lease_data_available": False,
        "explanation": (
            "[DEMO DATA] Synthetic high-risk land excavation event.\n\n"
            "Why flagged (synthetic demonstration):\n"
            "• 5.1 ha of new bare earth disturbance detected\n"
            "• BSI (Bare Soil Index) increased significantly\n"
            "• NDVI decreased from 0.35 to 0.04\n"
            "• Expansion pattern consistent with open-pit progression\n"
            "• Regulatory boundary data unavailable\n\n"
            "⚠ This is synthetic DEMO DATA."
        ),
        "limitations": (
            "SAR data unavailable for this period due to synthetic data limitation. "
            "Lease boundary data not available. DEMO DATA only."
        ),
        "recommended_actions": (
            "1. Request SAR imagery for cloud-independent verification\n"
            "2. Contact district mining authority\n"
            "3. This is DEMO DATA — no real action required"
        ),
        "first_observed_offset_days": -60,
        "last_observed_offset_days": -10,
        "observation_count": 2,
        "site_index": 2,
        # Polygon near Ballari
        "geometry_wkt": "MULTIPOLYGON(((76.9350 15.1450, 76.9400 15.1450, 76.9400 15.1490, 76.9350 15.1490, 76.9350 15.1450)))",
    },
    {
        "event_id": "ENV-DEMO-000003",
        "category": EventCategory.POTENTIAL_LAND_FILLING.value,
        "risk_score": 42,
        "risk_level": RiskLevel.MODERATE.value,
        "confidence": 0.62,
        "area_ha": 1.2,
        "distance_to_river_m": 200.0,
        "distance_to_road_m": 100.0,
        "distance_to_settlement_m": 500.0,
        "distance_to_protected_area_m": 12000.0,
        "inside_mining_lease": None,
        "lease_data_available": False,
        "explanation": (
            "[DEMO DATA] Synthetic moderate-risk land filling / dumping event.\n\n"
            "Why flagged (synthetic demonstration):\n"
            "• 1.2 ha of apparent fill material accumulation\n"
            "• NDWI indicates water body reduction\n"
            "• Elevated bare-earth signal near settlement\n"
            "• Change detected in only 1 observation — not yet persistent\n\n"
            "⚠ This is synthetic DEMO DATA."
        ),
        "limitations": (
            "Only 1 observation confirms change — persistence not established. "
            "Could be temporary construction. DEMO DATA only."
        ),
        "recommended_actions": (
            "1. Monitor for persistence in next observation\n"
            "2. Check local construction permits\n"
            "3. This is DEMO DATA — no real action required"
        ),
        "first_observed_offset_days": -15,
        "last_observed_offset_days": -15,
        "observation_count": 1,
        "site_index": 1,
        # Polygon near Cauvery/Mandya
        "geometry_wkt": "MULTIPOLYGON(((76.8350 12.5350, 76.8400 12.5350, 76.8400 12.5380, 76.8350 12.5380, 76.8350 12.5350)))",
    },
]


async def seed_karnataka_demo(db: AsyncSession) -> dict:
    """
    Insert Karnataka demo sites, observations, and events.
    Idempotent — skips records that already exist.
    Returns a summary of what was inserted.
    """
    now = datetime.utcnow()
    inserted = {"sites": 0, "observations": 0, "events": 0}
    site_ids: list[str] = []

    # ── Sites ──────────────────────────────────────────────────
    for demo_site in DEMO_SITES:
        from sqlalchemy import select
        existing = (await db.execute(
            select(Site).where(Site.name == demo_site["name"])
        )).scalar_one_or_none()

        if existing:
            site_ids.append(existing.id)
            continue

        geom = demo_site["geometry"]
        coords = geom["coordinates"][0]
        wkt_coords = ", ".join(f"{lon} {lat}" for lon, lat in coords)
        wkt = f"POLYGON(({wkt_coords}))"

        site = Site(
            id=str(uuid.uuid4()),
            name=demo_site["name"],
            description=demo_site["description"],
            geometry=f"SRID=4326;{wkt}",
            area_ha=demo_site["area_ha"],
            is_demo=True,
            monitoring_enabled=False,  # demo sites don't schedule real jobs
        )
        db.add(site)
        await db.flush()
        site_ids.append(site.id)
        inserted["sites"] += 1

    # ── Observations (3 per demo site) ─────────────────────────
    obs_map: dict[int, list[str]] = {i: [] for i in range(len(DEMO_SITES))}

    for site_idx, site_id in enumerate(site_ids):
        for obs_num in range(3):
            scene_id = f"DEMO-S2-KA-{site_idx:02d}-OBS{obs_num:02d}"
            from sqlalchemy import select
            existing = (await db.execute(
                select(Observation).where(
                    Observation.site_id == site_id,
                    Observation.scene_id == scene_id,
                )
            )).scalar_one_or_none()

            if existing:
                obs_map[site_idx].append(existing.id)
                continue

            acq_date = now - timedelta(days=(90 - obs_num * 30))
            obs = Observation(
                id=str(uuid.uuid4()),
                site_id=site_id,
                provider=SatelliteProvider.DEMO.value,
                collection="sentinel-2-l2a-demo",
                scene_id=scene_id,
                acquisition_date=acq_date,
                cloud_pct_scene=5.0 + obs_num * 3,
                cloud_pct_aoi=2.0 + obs_num * 2,
                valid_pixel_pct=96.0 - obs_num * 2,
                data_quality="high",
                status=ObservationStatus.READY.value,
                is_demo=True,
                preprocessing_version="demo-v1",
                metadata={
                    "note": "[DEMO DATA] Synthetic observation record",
                    "platform": "Sentinel-2A (demo)",
                    "bands": ["B2", "B3", "B4", "B8", "B11", "B12"],
                },
            )
            db.add(obs)
            await db.flush()
            obs_map[site_idx].append(obs.id)
            inserted["observations"] += 1

    # ── Events ──────────────────────────────────────────────────
    for demo_event in DEMO_EVENTS:
        from sqlalchemy import select
        existing = (await db.execute(
            select(ForensicEvent).where(ForensicEvent.event_id == demo_event["event_id"])
        )).scalar_one_or_none()

        if existing:
            continue

        site_idx = demo_event["site_index"]
        site_id = site_ids[site_idx]

        event = ForensicEvent(
            id=str(uuid.uuid4()),
            event_id=demo_event["event_id"],
            site_id=site_id,
            category=demo_event["category"],
            status=EventStatus.UNREVIEWED.value,
            first_observed=now + timedelta(days=demo_event["first_observed_offset_days"]),
            last_observed=now + timedelta(days=demo_event["last_observed_offset_days"]),
            observation_count=demo_event["observation_count"],
            geometry=f"SRID=4326;{demo_event['geometry_wkt']}",
            area_ha=demo_event["area_ha"],
            risk_score=demo_event["risk_score"],
            risk_level=demo_event["risk_level"],
            confidence=demo_event["confidence"],
            distance_to_river_m=demo_event["distance_to_river_m"],
            distance_to_road_m=demo_event["distance_to_road_m"],
            distance_to_settlement_m=demo_event["distance_to_settlement_m"],
            distance_to_protected_area_m=demo_event["distance_to_protected_area_m"],
            inside_mining_lease=demo_event["inside_mining_lease"],
            lease_data_available=demo_event["lease_data_available"],
            explanation=demo_event["explanation"],
            limitations=demo_event["limitations"],
            recommended_actions=demo_event["recommended_actions"],
            is_demo=True,
            model_version="demo-baseline-v1",
            preprocessing_version="demo-v1",
            evidence={
                "note": "[DEMO DATA] Synthetic evidence chain",
                "source_scenes": obs_map.get(site_idx, []),
                "indices_used": ["NDVI", "NDWI", "BSI"],
            },
        )
        db.add(event)
        inserted["events"] += 1

    await db.flush()
    return inserted
