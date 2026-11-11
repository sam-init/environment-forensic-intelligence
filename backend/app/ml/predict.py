"""
Inference helper for Siamese ResNet-18 Land Change Detector.
Predicts change status, calibrated probability, and structural consistency between any two images.
Integrates Sobel gradient cross-correlation and ResNet deep feature invariance to distinguish
real physical ground disturbances (excavations, construction, clearing) from natural seasonal
and lighting variations.
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict, Any, Union

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
import torchvision.transforms.functional as TF
from torchvision import transforms

from app.ml.model import SiameseResNet18


DEFAULT_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "siamese_resnet18_best.pt"


class ChangeDetectorInference:
    def __init__(self, model_path: Union[str, Path] = DEFAULT_MODEL_PATH, device: str | None = None):
        self.device = torch.device(device if device else ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = SiameseResNet18(pretrained=False).to(self.device)

        ckpt = torch.load(model_path, map_location=self.device)
        state_dict = ckpt["model_state_dict"] if "model_state_dict" in ckpt else ckpt
        self.model.load_state_dict(state_dict)
        self.model.eval()

        self.img_size = ckpt.get("img_size", 224) if isinstance(ckpt, dict) else 224
        self.normalize = transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        )

        # Sobel convolution filters for edge structure correlation
        self.kx = torch.tensor(
            [[-1.0, 0.0, 1.0], [-2.0, 0.0, 2.0], [-1.0, 0.0, 1.0]],
            device=self.device,
        ).view(1, 1, 3, 3)
        self.ky = torch.tensor(
            [[-1.0, -2.0, -1.0], [0.0, 0.0, 0.0], [1.0, 2.0, 1.0]],
            device=self.device,
        ).view(1, 1, 3, 3)

    def _prepare_tensor(self, img_input: Union[str, Path, Image.Image]) -> torch.Tensor:
        if isinstance(img_input, (str, Path)):
            with Image.open(img_input) as img:
                pil_img = img.convert("RGB")
        else:
            pil_img = img_input.convert("RGB")

        resized = TF.resize(pil_img, [self.img_size, self.img_size], antialias=True)
        tensor = self.normalize(TF.to_tensor(resized)).unsqueeze(0)  # (1, 3, H, W)
        return tensor.to(self.device)

    def _compute_edge_correlation(self, t_b: torch.Tensor, t_a: torch.Tensor) -> float:
        # Convert RGB channels to luminance
        g_b = 0.2989 * t_b[:, 0:1] + 0.5870 * t_b[:, 1:2] + 0.1140 * t_b[:, 2:3]
        g_a = 0.2989 * t_a[:, 0:1] + 0.5870 * t_a[:, 1:2] + 0.1140 * t_a[:, 2:3]

        mag_b = torch.sqrt(F.conv2d(g_b, self.kx, padding=1) ** 2 + F.conv2d(g_b, self.ky, padding=1) ** 2 + 1e-8).flatten()
        mag_a = torch.sqrt(F.conv2d(g_a, self.kx, padding=1) ** 2 + F.conv2d(g_a, self.ky, padding=1) ** 2 + 1e-8).flatten()

        mb_c = mag_b - mag_b.mean()
        ma_c = mag_a - mag_a.mean()
        denom = torch.norm(mb_c) * torch.norm(ma_c) + 1e-8
        return float(torch.dot(mb_c, ma_c) / denom)

    @torch.no_grad()
    def predict(
        self,
        before_img: Union[str, Path, Image.Image],
        after_img: Union[str, Path, Image.Image],
        threshold: float = 0.50,
    ) -> Dict[str, Any]:
        t_b = self._prepare_tensor(before_img)
        t_a = self._prepare_tensor(after_img)

        # 1. Raw Siamese ResNet classification head probability
        logits = self.model(t_b, t_a)
        raw_probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
        raw_prob_changed = float(raw_probs[1])

        # 2. ResNet-18 512-dimensional deep semantic feature cosine similarity
        feat_b = self.model.forward_single(t_b)
        feat_a = self.model.forward_single(t_a)
        deep_sim = float(F.cosine_similarity(feat_b, feat_a, dim=1).item())

        # 3. Normalized cross-correlation of Sobel gradient magnitudes
        edge_corr = self._compute_edge_correlation(t_b, t_a)

        # 4. Calibrated Structural Change Index (CSCI):
        # - Real excavation/construction severely disrupts edges (corr <= 0.35) and deep features (sim <= 0.86).
        # - Seasonal vegetation/soil moisture shifts preserve terrain geometry (corr >= 0.60, sim >= 0.90).
        edge_disruption = float(np.clip((0.60 - edge_corr) / 0.35, 0.0, 1.0))
        deep_disruption = float(np.clip((0.92 - deep_sim) / 0.12, 0.0, 1.0))
        structural_score = 0.55 * deep_disruption + 0.45 * edge_disruption

        calibrated_prob = float(0.40 * raw_prob_changed + 0.60 * structural_score)
        calibrated_prob = float(np.clip((calibrated_prob - 0.20) / 0.65, 0.0, 1.0))

        # Semantic Invariance Gate: If ResNet deep feature representations correlate strongly (deep_sim >= 0.88),
        # the high-level terrain structures (roads, tree canopy, field lines) are intact.
        # Dampen spurious sensor/lighting/resolution false alarms so natural land remains UNCHANGED.
        if deep_sim >= 0.88:
            calibrated_prob = min(calibrated_prob, 0.35 * (1.0 - (deep_sim - 0.88) / 0.12))
            calibrated_prob = max(0.0, float(calibrated_prob))

        is_changed = calibrated_prob >= threshold
        label = "CHANGED" if is_changed else "UNCHANGED"

        if is_changed:
            severity = "CRITICAL" if calibrated_prob > 0.85 else ("HIGH" if calibrated_prob > 0.70 else "MODERATE")
            analysis_note = "Structural terrain disruption detected (excavation, construction, or clearing)."
        else:
            severity = "NONE"
            if deep_sim > 0.90 and edge_corr > 0.55:
                analysis_note = "Consistent terrain structure preserved (natural seasonal / lighting variation)."
            else:
                analysis_note = "No significant physical land disturbance detected."

        return {
            "is_changed": is_changed,
            "label": label,
            "change_probability": round(calibrated_prob, 4),
            "unchanged_probability": round(1.0 - calibrated_prob, 4),
            "raw_probability": round(raw_prob_changed, 4),
            "edge_correlation": round(edge_corr, 4),
            "deep_similarity": round(deep_sim, 4),
            "confidence": round(max(calibrated_prob, 1.0 - calibrated_prob), 4),
            "severity": severity,
            "analysis_note": analysis_note,
        }
