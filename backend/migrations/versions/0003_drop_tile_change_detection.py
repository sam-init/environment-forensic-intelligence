"""Drop the removed tile-based change-detection tables.

Revision ID: 0003_drop_tile_change_detection
Revises: 0002_tile_change_detection
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry
from sqlalchemy.dialects import postgresql

revision = "0003_drop_tile_change_detection"
down_revision = "0002_tile_change_detection"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS change_candidates"))
    op.execute(sa.text("DROP TABLE IF EXISTS processing_tiles"))


def downgrade() -> None:
    op.create_table(
        "processing_tiles",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("tile_id", sa.String(100), nullable=False, unique=True),
        sa.Column("geometry", Geometry("MULTIPOLYGON", srid=4326, spatial_index=False), nullable=False),
        sa.Column("tile_size_m", sa.Integer(), nullable=False, server_default="5000"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("last_input_signature", sa.String(64)),
        sa.Column("last_processed_at", sa.DateTime()),
        sa.Column("retries", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text()),
        sa.Column("processing_log", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("idx_processing_tiles_geometry", "processing_tiles", ["geometry"], postgresql_using="gist")
    op.create_index("idx_processing_tiles_status", "processing_tiles", ["status"])
    op.create_table(
        "change_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("candidate_id", sa.String(100), nullable=False, unique=True),
        sa.Column("tile_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("processing_tiles.id"), nullable=False),
        sa.Column("geometry", Geometry("MULTIPOLYGON", srid=4326, spatial_index=False), nullable=False),
        sa.Column("area_ha", sa.Float(), nullable=False),
        sa.Column("before_start", sa.DateTime(), nullable=False), sa.Column("before_end", sa.DateTime(), nullable=False),
        sa.Column("after_start", sa.DateTime(), nullable=False), sa.Column("after_end", sa.DateTime(), nullable=False),
        sa.Column("imagery_ids", postgresql.JSONB(), nullable=False), sa.Column("indicators", postgresql.JSONB(), nullable=False),
        sa.Column("change_score", sa.Integer(), nullable=False), sa.Column("status", sa.String(50), nullable=False, server_default="unreviewed"),
        sa.Column("input_signature", sa.String(64), nullable=False), sa.Column("source", sa.String(100), nullable=False),
        sa.Column("high_resolution_source", sa.Text()), sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("tile_id", "input_signature", "candidate_id", name="uq_candidate_run_id"),
    )
    op.create_index("idx_change_candidates_geometry", "change_candidates", ["geometry"], postgresql_using="gist")
    op.create_index("idx_change_candidates_score", "change_candidates", ["change_score"])
    op.create_index("idx_change_candidates_tile", "change_candidates", ["tile_id"])
