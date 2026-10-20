"""
Initial migration: create all core EFI tables with PostGIS geometry columns.

Revision: 0001
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── sites ──────────────────────────────────────────────────────────────────
    op.create_table(
        "sites",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("geometry", Geometry("POLYGON", srid=4326, spatial_index=False), nullable=False),
        sa.Column("area_ha", sa.Float()),
        sa.Column("status", sa.String(50), default="active"),
        sa.Column("is_demo", sa.Boolean(), default=False),
        sa.Column("monitoring_enabled", sa.Boolean(), default=True),
        sa.Column("monitoring_interval_days", sa.Integer(), default=5),
        sa.Column("cloud_threshold", sa.Float(), default=60.0),
        sa.Column("min_valid_pixels", sa.Float(), default=40.0),
        sa.Column("risk_threshold", sa.Integer(), default=25),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime()),
    )
    op.create_index("idx_sites_geometry", "sites", ["geometry"], postgresql_using="gist")
    op.create_index("idx_sites_status", "sites", ["status"])
    op.create_index("idx_sites_is_demo", "sites", ["is_demo"])

    # ── observations ───────────────────────────────────────────────────────────
    op.create_table(
        "observations",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("collection", sa.String(100), nullable=False),
        sa.Column("scene_id", sa.String(255), nullable=False),
        sa.Column("acquisition_date", sa.DateTime(), nullable=False),
        sa.Column("cloud_pct_scene", sa.Float()),
        sa.Column("cloud_pct_aoi", sa.Float()),
        sa.Column("valid_pixel_pct", sa.Float()),
        sa.Column("rejected_pixel_pct", sa.Float()),
        sa.Column("data_quality", sa.String(20), default="medium"),
        sa.Column("status", sa.String(50), default="pending"),
        sa.Column("error_message", sa.Text()),
        sa.Column("raw_path", sa.Text()),
        sa.Column("processed_path", sa.Text()),
        sa.Column("provider_metadata", postgresql.JSONB()),
        sa.Column("preprocessing_version", sa.String(50)),
        sa.Column("is_demo", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_observation_site_scene", "observations", ["site_id", "scene_id"])
    op.create_index("idx_observations_site_id", "observations", ["site_id"])
    op.create_index("idx_observations_acquisition_date", "observations", ["acquisition_date"])
    op.create_index("idx_observations_status", "observations", ["status"])
    op.create_index("idx_observations_scene_id", "observations", ["scene_id"])

    # ── observation_features ───────────────────────────────────────────────────
    op.create_table(
        "observation_features",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("observation_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("observations.id"), nullable=False),
        sa.Column("feature_name", sa.String(100), nullable=False),
        sa.Column("raster_path", sa.Text()),
        sa.Column("stats", postgresql.JSONB()),
        sa.Column("computed_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_feature_obs_name", "observation_features", ["observation_id", "feature_name"])
    op.create_index("idx_obs_features_obs_id", "observation_features", ["observation_id"])

    # ── events ─────────────────────────────────────────────────────────────────
    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("event_id", sa.String(50), unique=True, nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("category", sa.String(100), default="unknown"),
        sa.Column("status", sa.String(50), default="unreviewed"),
        sa.Column("first_observed", sa.DateTime()),
        sa.Column("last_observed", sa.DateTime()),
        sa.Column("observation_count", sa.Integer(), default=1),
        sa.Column("geometry", Geometry("MULTIPOLYGON", srid=4326, spatial_index=False)),
        sa.Column("area_ha", sa.Float()),
        sa.Column("perimeter_m", sa.Float()),
        sa.Column("risk_score", sa.Integer()),
        sa.Column("risk_level", sa.String(20)),
        sa.Column("confidence", sa.Float()),
        sa.Column("distance_to_river_m", sa.Float()),
        sa.Column("distance_to_road_m", sa.Float()),
        sa.Column("distance_to_settlement_m", sa.Float()),
        sa.Column("distance_to_protected_area_m", sa.Float()),
        sa.Column("inside_mining_lease", sa.Boolean()),
        sa.Column("lease_data_available", sa.Boolean(), default=False),
        sa.Column("model_version", sa.String(50)),
        sa.Column("preprocessing_version", sa.String(50)),
        sa.Column("evidence", postgresql.JSONB()),
        sa.Column("explanation", sa.Text()),
        sa.Column("limitations", sa.Text()),
        sa.Column("recommended_actions", sa.Text()),
        sa.Column("is_demo", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime()),
    )
    op.create_index("idx_events_geometry", "events", ["geometry"], postgresql_using="gist")
    op.create_index("idx_events_site_id", "events", ["site_id"])
    op.create_index("idx_events_status", "events", ["status"])
    op.create_index("idx_events_risk_score", "events", ["risk_score"])
    op.create_index("idx_events_category", "events", ["category"])
    op.create_index("idx_events_first_observed", "events", ["first_observed"])

    # ── event_observations ──────────────────────────────────────────────────────
    op.create_table(
        "event_observations",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("observation_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("observations.id"), nullable=False),
        sa.Column("role", sa.String(20)),
    )
    op.create_unique_constraint("uq_event_observation", "event_observations", ["event_id", "observation_id"])
    op.create_index("idx_event_obs_event_id", "event_observations", ["event_id"])

    # ── risk_calculations ──────────────────────────────────────────────────────
    op.create_table(
        "risk_calculations",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("weights_version", sa.String(50), nullable=False),
        sa.Column("factors", postgresql.JSONB(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("calculated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── reviews ────────────────────────────────────────────────────────────────
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("reviewer", sa.String(255), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("confidence_override", sa.Float()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── jobs ───────────────────────────────────────────────────────────────────
    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("job_type", sa.String(50), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("sites.id")),
        sa.Column("status", sa.String(20), default="pending"),
        sa.Column("params", postgresql.JSONB()),
        sa.Column("result", postgresql.JSONB()),
        sa.Column("error_message", sa.Text()),
        sa.Column("retries", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("completed_at", sa.DateTime()),
    )
    op.create_index("idx_jobs_status", "jobs", ["status"])
    op.create_index("idx_jobs_site_id", "jobs", ["site_id"])
    op.create_index("idx_jobs_job_type", "jobs", ["job_type"])
    op.create_index("idx_jobs_created_at", "jobs", ["created_at"])

    # ── audit_log ──────────────────────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", sa.String(255)),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_type", sa.String(100), nullable=False),
        sa.Column("target_id", sa.String(255)),
        sa.Column("previous_state", postgresql.JSONB()),
        sa.Column("new_state", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("idx_audit_log_target", "audit_log", ["target_type", "target_id"])
    op.create_index("idx_audit_log_created_at", "audit_log", ["created_at"])
    op.create_index("idx_audit_log_action", "audit_log", ["action"])

    # ── data_sources ──────────────────────────────────────────────────────────
    op.create_table(
        "data_sources",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(255), unique=True, nullable=False),
        sa.Column("provider", sa.String(255), nullable=False),
        sa.Column("license", sa.String(255)),
        sa.Column("source_url", sa.Text()),
        sa.Column("access_date", sa.DateTime()),
        sa.Column("version", sa.String(100)),
        sa.Column("allowed_use", sa.Text()),
        sa.Column("attribution_required", sa.Boolean(), default=True),
        sa.Column("redistribution_allowed", sa.Boolean()),
        sa.Column("ingestion_status", sa.String(50), default="NOT_INGESTED"),
        sa.Column("source_metadata", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── ml_models ─────────────────────────────────────────────────────────────
    op.create_table(
        "ml_models",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("model_id", sa.String(100), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("architecture", sa.String(100), nullable=False),
        sa.Column("training_dataset_version", sa.String(100)),
        sa.Column("preprocessing_version", sa.String(50)),
        sa.Column("hyperparameters", postgresql.JSONB()),
        sa.Column("metrics", postgresql.JSONB()),
        sa.Column("artifact_path", sa.Text()),
        sa.Column("training_date", sa.DateTime()),
        sa.Column("is_active", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_model_version", "ml_models", ["model_id", "version"])
    op.create_index("idx_ml_models_is_active", "ml_models", ["is_active"])


def downgrade() -> None:
    op.drop_table("ml_models")
    op.drop_table("data_sources")
    op.drop_table("audit_log")
    op.drop_table("jobs")
    op.drop_table("reviews")
    op.drop_table("risk_calculations")
    op.drop_table("event_observations")
    op.drop_table("events")
    op.drop_table("observation_features")
    op.drop_table("observations")
    op.drop_table("sites")
