"""
EFI Backend — Application Configuration
Reads from environment variables / .env file using Pydantic Settings.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central application configuration.
    All values are read from environment variables.
    See .env.example for documentation of each variable.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────
    app_env: Literal["development", "staging", "production"] = "development"
    app_secret_key: str = "dev-insecure-secret-change-in-production"
    app_debug: bool = True
    demo_mode: bool = True

    # ── Database ─────────────────────────────────────────────────
    database_url: str = (
        "postgresql+asyncpg://efi_user:efi_password@localhost:5432/efi_db"
    )

    # ── Redis ─────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Storage ───────────────────────────────────────────────────
    storage_backend: Literal["local", "s3"] = "local"
    storage_local_path: Path = Path("/app/data")

    # ── Copernicus (optional — not required in demo mode) ─────────
    copernicus_username: str = ""
    copernicus_password: str = ""
    copernicus_stac_url: str = "https://stac.dataspace.copernicus.eu/v1"

    # ── CORS ─────────────────────────────────────────────────────
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # ── Workers ───────────────────────────────────────────────────
    worker_concurrency: int = 2
    job_max_retries: int = 3
    job_retry_delay_seconds: int = 60

    # ── Preprocessing ─────────────────────────────────────────────
    preprocessing_version: str = "v1.0.0"
    default_cloud_threshold: float = 60.0
    default_min_valid_pixels: float = 40.0

    # ── Risk Engine ───────────────────────────────────────────────
    risk_config_path: Path = Path("/app/configs/risk_weights.json")

    # ── Logging ───────────────────────────────────────────────────
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_format: Literal["json", "console"] = "console"

    @model_validator(mode="after")
    def validate_copernicus_credentials(self) -> "Settings":
        """Warn if real mode is requested but credentials are missing."""
        if not self.demo_mode and (
            not self.copernicus_username or not self.copernicus_password
        ):
            import warnings
            warnings.warn(
                "DEMO_MODE=false but Copernicus credentials are not set. "
                "Satellite ingestion will fail. Set DEMO_MODE=true or provide credentials.",
                RuntimeWarning,
                stacklevel=2,
            )
        return self

    @property
    def copernicus_available(self) -> bool:
        """True if Copernicus credentials are configured."""
        return bool(self.copernicus_username and self.copernicus_password)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached application settings singleton."""
    return Settings()
