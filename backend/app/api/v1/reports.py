"""
Forensic Report Generation API Router.
Compiles satellite change detection evidence, Siamese ResNet-18 metrics,
and NVIDIA NIM (meta/llama-3.2-90b-vision-instruct) AI vision assessment
into an official Environmental Forensic Field Report ready for PDF download.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.nvidia_nim import analyze_environmental_change

router = APIRouter(prefix="/reports", tags=["Forensic Reports"])


class ReportGenerateRequest(BaseModel):
    site_name: str = Field(..., description="Name of the monitored site")
    area_name: str = Field("Belagavi District, Karnataka", description="Area / Taluk / Village name")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    before_image: Optional[str] = Field(None, description="Base64 encoded Before satellite snapshot")
    after_image: str = Field(..., description="Base64 encoded After satellite snapshot")
    before_date: str = Field("2020-02-15", description="Baseline imagery date")
    after_date: str = Field(..., description="Detection imagery date")
    duration_str: Optional[str] = Field(None, description="Timeline span (e.g. 'Active across 4 years')")
    change_probability: float = Field(..., description="Calibrated change probability (0.0 to 1.0)")
    severity: str = Field("HIGH", description="CRITICAL, HIGH, MODERATE, NONE")
    change_type: str = Field("Unregulated Ground Excavation / Sand Extraction", description="Type of disturbance")
    edge_correlation: Optional[float] = None
    deep_similarity: Optional[float] = None
    complaint_id: Optional[str] = None


class ReportResponse(BaseModel):
    report_id: str
    generated_at: str
    site_name: str
    area_name: str
    latitude: float
    longitude: float
    coordinates_formatted: str
    before_date: str
    after_date: str
    timeline_duration: str
    change_probability: float
    severity: str
    change_type: str
    deep_architecture: str
    edge_correlation: Optional[float]
    deep_similarity: Optional[float]
    ai_vision_analysis: str
    ai_model_used: str
    complaint_id: Optional[str]
    target_authority: str
    recommended_field_actions: list[str]
    before_image: Optional[str] = None
    after_image: str


@router.post("/generate", response_model=ReportResponse)
async def generate_forensic_report(payload: ReportGenerateRequest) -> ReportResponse:
    """
    Generate an environmental forensic report for a monitored site,
    evaluating high-res satellite snapshots via NVIDIA NIM Vision AI.
    """
    report_num = f"EFI-REP-{datetime.utcnow().strftime('%Y%m')}-{uuid.uuid4().hex[:5].upper()}"
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    coords_fmt = f"{payload.latitude:.5f}° N, {payload.longitude:.5f}° E"

    # Compute timeline duration if not passed
    duration = payload.duration_str
    if not duration:
        duration = f"Monitored period: {payload.before_date} to {payload.after_date}"

    # Call NVIDIA NIM meta/llama-3.2-90b-vision-instruct
    nim_result = analyze_environmental_change(
        before_b64=payload.before_image,
        after_b64=payload.after_image,
        site_name=payload.site_name,
        coords={"latitude": payload.latitude, "longitude": payload.longitude},
        area_name=payload.area_name,
        severity=payload.severity,
        change_type=payload.change_type,
        duration_str=duration,
    )

    ai_narrative = nim_result.get("analysis", "")
    ai_model = nim_result.get("model", "meta/llama-3.2-90b-vision-instruct")

    actions = [
        "Deploy District Flying Squad to coordinates for GPS ground-truth verification.",
        "Check district mining registry for valid quarry / sand mining transit permit (e-Pass).",
        "Perform UAV/drone volumetric measurement of displaced earth and excavated pits.",
        "Issue statutory Notice under Rule 31R of Karnataka Minor Mineral Concession Rules.",
        "Notify Karnataka State Pollution Control Board (KSPCB) for watercourse siltation review.",
    ]

    return ReportResponse(
        report_id=report_num,
        generated_at=now_str,
        site_name=payload.site_name,
        area_name=payload.area_name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        coordinates_formatted=coords_fmt,
        before_date=payload.before_date,
        after_date=payload.after_date,
        timeline_duration=duration,
        change_probability=round(payload.change_probability, 4),
        severity=payload.severity,
        change_type=payload.change_type,
        deep_architecture="Siamese ResNet-18 (512-d Differencing + Sobel Structural Invariance)",
        edge_correlation=payload.edge_correlation,
        deep_similarity=payload.deep_similarity,
        ai_vision_analysis=ai_narrative,
        ai_model_used=ai_model,
        complaint_id=payload.complaint_id or f"KSPCB-BLG-2026-{uuid.uuid4().hex[:4].upper()}",
        target_authority="Karnataka State Pollution Control Board & Department of Mines & Geology, Belagavi",
        recommended_field_actions=actions,
        before_image=payload.before_image,
        after_image=payload.after_image,
    )
