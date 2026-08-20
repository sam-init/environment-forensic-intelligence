# Data Sources Registry

This document lists all satellite imagery, vector, and geospatial datasets used by the **Environmental Forensic Intelligence (EFI)** platform, including provider details, resolution, license, terms of use, and access methods.

---

## 1. Earth Observation Satellite Datasets

### Sentinel-2 MSI (Multispectral Instrument)
- **Provider**: European Space Agency (ESA) / European Commission (Copernicus Program)
- **Access API**: Copernicus Data Space Ecosystem (CDSE) STAC / OData API
- **URL**: [dataspace.copernicus.eu](https://dataspace.copernicus.eu/)
- **Product Type**: Sentinel-2 Level-2A (Bottom-of-Atmosphere Surface Reflectance)
- **Spatial Resolution**:
  - 10 m: B2 (Blue), B3 (Green), B4 (Red), B8 (NIR)
  - 20 m: B5, B6, B7 (Red Edge), B8A (Narrow NIR), B11 (SWIR-1), B12 (SWIR-2)
  - 60 m: B1 (Coastal Aerosol), B9 (Water Vapor)
- **Temporal Resolution**: ~5 days revisit (with 2A + 2B combined)
- **Spectral Bands Used in EFI**:
  - `B02` (Blue, 490 nm) — Bare Soil Index
  - `B03` (Green, 560 nm) — NDWI
  - `B04` (Red, 665 nm) — NDVI, BSI
  - `B08` (NIR, 842 nm) — NDVI, NDWI, BSI
  - `B11` (SWIR-1, 1610 nm) — BSI, moisture content
  - `B12` (SWIR-2, 2190 nm) — Geology, excavation signal
- **License / Terms**: Open access under the [Copernicus Sentinel Data Policy](https://sentinels.copernicus.eu/web/sentinel/terms-conditions). Free for commercial and non-commercial use with proper attribution.
- **Attribution**: *"Contains modified Copernicus Sentinel data [year]"*

### Sentinel-1 C-SAR (Synthetic Aperture Radar)
- **Provider**: European Space Agency (ESA) / Copernicus Program
- **Access API**: Copernicus Data Space Ecosystem (CDSE)
- **Product Type**: Level-1 Ground Range Detected (GRD) — High Resolution (IW mode)
- **Polarization**: VV (Vertical-Vertical) and VH (Vertical-Horizontal)
- **Spatial Resolution**: 10 m pixel spacing (20 m spatial resolution)
- **Wavelength**: C-band (5.54 cm wavelength) — Cloud-independent
- **Revisit Time**: ~12 days over India
- **Relevance to EFI**: Surface roughness changes, pit excavation detection, water surface backscatter change during optical cloud cover.
- **License / Terms**: Open access under Copernicus Sentinel Data Policy.

### Landsat 8 / 9 OLI & TIRS
- **Provider**: U.S. Geological Survey (USGS) / NASA
- **Access API**: USGS M2M API / STAC (Element84 / AWS Earth)
- **Product Type**: Collection 2 Level-2 Surface Reflectance
- **Spatial Resolution**: 30 m multispectral, 15 m panchromatic
- **Revisit Time**: 8 days (combined Landsat 8 + 9)
- **Relevance to EFI**: Long-term historical baseline verification (2013–present).
- **License / Terms**: U.S. Government Public Domain — unrestricted free access.

---

## 2. Contextual & Regulatory Datasets

### OpenStreetMap (OSM)
- **Provider**: OpenStreetMap Contributors
- **Access API**: Overpass API / Geofabrik extracts
- **Layers Used**:
  - Waterways (`waterway=river`, `waterway=stream`, `natural=water`)
  - Transport networks (`highway=primary`, `highway=secondary`, `highway=track`)
  - Settlements (`landuse=residential`, `place=village`, `place=town`)
- **License**: Open Database License (ODbL) 1.0.
- **Attribution**: *"© OpenStreetMap contributors"*

### World Database on Protected Areas (WDPA)
- **Provider**: UNEP-WCMC & IUCN
- **URL**: [protectedplanet.net](https://www.protectedplanet.net/)
- **Data Format**: Vector boundaries (Shapefile / GeoJSON)
- **Relevance to EFI**: Distance to protected forests, wildlife sanctuaries, national parks in India.
- **License**: Non-commercial use policy (free for research and government monitoring).

### Indian Mining Lease Boundaries (State/District Specific)
- **Provider**: State Departments of Mines & Geology (where publicly available) / Ministry of Mines (Bhuvan Portal)
- **URL**: [bhuvan.nrsc.gov.in](https://bhuvan.nrsc.gov.in/)
- **Availability Status**: **Incomplete / Non-uniform**.
- **System Behavior When Missing**: Flagged as `lease_data_available = false` in the API and UI. System does NOT assume unauthorized activity in the absence of lease polygons.

---

## 3. Demo / Synthetic Datasets

### Karnataka Synthetic Demo Dataset
- **Scope**: Synthetic monitoring sites in Ballari, Mandya, and Hospet (Tungabhadra River)
- **Flag**: `is_demo = true`
- **Purpose**: UI demonstration and integration testing without requiring Copernicus API credentials.
- **Disclaimer**: Synthetic records for demonstration only. Not actual detected incidents.

---

*Data Sources Registry — EFI Platform v0.1.0*
