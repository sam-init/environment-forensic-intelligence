# ================================================================
# Backend Dockerfile
# Python 3.13 + GDAL + rasterio + geospatial stack
# ================================================================
FROM python:3.13-slim-bookworm

LABEL maintainer="Environmental Forensic Intelligence"
LABEL description="EFI Backend — FastAPI + geospatial pipeline"

# System dependencies: GDAL, GEOS, PROJ, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    proj-bin \
    proj-data \
    libspatialindex-dev \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -e ".[dev]"

COPY . .

# Create data directories
RUN mkdir -p /app/data/raw /app/data/processed /app/data/demo /app/data/models

EXPOSE 8000
