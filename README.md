# Environmental Forensic Intelligence (EFI)

> **India Earth Observation Monitoring — Sand Mining, Land Mining & Land Filling Detection**

A production-quality research prototype for detecting potential sand mining, land excavation, and land filling using free satellite data (Sentinel-2, Sentinel-1, Landsat). Built for India with **Belagavi district, Karnataka** as the primary demonstration geography. Belagavi is subdivided into a fixed **1 km × 1 km grid**; each cell is an independent review unit for imagery and model inspection.

---

## ⚠️ Important Disclaimers

- This system provides **remote-sensing intelligence** and does **not** constitute a legal determination of unauthorized or illegal activity.
- All detected events require **human expert verification** before any regulatory action.
- The system uses probabilistic language: "Potential sand extraction", "Suspicious environmental disturbance", "High-risk disturbance" — NOT "illegal mining".
- Demo mode ships with **synthetic Belagavi data** that does NOT represent real environmental incidents.

---

## Architecture Overview

```
Frontend (React/Vite/MapLibre)
         ↓ REST API
Backend (FastAPI/Python)
    ├── PostgreSQL + PostGIS (spatial data)
    ├── Redis (job queue + cache)
    └── ARQ Worker (background processing)
         ├── Ingestion (Sentinel-2 STAC, Sentinel-1, Landsat)
         ├── Preprocessing (cloud mask, NDVI/NDWI/BSI)
         ├── Change Detection (threshold → ML)
         └── Risk Engine (explainable weighted score)
```

## Quick Start

### Prerequisites
- Docker + Docker Compose v5
- 4 GB RAM minimum

### 1. Clone and configure

```bash
git clone <repo>
cd environment-forensic-intelligence
cp .env.example .env
# Edit .env if needed (defaults work for demo mode)
```

### 2. Start all services

```bash
docker compose up
```

This starts:
- `db` — PostgreSQL 16 + PostGIS 3.4 (port 5432)
- `redis` — Redis 7 (port 6379)
- `backend` — FastAPI (port 8000)
- `worker` — ARQ background worker
- `frontend` — React + Vite (port 5173)

### 3. Seed demo data

```bash
curl -X POST http://localhost:8000/api/v1/demo/seed
```

Or open `http://localhost:5173` — demo data auto-seeds on first load.

### 4. Open the dashboard

```
http://localhost:5173
```

---

## Services & Ports

| Service | Port | URL |
|---|---|---|
| Frontend | 5173 | http://localhost:5173 |
| Backend API | 8000 | http://localhost:8000 |
| API Docs | 8000 | http://localhost:8000/docs |
| Health | 8000 | http://localhost:8000/health |
| Readiness | 8000 | http://localhost:8000/ready |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |

---

## Local Development (Without Docker)

### Backend

```bash
cd backend
pip install -e ".[dev]"
# Start PostgreSQL + Redis (e.g., via Docker)
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

See [.env.example](.env.example) for all variables with documentation.

Key variables:

| Variable | Description | Default |
|---|---|---|
| `DEMO_MODE` | Use synthetic demo data | `true` |
| `DATABASE_URL` | PostgreSQL connection string | set in compose |
| `REDIS_URL` | Redis connection string | set in compose |
| `COPERNICUS_USERNAME` | Copernicus Data Space username | (empty → demo mode) |
| `COPERNICUS_PASSWORD` | Copernicus Data Space password | (empty → demo mode) |

---

## Real Satellite Data (Sentinel-2)

To use real Sentinel-2 data:

1. Register free at [dataspace.copernicus.eu](https://dataspace.copernicus.eu)
2. Set `DEMO_MODE=false` in `.env`
3. Set `COPERNICUS_USERNAME` and `COPERNICUS_PASSWORD`
4. Restart the backend and worker

---

## Data Sources

See [DATA_SOURCES.md](DATA_SOURCES.md) for the full registry of all data sources, licenses, and usage rights.

Primary sources:
- **Sentinel-2 L2A** — Copernicus Data Space (free, [Copernicus Open Access Policy](https://sentinels.copernicus.eu/web/sentinel/terms-conditions))
- **Sentinel-1 GRD** — Copernicus Data Space (free)
- **Landsat** — USGS EarthExplorer (free, public domain)
- **OpenStreetMap** — [ODbL License](https://opendatacommons.org/licenses/odbl/)

---

## API Documentation

Interactive API docs: `http://localhost:8000/docs`

Key endpoints:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/sites` | List monitoring sites |
| POST | `/api/v1/sites` | Create monitoring site |
| GET | `/api/v1/events` | List forensic events |
| GET | `/api/v1/events/{id}` | Get event detail |
| POST | `/api/v1/events/{id}/review` | Submit analyst review |
| GET | `/api/v1/observations` | List satellite observations |
| POST | `/api/v1/change-detection/tiles/generate` | Build the Belagavi 1 km grid from GEE |
| GET | `/api/v1/change-detection/tiles` | List stored grid cells as GeoJSON |
| POST | `/api/v1/change-detection/tiles/{tile_id}/prototype` | Process one cell |
| GET | `/health` | Liveness check |
| GET | `/ready` | Readiness check (verifies DB + PostGIS + Redis) |
| POST | `/api/v1/demo/seed` | Seed demo data (demo mode only) |

---

## Project Structure

```
environment-forensic-intelligence/
├── backend/          # FastAPI + Python backend
├── frontend/         # React + TypeScript + Vite + MapLibre
├── geospatial/       # NDVI, NDWI, BSI, change detection
├── ingestion/        # Satellite provider adapters
├── ml/               # Model registry, training, inference
├── jobs/             # Background job definitions
├── configs/          # Risk weights, preprocessing config
├── docker/           # Dockerfiles + DB init
├── docs/             # Additional documentation
├── data/             # Local data storage (gitignored)
├── docker-compose.yml
├── .env.example
├── README.md
├── DATA_SOURCES.md
├── LIMITATIONS.md
└── MODEL_CARD.md
```

---

## Known Limitations

See [LIMITATIONS.md](LIMITATIONS.md) for the full scientific and technical limitations.

Key limitations:
- Sentinel-2 is 10 m resolution — small vehicles/equipment not individually resolvable
- Cloud cover may create temporal gaps (monsoon season in Karnataka: June–September)
- Natural processes (erosion, flooding, agriculture) can resemble mining
- Regulatory datasets (mining lease polygons) are incomplete for India
- ML models are probabilistic — not legally authoritative

---

## Testing

```bash
# Backend unit tests
cd backend && python -m pytest tests/ -v

# Frontend
cd frontend && npm run test
cd frontend && npm run type-check

# Lint
cd backend && ruff check .
```

---

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Scaffold + DB + Docker + Frontend + Backend | ✅ Complete |
| 2 | AOI Management + PostGIS + Map | 🔄 In progress |
| 3 | Sentinel-2 STAC Ingestion | 📋 Planned |
| 4 | Preprocessing + Indices | 📋 Planned |
| 5–14 | ... | 📋 Planned |

---

## License

This project is for research and demonstration purposes.

Third-party data sources each have their own licenses — see [DATA_SOURCES.md](DATA_SOURCES.md).

---

*Environmental Forensic Intelligence Platform — v0.1.0*
