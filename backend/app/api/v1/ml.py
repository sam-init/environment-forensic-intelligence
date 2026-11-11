"""
ML Endpoints for Siamese Neural Network Land Change Detection.
Processes image pairs (e.g. from MapLibre canvas snapshots or uploaded files).
"""
from __future__ import annotations

import base64
import io
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from PIL import Image

from app.ml.predict import ChangeDetectorInference, DEFAULT_MODEL_PATH

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

# Singleton inference engine
_detector_instance: Optional[ChangeDetectorInference] = None


def get_detector() -> ChangeDetectorInference:
    global _detector_instance
    if _detector_instance is None:
        if not DEFAULT_MODEL_PATH.exists():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Model weights not found at {DEFAULT_MODEL_PATH}. Train the model first.",
            )
        try:
            _detector_instance = ChangeDetectorInference(model_path=DEFAULT_MODEL_PATH)
            logger.info("Loaded Siamese ResNet-18 model with structural calibration into memory.")
        except Exception as exc:
            logger.error("Failed to load Siamese model: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error initializing ML change detection model: {exc}",
            )
    return _detector_instance


class PredictPairRequest(BaseModel):
    before_image: str = Field(..., description="Base64 encoded Before image or data URL")
    after_image: str = Field(..., description="Base64 encoded After image or data URL")
    tile_id: Optional[str] = Field(None, description="Optional 1x1 km tile ID")
    threshold: float = Field(0.50, ge=0.1, le=0.9, description="Decision threshold for change")


class PredictPairResponse(BaseModel):
    is_changed: bool
    label: str
    change_probability: float
    unchanged_probability: float
    confidence: float
    severity: str
    tile_id: Optional[str] = None
    raw_probability: Optional[float] = None
    edge_correlation: Optional[float] = None
    deep_similarity: Optional[float] = None
    analysis_note: Optional[str] = None


def _decode_base64_image(b64_str: str) -> Image.Image:
    try:
        # Strip data URL prefix if present (e.g. 'data:image/png;base64,...')
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        data = base64.b64decode(b64_str)
        return Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 image data: {exc}",
        )


@router.post("/predict-pair", response_model=PredictPairResponse)
async def predict_pair(payload: PredictPairRequest) -> PredictPairResponse:
    """
    Run Siamese ResNet-18 inference on a paired Before & After image snapshot.
    Returns calibrated change probability, structural metrics, label, and risk severity.
    """
    detector = get_detector()
    img_before = _decode_base64_image(payload.before_image)
    img_after = _decode_base64_image(payload.after_image)

    result = detector.predict(img_before, img_after, threshold=payload.threshold)
    result["tile_id"] = payload.tile_id
    return PredictPairResponse(**result)
