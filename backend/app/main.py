"""
EFI Backend — FastAPI Application Entry Point

Environmental Forensic Intelligence Platform
Target geography: India (Karnataka primary demo site)
Architecture: Extensible to other geographies.
"""
from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

import structlog
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.api.v1 import api_router
from app.api.v1.system import router as system_router
from app.core.config import get_settings
from app.core.logging import configure_logging

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown."""
    configure_logging()
    settings = get_settings()

    logger.info(
        "Environmental Forensic Intelligence starting",
        version="0.1.0",
        env=settings.app_env,
        demo_mode=settings.demo_mode,
        copernicus_available=settings.copernicus_available,
    )

    if settings.demo_mode:
        logger.info(
            "DEMO MODE active — satellite ingestion uses synthetic data. "
            "Set DEMO_MODE=false and configure Copernicus credentials for real data."
        )

    yield

    logger.info("Environmental Forensic Intelligence shutting down")


settings = get_settings()

app = FastAPI(
    title="Environmental Forensic Intelligence API",
    description=(
        "Environmental monitoring and forensic intelligence platform for detecting "
        "sand mining, land mining, and land filling in India using satellite data.\n\n"
        "**DISCLAIMER**: This system provides remote-sensing intelligence and does not "
        "itself constitute a legal determination of unauthorized or illegal activity. "
        "All outputs require human verification and expert review before any regulatory action."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request ID + Timing Middleware ─────────────────────────────────────────────
@app.middleware("http")
async def request_context_middleware(request: Request, call_next) -> Response:
    """Add request ID and timing to every request."""
    request_id = str(uuid.uuid4())[:8]
    start_time = time.perf_counter()

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )

    response = await call_next(request)
    duration_ms = (time.perf_counter() - start_time) * 1000

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"

    logger.info(
        "request completed",
        status_code=response.status_code,
        duration_ms=round(duration_ms, 1),
    )
    return response


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(api_router)
app.include_router(system_router)


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {
        "service": "Environmental Forensic Intelligence API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
        "ready": "/ready",
        "demo_mode": settings.demo_mode,
        "disclaimer": (
            "This system provides remote-sensing intelligence and does not itself "
            "constitute a legal determination of unauthorized or illegal activity."
        ),
    }


# ── Global Error Handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> ORJSONResponse:
    """
    Catch-all error handler.
    Returns a structured error response without exposing internal details.
    Technical details are logged; users see a safe message.
    """
    logger.exception("Unhandled exception", exc_info=exc)
    return ORJSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "detail": (
                "An unexpected error occurred. "
                "Please try again later or contact support."
            ),
            "request_id": request.headers.get("X-Request-ID"),
        },
    )
