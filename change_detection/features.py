"""ResNet-18 embeddings for before/after image pairs.

The backbone is frozen: embeddings are extracted once and cached as ``.npz``.
Training then operates on the cached vectors, which keeps CPU training fast and
reproducible.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from torchvision.models import ResNet18_Weights, resnet18

from change_detection.dataset import PairSample, load_dataset

BACKBONE = "resnet18"
EMBEDDING_DIM = 512


class PairImageDataset(Dataset):
    def __init__(self, samples: list[PairSample], image_size: int) -> None:
        self.samples = samples
        self.transform = transforms.Compose(
            [
                transforms.Resize((image_size, image_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        sample = self.samples[index]
        with Image.open(sample.image1) as first, Image.open(sample.image2) as second:
            image1 = self.transform(first.convert("RGB"))
            image2 = self.transform(second.convert("RGB"))
        return image1, image2, sample.label, sample.sample_id, sample.base_id


def build_backbone() -> nn.Module:
    model = resnet18(weights=ResNet18_Weights.DEFAULT)
    model.fc = nn.Identity()
    model.eval()
    return model


def _cache_path(
    cache_dir: Path,
    dataset: str,
    split: str,
    image_size: int,
    include_augmented: bool,
    tag: str = "",
) -> Path:
    suffix = "all" if include_augmented else "real"
    tag_part = f"_{tag}" if tag else ""
    return cache_dir / f"{dataset}_{split}_{BACKBONE}_{image_size}_{suffix}{tag_part}.npz"


def extract_features(
    samples: list[PairSample],
    image_size: int = 224,
    batch_size: int = 64,
    workers: int = 0,
) -> dict[str, np.ndarray]:
    loader = DataLoader(
        PairImageDataset(samples, image_size),
        batch_size=batch_size,
        shuffle=False,
        num_workers=workers,
        pin_memory=False,
    )
    model = build_backbone()
    features1: list[np.ndarray] = []
    features2: list[np.ndarray] = []
    labels: list[int] = []
    sample_ids: list[str] = []
    base_ids: list[str] = []
    with torch.inference_mode():
        for image1, image2, batch_labels, batch_ids, batch_bases in loader:
            features1.append(model(image1).cpu().numpy())
            features2.append(model(image2).cpu().numpy())
            labels.extend(int(value) for value in batch_labels)
            sample_ids.extend(batch_ids)
            base_ids.extend(batch_bases)
    return {
        "features1": np.concatenate(features1).astype(np.float32),
        "features2": np.concatenate(features2).astype(np.float32),
        "labels": np.asarray(labels, dtype=np.int64),
        "sample_ids": np.asarray(sample_ids, dtype=object),
        "base_ids": np.asarray(base_ids, dtype=object),
    }


def load_or_extract_features(
    samples: list[PairSample],
    dataset: str,
    split: str,
    cache_dir: Path,
    image_size: int = 224,
    batch_size: int = 64,
    workers: int = 0,
    force: bool = False,
    tag: str = "",
    include_augmented: bool = False,
) -> dict[str, np.ndarray]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = _cache_path(
        cache_dir,
        dataset,
        split,
        image_size,
        include_augmented=include_augmented,
        tag=tag,
    )
    expected_ids = [sample.sample_id for sample in samples]
    if path.exists() and not force:
        cached = np.load(path, allow_pickle=True)
        cached_ids = [str(value) for value in cached["sample_ids"]]
        if cached_ids == expected_ids:
            return {key: cached[key] for key in cached.files}
    payload = extract_features(samples, image_size=image_size, batch_size=batch_size, workers=workers)
    np.savez_compressed(path, **payload)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Precompute cached ResNet-18 pair embeddings.")
    parser.add_argument("--dataset", default="s2looking")
    parser.add_argument("--data-root", default=None)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--cache-dir", default="data/processed/change_detection/features")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    bundle = load_dataset(args.dataset, args.data_root)
    cache_dir = Path(args.cache_dir)
    for split, samples in (("train", bundle.train), ("validation", bundle.validation)):
        payload = load_or_extract_features(
            samples,
            bundle.name,
            split,
            cache_dir,
            image_size=args.image_size,
            batch_size=args.batch_size,
            workers=args.workers,
            force=args.force,
        )
        print(f"{split}: {len(payload['labels'])} pairs -> {cache_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
