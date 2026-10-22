"""
ARQ Worker settings for background jobs.
"""
from __future__ import annotations

from app.core.config import get_settings


class WorkerSettings:
    """ARQ worker configuration."""

    from app.workers.change_tiles import process_change_tile_job
    functions = [process_change_tile_job]
    max_tries = 3

    @classmethod
    def on_startup(cls, ctx: dict) -> None:
        """Initialize resources when worker starts."""
        from app.core.logging import configure_logging
        configure_logging()

    @classmethod
    def on_shutdown(cls, ctx: dict) -> None:
        """Clean up resources when worker shuts down."""
        pass

    @property
    def redis_settings(self):
        from arq.connections import RedisSettings
        settings = get_settings()
        return RedisSettings.from_dsn(settings.redis_url)

    max_jobs = 10
    job_timeout = 3600  # 1 hour max per job
    keep_result = 86400  # Keep results for 24h
    retry_jobs = True
    max_tries = 3
