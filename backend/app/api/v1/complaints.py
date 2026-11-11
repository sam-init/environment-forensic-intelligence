"""
Statutory Complaints & Field Physical Inspection Router.
Directs formal inspection requests to Karnataka State Pollution Control Board (KSPCB),
Department of Mines & Geology (DMG), and Belagavi District Administration.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.site_store import add_complaint, load_complaints

router = APIRouter(prefix="/complaints", tags=["Complaints & Field Inspections"])


class ComplaintCreate(BaseModel):
    site_id: Optional[str] = None
    site_name: str = Field(..., description="Name of the monitored site")
    area_name: str = Field("Belagavi District, Karnataka", description="Taluk / Village / District")
    latitude: float
    longitude: float
    target_authority: str = Field(
        "Karnataka State Pollution Control Board (KSPCB) Regional Office & District Mines Department, Belagavi",
        description="Statutory enforcement authority",
    )
    change_type: str = Field(..., description="Type of detected land disruption")
    severity: str = Field("HIGH", description="CRITICAL, HIGH, MODERATE, LOW")
    urgency: str = Field("Urgent (Within 72 Hours)", description="Inspection urgency")
    statutory_violation: Optional[str] = (
        "Karnataka Minor Mineral Concession Rules 1994 (Rule 31R) & Environment (Protection) Act 1986"
    )
    summary: str = Field(..., description="Evidence summary and reason for physical inspection")
    officer_notes: Optional[str] = None


class ComplaintResponse(BaseModel):
    id: str
    site_id: Optional[str] = None
    site_name: str
    area_name: str
    latitude: float
    longitude: float
    target_authority: str
    change_type: str
    severity: str
    status: str
    urgency: str
    statutory_violation: str
    summary: str
    officer_notes: Optional[str] = ""
    created_at: str


@router.get("", response_model=List[ComplaintResponse])
async def list_all_complaints() -> List[ComplaintResponse]:
    """List all filed field inspection requests and complaints."""
    data = load_complaints()
    return [ComplaintResponse(**c) for c in data]


@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
async def file_inspection_complaint(payload: ComplaintCreate) -> ComplaintResponse:
    """
    File a formal complaint requesting physical on-site inspection
    by the district mining officer and KSPCB.
    """
    created = add_complaint(payload.model_dump())
    return ComplaintResponse(**created)


@router.get("/{complaint_id}", response_model=ComplaintResponse)
async def get_complaint_details(complaint_id: str) -> ComplaintResponse:
    """Retrieve details and status of a specific complaint by reference ID."""
    data = load_complaints()
    match = next((c for c in data if c["id"] == complaint_id), None)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint '{complaint_id}' not found.",
        )
    return ComplaintResponse(**match)
