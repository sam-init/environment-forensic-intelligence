# Model Card — Environmental Forensic Intelligence Detection Engines

> Model specifications, intended use, limitations, and evaluation procedures for the detection algorithms powering the EFI Platform.

---

## Model Details

- **Model Name**: EFI Baseline Change Detection & Explainable Risk Scoring Engine
- **Model Version**: `v0.1.0-baseline`
- **Model Type**: Rule-based Spectral Index Thresholding + Multi-criteria Explainable Risk Scoring
- **Target Geography**: India (Karnataka primary calibration zone)
- **Developer**: EFI Architecture & Geospatial ML Team
- **Date**: August 2026

---

## Intended Use

### Primary Intended Uses
- Automated screening of satellite imagery over designated monitoring sites (AOIs) to detect land-use land-cover changes.
- Prioritization of suspected environmental disturbance sites (sand extraction, open-pit land excavation, unauthorized land filling) for human expert field review.
- Temporal reconstruction of land change progression across consecutive clear-sky satellite acquisitions.

### Out-of-Scope / Prohibited Uses
- **Legal Determination**: Using model scores as sole or primary evidence in legal or enforcement proceedings without ground-truth verification.
- **Automated Penalties**: Automated issuance of fines, stop-work orders, or legal notices based on raw model outputs.
- **Micro-Scale Vehicle Detection**: Attempting to identify individual trucks, excavators, or small hand-tool operations (<10 m scale).

---

## Input & Output Data

### Inputs
1. **Sentinel-2 L2A Bands**:
   - `B02` (Blue), `B03` (Green), `B04` (Red), `B08` (NIR), `B11` (SWIR-1)
2. **Derived Indices**:
   - $\text{NDVI} = \frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}$
   - $\text{NDWI} = \frac{\text{Green} - \text{NIR}}{\text{Green} + \text{NIR}}$
   - $\text{BSI} = \frac{(\text{SWIR1} + \text{Red}) - (\text{NIR} + \text{Blue})}{(\text{SWIR1} + \text{Red}) + (\text{NIR} + \text{Blue})}$
3. **Geospatial Vectors**:
   - Distance to nearest river channel (m)
   - Distance to nearest mapped road (m)
   - Distance to protected area boundary (m)
   - Mining lease boundary intersection (Boolean / Null)

### Outputs
- **Event Category**: `potential_sand_mining`, `potential_land_excavation`, `potential_land_filling`, `vegetation_loss`, `water_body_alteration`, `general_disturbance`
- **Risk Score**: $0 \text{ to } 100$ integer
- **Risk Level**: `CRITICAL` ($\ge 75$), `HIGH` ($50\text{--}74$), `MODERATE` ($25\text{--}49$), `LOW` ($< 25$)
- **Confidence Score**: $0.00 \text{ to } 1.00$
- **Human-Readable Explanation**: Structured natural-language points detailing the contributing factors to the score.

---

## Risk Scoring Formula

The Risk Score ($R$) is calculated as an explainable weighted sum:

$$R = \min\left(100, \sum_{i=1}^{k} w_i \cdot c_i \cdot 100\right)$$

Where:
- $w_i$ = Component weight (configured in `configs/risk_weights.json`)
- $c_i \in [0, 1]$ = Normalized score for factor $i$

### Weight Distribution (`configs/risk_weights.json`)
- **Change Magnitude ($20\%$)**: Extent of area changed and spectral index delta ($\Delta\text{NDVI}$, $\Delta\text{BSI}$).
- **Temporal Persistence ($20\%$)**: Number of consecutive observations confirming the change.
- **Model Confidence ($15\%$)**: Cloud-free pixel quality and spectral signal purity.
- **SAR Corroboration ($15\%$)**: Independent backscatter change in Sentinel-1 SAR.
- **Environmental Proximity ($15\%$ total)**:
  - $< 100\text{ m}$ from river: $+10$ points
  - $< 500\text{ m}$ from river: $+5$ points
  - $< 500\text{ m}$ from protected area: $+5$ points
- **Regulatory Context ($15\%$)**: Disturbance located outside known valid mining lease boundaries. If lease data is unavailable, this weight is dynamically reallocated to reduce bias.

---

## Performance & Limitations

### Strengths
- **Fully Explainable**: Every risk score can be decomposed into human-understandable contributing factors.
- **Deterministically Audit-able**: Results can be re-run on identical input bands with identical configuration to produce identical outputs.
- **Extensible**: New index components (e.g., thermal, texture) can be added via configuration without changing core API code.

### Known Failure Modes
1. **Seasonal Agriculture**: Plowing of agricultural fields causes sudden drop in NDVI and rise in BSI, which can mimic excavation.
2. **Monsoon Cloud Artifacts**: Partial cloud shadows can depress NIR values, leading to localized NDVI drops.
3. **River Sandbar Dynamics**: Natural movement of sandbars during monsoon high-flow periods can be flagged as sand extraction.

---

## Ethics & Human-in-the-Loop Safeguards

1. **Mandatory Disclaimer**: All API responses and UI screens include a explicit disclaimer stating that outputs require expert verification.
2. **Review Status Workflow**: Events must transition through `unreviewed` → `under_review` → `confirmed_disturbance` / `false_positive` by a human analyst before any external communication.
3. **No Automatic Penalties**: System design prohibits automated downstream enforcement triggers.

---

*Model Card — EFI Platform v0.1.0-baseline*
