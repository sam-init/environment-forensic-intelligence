# Scientific and Technical Limitations

## IMPORTANT

This system provides **remote-sensing intelligence** and is **NOT legally authoritative**.  
All outputs require human expert verification before any regulatory or legal action.

---

## Satellite Data Limitations

### Sentinel-2 Resolution
- Sentinel-2 provides **10 m** resolution for visible and NIR bands (B2, B3, B4, B8).
- SWIR bands (B11, B12) are at **20 m** resolution, resampled to 10 m in the pipeline.
- At 10 m resolution:
  - Individual small vehicles or hand-tool operations are **not individually resolvable**
  - Small extraction footprints below ~100 m² may be missed
  - Boundary precision is limited to approximately ±10 m

### Cloud Cover
- Karnataka experiences **heavy monsoon cloud cover from June to September**
- During monsoon, Sentinel-2 optical data may be unavailable for weeks
- Cloud masking is imperfect — thin cirrus and cloud shadow can generate false positives
- SAR (Sentinel-1) is cloud-independent but has different characteristics

### Temporal Gaps
- Sentinel-2 revisit over any Indian site is approximately **5 days** under clear conditions
- In practice, useful clear-sky observations may occur every 10–30 days during monsoon
- Rapid extraction events in cloudy periods may go undetected between observations

### Radiometric Limitations
- Sentinel-2 L2A (surface reflectance) corrects for atmosphere but corrections are imperfect over complex terrain
- Sen2Cor atmospheric correction may have errors over bright bare soil or water bodies
- BRDF effects (sun-angle variations) can affect temporal comparisons

---

## Model Limitations

### Probabilistic Output
- All model outputs are **probability estimates**, not ground truth labels
- Probability calibration has not been independently validated for Indian conditions
- Confidence scores are indicative only

### No Pre-trained Mining Labels for India
- No freely available, validated national-scale dataset exists for:
  - Illegal sand mining in Indian rivers
  - Illegal quarrying at 10 m resolution
  - Illegal dumping sites
- The baseline threshold model was not trained on India-specific ground truth
- ML models (U-Net etc.) require labelled training data before deployment

### Class Ambiguity
- The following natural processes can RESEMBLE mining disturbances:
  - River bank erosion
  - Seasonal river channel migration (especially in braided rivers)
  - Agricultural field preparation (plowing, burning)
  - Post-harvest bare soil
  - Forest fire clearings
  - Road and construction work
  - Legal mining operations
  - Flooding and sediment deposition

### False Positives
The system is designed to flag suspicious changes for human review, not to make definitive determinations.  
False positives are expected and normal. Human analyst review is mandatory.

---

## Geospatial Limitations

### Mining Lease Data
- **No single authoritative national dataset of all Indian mining leases is freely available** at the time of writing.
- District-level or state-level lease data may be available from individual state governments.
- When lease data is absent, the system shows "Regulatory boundary unavailable" — it does **not** assume activity is illegal.

### OSM Completeness
- OpenStreetMap river and road data for rural India is **incomplete**.
- Distance-to-river calculations depend on OSM or other vector river data quality.
- Some rivers, especially smaller tributaries and seasonal streams, may be missing.

### Protected Area Boundaries
- Protected area boundaries are sourced from open datasets (WDPA, Bhuvan) which may be outdated or incomplete.
- Buffer zone regulations vary by state and require legal consultation.

---

## System Architecture Limitations

### Phase 1 Coverage
- This is a Phase 1 system designed for 1–3 monitoring sites.
- Large-scale national monitoring requires cloud infrastructure scaling (Phase 4+).

### Deduplication
- Event deduplication uses spatial overlap + temporal proximity heuristics.
- Complex scenarios (split disturbance, merged river channels) may require manual correction.

### Report Reliability
- Reports are generated from the analysis pipeline; their accuracy depends on input data quality.
- Low data quality observations are flagged but not automatically excluded.

---

## Legal Disclaimer

> This system provides remote-sensing intelligence to support environmental monitoring.  
> It does **not** constitute a legal determination of unauthorized or illegal activity.  
> Only competent legal authorities, with admissible evidence and appropriate due process, can make legal determinations regarding mining legality.  
> Remote sensing alone is not sufficient to establish legal liability.

---

*Last updated: 2026-08-20*  
*EFI Platform v0.1.0*
