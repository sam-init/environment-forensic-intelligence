"""
EFI Backend — Database Setup
Async SQLAlchemy engine + session factory + PostGIS support.
Includes graceful fallback for DEMO_MODE when PostgreSQL container is offline.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
import time
from typing import Any

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

_db_online: bool | None = None
_last_db_check: float = 0.0
DB_RECHECK_INTERVAL = 30.0  # seconds


def _get_engine_kwargs() -> dict[str, Any]:
    settings = get_settings()
    kwargs: dict[str, Any] = {
        "echo": False,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
        "pool_recycle": 3600,
        "connect_args": {
            "timeout": 1.5,
            "command_timeout": 3.0,
        },
    }
    return kwargs


def create_engine():
    settings = get_settings()
    return create_async_engine(settings.database_url, **_get_engine_kwargs())


engine = create_engine()

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """
    SQLAlchemy declarative base.
    All ORM models inherit from this class.
    """
    pass


async def get_db() -> AsyncGenerator[AsyncSession | None, None]:
    """
    FastAPI dependency: yield a database session.
    If database is unreachable (e.g. Postgres container offline), yields None in DEMO_MODE
    without waiting for slow connection timeouts.
    """
    global _db_online, _last_db_check
    now = time.time()

    # Fast-path: if recently detected as offline, yield None immediately (<0.01ms)
    if _db_online is False and (now - _last_db_check) < DB_RECHECK_INTERVAL:
        yield None
        return

    try:
        async with AsyncSessionLocal() as session:
            try:
                # Fast connection verification
                await session.execute(text("SELECT 1"))
                _db_online = True
                _last_db_check = now
            except Exception:
                _db_online = False
                _last_db_check = now
                yield None
                return

            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    except Exception:
        _db_online = False
        _last_db_check = now
        yield None


async def check_database_connection() -> bool:
    """Health check: verify database connectivity."""
    global _db_online, _last_db_check
    now = time.time()
    if _db_online is False and (now - _last_db_check) < DB_RECHECK_INTERVAL:
        return False
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        _db_online = True
        _last_db_check = now
        return True
    except Exception:
        _db_online = False
        _last_db_check = now
        return False


async def check_postgis_available() -> bool:
    """Readiness check: verify PostGIS extension is active."""
    global _db_online
    if _db_online is False:
        return False
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT PostGIS_version()"))
            return result.scalar() is not None
    except Exception:
        return False
