"""
EFI Backend — SQLAlchemy ORM Models
All core database models for the Environmental Forensic Intelligence platform.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Any

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ── Enumerations ─────────────────────────────────────────────────────────────

class SiteStatus(str, PyEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class ObservationStatus(str, PyEnum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    PREPROCESSING = "preprocessing"
    READY = "ready"
    PROCESSING_FAILED = "processing_failed"
    INSUFFICIENT_DATA = "insufficient_data"
    CLOUD_REJECTED = "cloud_rejected"


class EventCategory(str, PyEnum):
    POTENTIAL_SAND_MINING = "potential_sand_mining"
    POTENTIAL_LAND_EXCAVATION = "potential_land_excavation"
    POTENTIAL_LAND_FILLING = "potential_land_filling"
    VEGETATION_LOSS = "vegetation_loss"
    WATER_BODY_ALTERATION = "water_body_alteration"
    GENERAL_DISTURBANCE = "general_disturbance"
    UNKNOWN = "unknown"


class EventStatus(str, PyEnum):
    UNREVIEWED = "unreviewed"
    UNDER_REVIEW = "under_review"
    CONFIRMED_DISTURBANCE = "confirmed_disturbance"
    FALSE_POSITIVE = "false_positive"
    REQUIRES_FIELD_VERIFICATION = "requires_field_verification"
    CLOSED = "closed"


class RiskLevel(str, PyEnum):
    LOW = "low"           # 0–24
    MODERATE = "moderate" # 25–49
    HIGH = "high"         # 50–74
    CRITICAL = "critical" # 75–100


class JobStatus(str, PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class JobType(str, PyEnum):
    SEARCH_IMAGERY = "search_imagery"
    DOWNLOAD_SCENE = "download_scene"
    PREPROCESS_SCENE = "preprocess_scene"
    DETECT_CHANGE = "detect_change"
    RUN_INFERENCE = "run_inference"
    CALCULATE_RISK = "calculate_risk"
    GENERATE_REPORT = "generate_report"
    MONITOR_SITE = "monitor_site"


class DataQuality(str, PyEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INSUFFICIENT = "insufficient"


class SatelliteProvider(str, PyEnum):
    SENTINEL2 = "sentinel-2"
    SENTINEL1 = "sentinel-1"
    LANDSAT = "landsat"
    DEMO = "demo"


# ── Helper ────────────────────────────────────────────────────────────────────

def utcnow() -> datetime:
    return datetime.utcnow()


def new_uuid() -> str:
    return str(uuid.uuid4())


# ── Site / AOI ────────────────────────────────────────────────────────────────

class Site(Base):
    """
    A monitoring site with an Area of Interest (AOI) polygon.
    The geometry is stored in WGS84 (EPSG:4326).
    Area calculations must use a projected CRS — never raw degrees.
    """
    __tablename__ = "sites"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    geometry = mapped_column(
        Geometry("POLYGON", srid=4326), nullable=False
    )
    # Area is stored in hectares (computed server-side using EPSG:32644 or appropriate UTM zone)
    area_ha: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(
        String(50), default=SiteStatus.ACTIVE.value
    )
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    # Monitoring configuration
    monitoring_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    monitoring_interval_days: Mapped[int] = mapped_column(Integer, default=5)
    cloud_threshold: Mapped[float] = mapped_column(Float, default=60.0)
    min_valid_pixels: Mapped[float] = mapped_column(Float, default=40.0)
    risk_threshold: Mapped[int] = mapped_column(Integer, default=25)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Relationships
    observations: Mapped[list["Observation"]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )
    events: Mapped[list["ForensicEvent"]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["Job"]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_sites_geometry", "geometry", postgresql_using="gist"),
        Index("idx_sites_status", "status"),
        Index("idx_sites_is_demo", "is_demo"),
    )


# ── Observation ───────────────────────────────────────────────────────────────

class Observation(Base):
    """
    A single satellite scene acquisition over a monitoring site.
    Tracks cloud coverage, data quality, and processing status.
    """
    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    site_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("sites.id"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    collection: Mapped[str] = mapped_column(String(100), nullable=False)
    scene_id: Mapped[str] = mapped_column(String(255), nullable=False)
    acquisition_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Cloud statistics
    cloud_pct_scene: Mapped[float | None] = mapped_column(Float)
    cloud_pct_aoi: Mapped[float | None] = mapped_column(Float)
    valid_pixel_pct: Mapped[float | None] = mapped_column(Float)
    rejected_pixel_pct: Mapped[float | None] = mapped_column(Float)
    data_quality: Mapped[str] = mapped_column(
        String(20), default=DataQuality.MEDIUM.value
    )

    # Status
    status: Mapped[str] = mapped_column(
        String(50), default=ObservationStatus.PENDING.value
    )
    error_message: Mapped[str | None] = mapped_column(Text)

    # Storage paths
    raw_path: Mapped[str | None] = mapped_column(Text)
    processed_path: Mapped[str | None] = mapped_column(Text)

    # Provider-native metadata stored as JSONB
    provider_metadata: Mapped[dict | None] = mapped_column(JSONB)
    preprocessing_version: Mapped[str | None] = mapped_column(String(50))

    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow
    )

    # Relationships
    site: Mapped["Site"] = relationship(back_populates="observations")
    features: Mapped[list["ObservationFeature"]] = relationship(
        back_populates="observation", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # Prevent duplicate ingestion of the same scene for the same site
        UniqueConstraint("site_id", "scene_id", name="uq_observation_site_scene"),
        Index("idx_observations_site_id", "site_id"),
        Index("idx_observations_acquisition_date", "acquisition_date"),
        Index("idx_observations_status", "status"),
        Index("idx_observations_scene_id", "scene_id"),
    )


class ObservationFeature(Base):
    """
    Derived raster features and spectral indices for an observation.
    Each row represents one computed layer (e.g., NDVI, NDWI, BSI).
    """
    __tablename__ = "observation_features"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    observation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("observations.id"), nullable=False
    )
    feature_name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "ndvi", "bsi"
    raster_path: Mapped[str | None] = mapped_column(Text)
    stats: Mapped[dict | None] = mapped_column(JSONB)  # min, max, mean, std, p5, p95
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    observation: Mapped["Observation"] = relationship(back_populates="features")

    __table_args__ = (
        UniqueConstraint("observation_id", "feature_name", name="uq_feature_obs_name"),
        Index("idx_obs_features_obs_id", "observation_id"),
    )


# ── Forensic Event ─────────────────────────────────────────────────────────────

class ForensicEvent(Base):
    """
    A detected environmental disturbance event.
    Aggregates observations across time for a persistent disturbance.
    NEVER auto-declares activity as illegal — uses probabilistic language.
    """
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    # Human-readable ID: ENV-2026-000001
    event_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    site_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("sites.id"), nullable=False
    )
    category: Mapped[str] = mapped_column(
        String(100), default=EventCategory.UNKNOWN.value
    )
    status: Mapped[str] = mapped_column(
        String(50), default=EventStatus.UNREVIEWED.value
    )

    # Temporal extent
    first_observed: Mapped[datetime | None] = mapped_column(DateTime)
    last_observed: Mapped[datetime | None] = mapped_column(DateTime)
    observation_count: Mapped[int] = mapped_column(Integer, default=1)

    # Spatial
    geometry = mapped_column(Geometry("MULTIPOLYGON", srid=4326))
    area_ha: Mapped[float | None] = mapped_column(Float)
    perimeter_m: Mapped[float | None] = mapped_column(Float)

    # Risk
    risk_score: Mapped[int | None] = mapped_column(Integer)  # 0–100
    risk_level: Mapped[str | None] = mapped_column(String(20))
    confidence: Mapped[float | None] = mapped_column(Float)  # 0.0–1.0

    # GIS forensic context
    distance_to_river_m: Mapped[float | None] = mapped_column(Float)
    distance_to_road_m: Mapped[float | None] = mapped_column(Float)
    distance_to_settlement_m: Mapped[float | None] = mapped_column(Float)
    distance_to_protected_area_m: Mapped[float | None] = mapped_column(Float)
    inside_mining_lease: Mapped[bool | None] = mapped_column(Boolean)
    lease_data_available: Mapped[bool] = mapped_column(Boolean, default=False)

    # Model provenance
    model_version: Mapped[str | None] = mapped_column(String(50))
    preprocessing_version: Mapped[str | None] = mapped_column(String(50))

    # Evidence JSONB — full provenance chain
    evidence: Mapped[dict | None] = mapped_column(JSONB)

    # Human-readable explanation
    explanation: Mapped[str | None] = mapped_column(Text)
    limitations: Mapped[str | None] = mapped_column(Text)
    recommended_actions: Mapped[str | None] = mapped_column(Text)

    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Relationships
    site: Mapped["Site"] = relationship(back_populates="events")
    event_observations: Mapped[list["EventObservation"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    risk_calculations: Mapped[list["RiskCalculation"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_events_geometry", "geometry", postgresql_using="gist"),
        Index("idx_events_site_id", "site_id"),
        Index("idx_events_status", "status"),
        Index("idx_events_risk_score", "risk_score"),
        Index("idx_events_category", "category"),
        Index("idx_events_first_observed", "first_observed"),
    )


class EventObservation(Base):
    """Links observations to events as evidence (BEFORE/DURING/AFTER)."""
    __tablename__ = "event_observations"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    event_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("events.id"), nullable=False
    )
    observation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("observations.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20))  # BEFORE, DURING, AFTER

    event: Mapped["ForensicEvent"] = relationship(back_populates="event_observations")
    observation: Mapped["Observation"] = relationship()

    __table_args__ = (
        UniqueConstraint("event_id", "observation_id", name="uq_event_observation"),
        Index("idx_event_obs_event_id", "event_id"),
    )


# ── Risk Calculation ───────────────────────────────────────────────────────────

class RiskCalculation(Base):
    """
    Stores the full risk score breakdown for an event.
    Each factor is documented so analysts can inspect why a score was generated.
    """
    __tablename__ = "risk_calculations"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    event_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("events.id"), nullable=False
    )
    weights_version: Mapped[str] = mapped_column(String(50), nullable=False)
    factors: Mapped[dict] = mapped_column(JSONB, nullable=False)  # per-factor scores & weights
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    event: Mapped["ForensicEvent"] = relationship(back_populates="risk_calculations")


# ── Review ────────────────────────────────────────────────────────────────────

class Review(Base):
    """Analyst review of a forensic event."""
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    event_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("events.id"), nullable=False
    )
    reviewer: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    confidence_override: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    event: Mapped["ForensicEvent"] = relationship(back_populates="reviews")


# ── Background Jobs ───────────────────────────────────────────────────────────

class Job(Base):
    """
    Background job record.
    Jobs are idempotent — running the same job twice must not corrupt data.
    """
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    job_type: Mapped[str] = mapped_column(String(50), nullable=False)
    site_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("sites.id")
    )
    status: Mapped[str] = mapped_column(
        String(20), default=JobStatus.PENDING.value
    )
    params: Mapped[dict | None] = mapped_column(JSONB)
    result: Mapped[dict | None] = mapped_column(JSONB)
    error_message: Mapped[str | None] = mapped_column(Text)
    retries: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    site: Mapped["Site | None"] = relationship(back_populates="jobs")

    __table_args__ = (
        Index("idx_jobs_status", "status"),
        Index("idx_jobs_site_id", "site_id"),
        Index("idx_jobs_job_type", "job_type"),
        Index("idx_jobs_created_at", "created_at"),
    )


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditLog(Base):
    """Immutable audit trail — every important action is recorded."""
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    user_id: Mapped[str | None] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str] = mapped_column(String(100), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(255))
    previous_state: Mapped[dict | None] = mapped_column(JSONB)
    new_state: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (
        Index("idx_audit_log_target", "target_type", "target_id"),
        Index("idx_audit_log_created_at", "created_at"),
        Index("idx_audit_log_action", "action"),
    )


# ── Data Source Registry ───────────────────────────────────────────────────────

class DataSource(Base):
    """
    Registry of every external dataset used by the system.
    Every source must document its license, URL, and usage rights.
    'LICENSE_REVIEW_REQUIRED' is a valid status.
    """
    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(255), nullable=False)
    license: Mapped[str | None] = mapped_column(String(255))
    source_url: Mapped[str | None] = mapped_column(Text)
    access_date: Mapped[datetime | None] = mapped_column(DateTime)
    version: Mapped[str | None] = mapped_column(String(100))
    allowed_use: Mapped[str | None] = mapped_column(Text)
    attribution_required: Mapped[bool] = mapped_column(Boolean, default=True)
    redistribution_allowed: Mapped[bool | None] = mapped_column(Boolean)
    ingestion_status: Mapped[str] = mapped_column(
        String(50), default="NOT_INGESTED"
    )  # NOT_INGESTED | INGESTED | PARTIAL | FAILED | LICENSE_REVIEW_REQUIRED
    source_metadata: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow
    )


# ── Model Registry ────────────────────────────────────────────────────────────

class MLModel(Base):
    """
    Registry of trained ML models.
    Production models are never silently overwritten.
    Each model version is immutable after activation.
    """
    __tablename__ = "ml_models"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    model_id: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    architecture: Mapped[str] = mapped_column(String(100), nullable=False)
    training_dataset_version: Mapped[str | None] = mapped_column(String(100))
    preprocessing_version: Mapped[str | None] = mapped_column(String(50))
    hyperparameters: Mapped[dict | None] = mapped_column(JSONB)
    metrics: Mapped[dict | None] = mapped_column(JSONB)
    artifact_path: Mapped[str | None] = mapped_column(Text)
    training_date: Mapped[datetime | None] = mapped_column(DateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (
        UniqueConstraint("model_id", "version", name="uq_model_version"),
        Index("idx_ml_models_is_active", "is_active"),
    )
