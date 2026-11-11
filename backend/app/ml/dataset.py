"""
Dataset loader for Siamese Land Change Detection.
Loads paired Before/After satellite images from Changed and Unchanged directories.
"""
from __future__ import annotations

import random
from pathlib import Path
from typing import Tuple, List, Dict, Any

import torch
from torch.utils.data import Dataset
from PIL import Image
import torchvision.transforms.functional as TF
from torchvision import transforms


DEFAULT_DATASET_ROOT = Path(r"C:\Users\SAMARTH\Downloads\Dataset\raw_screenshots")


def collect_image_pairs(root_dir: Path | str = DEFAULT_DATASET_ROOT) -> List[Dict[str, Any]]:
    """
    Scans the dataset directories and matches Before and After image pairs.
    Returns list of dicts:
      {'before': Path, 'after': Path, 'label': 1 (Changed) or 0 (Unchanged), 'id': str}
    """
    root = Path(root_dir)
    pairs: List[Dict[str, Any]] = []

    # 1. Changed pairs: Changed/2019-before vs Changed/2024-After
    changed_before_dir = root / "Changed" / "2019-before"
    changed_after_dir = root / "Changed" / "2024-After"

    if changed_before_dir.exists() and changed_after_dir.exists():
        before_files = {f.name: f for f in changed_before_dir.glob("*.png")}
        after_files = {f.name: f for f in changed_after_dir.glob("*.png")}
        common_ids = sorted(set(before_files.keys()) & set(after_files.keys()))

        for img_id in common_ids:
            pairs.append({
                "before": before_files[img_id],
                "after": after_files[img_id],
                "label": 1,
                "label_name": "Changed",
                "id": f"changed_{img_id}",
            })

    # 2. Unchanged pairs: Unchanged/before vs Unchanged/after
    unchanged_before_dir = root / "Unchanged" / "before"
    unchanged_after_dir = root / "Unchanged" / "after"

    if unchanged_before_dir.exists() and unchanged_after_dir.exists():
        before_files = {f.name: f for f in unchanged_before_dir.glob("*.png")}
        after_files = {f.name: f for f in unchanged_after_dir.glob("*.png")}
        common_ids = sorted(set(before_files.keys()) & set(after_files.keys()))

        for img_id in common_ids:
            pairs.append({
                "before": before_files[img_id],
                "after": after_files[img_id],
                "label": 0,
                "label_name": "Unchanged",
                "id": f"unchanged_{img_id}",
            })

    return pairs


class SiameseChangeDataset(Dataset):
    """
    PyTorch Dataset yielding (img_before, img_after, label) with joint augmentations.
    """
    def __init__(
        self,
        pairs: List[Dict[str, Any]],
        img_size: int = 224,
        is_training: bool = True,
    ):
        self.pairs = pairs
        self.img_size = img_size
        self.is_training = is_training

        # Standard ImageNet normalization
        self.normalize = transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        )

    def __len__(self) -> int:
        return len(self.pairs)

    def _load_rgb(self, path: Path) -> Image.Image:
        with Image.open(path) as img:
            return img.convert("RGB")

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        item = self.pairs[idx]
        img_b = self._load_rgb(item["before"])
        img_a = self._load_rgb(item["after"])

        # Resize
        img_b = TF.resize(img_b, [self.img_size, self.img_size], antialias=True)
        img_a = TF.resize(img_a, [self.img_size, self.img_size], antialias=True)

        # Joint spatial augmentations for training
        if self.is_training:
            # 1. Random horizontal flip (applied to both identically)
            if random.random() > 0.5:
                img_b = TF.hflip(img_b)
                img_a = TF.hflip(img_a)

            # 2. Random vertical flip (applied to both identically)
            if random.random() > 0.5:
                img_b = TF.vflip(img_b)
                img_a = TF.vflip(img_a)

            # 3. Random 90-degree rotation (applied to both identically)
            rot_choice = random.choice([0, 90, 180, 270])
            if rot_choice > 0:
                img_b = TF.rotate(img_b, rot_choice)
                img_a = TF.rotate(img_a, rot_choice)

            # 4. Independent slight color jitter (simulating sensor/seasonal variation)
            jitter = transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.1)
            img_b = jitter(img_b)
            img_a = jitter(img_a)

        # Convert to Tensor and normalize
        tensor_b = self.normalize(TF.to_tensor(img_b))
        tensor_a = self.normalize(TF.to_tensor(img_a))
        label = torch.tensor(item["label"], dtype=torch.long)

        return tensor_b, tensor_a, label
