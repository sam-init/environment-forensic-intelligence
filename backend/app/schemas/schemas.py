"""
Pydantic schemas for Sites/AOI API.
Validates geometry, enforces CRS rules, and rejects invalid coordinates.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class GeometrySchema(BaseModel):
    """GeoJSON-compatible geometry schema."""
    type: str
    coordinates: list[Any]

    @field_validator("type")
    @classmethod
    def validate_geometry_type(cls, v: str) -> str:
        allowed = {"Polygon", "MultiPolygon", "Point", "LineString"}
        if v not in allowed:
            raise ValueError(f"Geometry type must be one of {allowed}")
        return v


class SiteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    geometry: GeometrySchema
    monitoring_interval_days: int = Field(default=5, ge=1, le=365)
    cloud_threshold: float = Field(default=60.0, ge=0.0, le=100.0)
    min_valid_pixels: float = Field(default=40.0, ge=0.0, le=100.0)
    risk_threshold: int = Field(default=25, ge=0, le=100)


class SiteUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    monitoring_enabled: bool | None = None
    monitoring_interval_days: int | None = Field(None, ge=1, le=365)
    cloud_threshold: float | None = Field(None, ge=0.0, le=100.0)
    min_valid_pixels: float | None = Field(None, ge=0.0, le=100.0)
    risk_threshold: int | None = Field(None, ge=0, le=100)


class SiteResponse(BaseModel):
    id: str
    name: str
    description: str | None
    geometry: dict[str, Any]
    area_ha: float | None
    status: str
    is_demo: bool
    monitoring_enabled: bool
    monitoring_interval_days: int
    cloud_threshold: float
    min_valid_pixels: float
    risk_threshold: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SiteListResponse(BaseModel):
    total: int
    items: list[SiteResponse]


# ── Observation Schemas ────────────────────────────────────────────────────────

class ObservationResponse(BaseModel):
    id: str
    site_id: str
    provider: str
    collection: str
    scene_id: str
    acquisition_date: datetime
    cloud_pct_scene: float | None
    cloud_pct_aoi: float | None
    valid_pixel_pct: float | None
    data_quality: str
    status: str
    is_demo: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ObservationListResponse(BaseModel):
    total: int
    items: list[ObservationResponse]


# ── Event Schemas ──────────────────────────────────────────────────────────────

class RiskBreakdown(BaseModel):
    """Human-readable risk score breakdown for explainability."""
    factor: str
    score: float
    weight: float
    weighted_score: float
    explanation: str


class EventResponse(BaseModel):
    id: str
    event_id: str
    site_id: str
    category: str
    status: str
    first_observed: datetime | None
    last_observed: datetime | None
    observation_count: int
    geometry: dict[str, Any] | None
    area_ha: float | None
    risk_score: int | None
    risk_level: str | None
    confidence: float | None
    distance_to_river_m: float | None
    distance_to_road_m: float | None
    distance_to_protected_area_m: float | None
    inside_mining_lease: bool | None
    lease_data_available: bool
    explanation: str | None
    limitations: str | None
    recommended_actions: str | None
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EventListResponse(BaseModel):
    total: int
    items: list[EventResponse]


class EventReviewUpdate(BaseModel):
    status: str = Field(..., description="New review status")
    notes: str | None = None
    reviewer: str = Field(default="analyst")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {
            "unreviewed", "under_review", "confirmed_disturbance",
            "false_positive", "requires_field_verification", "closed"
        }
        if v not in allowed:
            raise ValueError(f"Status must be one of {allowed}")
        return v


# ── Job Schemas ────────────────────────────────────────────────────────────────

class JobResponse(BaseModel):
    id: str
    job_type: str
    site_id: str | None
    status: str
    params: dict | None
    result: dict | None
    error_message: str | None
    retries: int
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ── Health / System Schemas ────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str
    demo_mode: bool


class ReadinessResponse(BaseModel):
    status: str
    checks: dict[str, str]
    timestamp: datetime


# ── Error Schema ───────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    request_id: str | None = None
