"""
Inference helper for Siamese ResNet-18 Land Change Detector.
Predicts change status and probability between any two images.
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict, Any, Union

import torch
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

    def _prepare_tensor(self, img_input: Union[str, Path, Image.Image]) -> torch.Tensor:
        if isinstance(img_input, (str, Path)):
            with Image.open(img_input) as img:
                pil_img = img.convert("RGB")
        else:
            pil_img = img_input.convert("RGB")

        resized = TF.resize(pil_img, [self.img_size, self.img_size], antialias=True)
        tensor = self.normalize(TF.to_tensor(resized)).unsqueeze(0)  # (1, 3, H, W)
        return tensor.to(self.device)

    @torch.no_grad()
    def predict(
        self,
        before_img: Union[str, Path, Image.Image],
        after_img: Union[str, Path, Image.Image],
        threshold: float = 0.50,
    ) -> Dict[str, Any]:
        t_b = self._prepare_tensor(before_img)
        t_a = self._prepare_tensor(after_img)

        logits = self.model(t_b, t_a)
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
        prob_unchanged = float(probs[0])
        prob_changed = float(probs[1])

        is_changed = prob_changed >= threshold
        label = "CHANGED" if is_changed else "UNCHANGED"

        if is_changed:
            severity = "CRITICAL" if prob_changed > 0.85 else ("HIGH" if prob_changed > 0.70 else "MODERATE")
        else:
            severity = "NONE"

        return {
            "is_changed": is_changed,
            "label": label,
            "change_probability": round(prob_changed, 4),
            "unchanged_probability": round(prob_unchanged, 4),
            "confidence": round(max(prob_changed, prob_unchanged), 4),
            "severity": severity,
        }
