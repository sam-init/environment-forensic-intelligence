"""Dataset loading and validation for satellite image-pair change detection.

The archive is expected to live outside the repository. Pass its root with
``--data-root`` or set ``CHANGE_DATA_ROOT``.

Rows whose filename contains ``_aug`` are synthetic negatives: the archive
stores the same image for both timestamps and labels the pair unchanged. They
are excluded by default because they teach image identity, not real change.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

DATASET_SPECS: dict[str, dict[str, str]] = {
    "s2looking": {
        "train_csv": "captions/train/train_S2Looking.csv",
        "val_csv": "captions/val/test_S2Looking.csv",
        "train_image1": "S2Looking/train/Image1",
        "train_image2": "S2Looking/train/Image2",
        "val_image1": "S2Looking/val/Image1",
        "val_image2": "S2Looking/val/Image2",
    },
    "levir-cd": {
        "train_csv": "captions/train/train_LEVIR-CD.csv",
        "val_csv": "captions/val/test_LEVIR-CD.csv",
        "train_image1": "LEVIR-CD/train/A",
        "train_image2": "LEVIR-CD/train/B",
        "val_image1": "LEVIR-CD/val/A",
        "val_image2": "LEVIR-CD/val/B",
    },
    "clcd": {
        "train_csv": "captions/train/train_CLCD.csv",
        "val_csv": "captions/val/test_CLCD.csv",
        "train_image1": "CLCD/train/time1",
        "train_image2": "CLCD/train/time2",
        "val_image1": "CLCD/val/time1",
        "val_image2": "CLCD/val/time2",
    },
    "dsifn": {
        "train_csv": "captions/train/train_DSIFN.csv",
        "val_csv": "captions/val/test_DSIFN.csv",
        "train_image1": "DSIFN/train/t1",
        "train_image2": "DSIFN/train/t2",
        "val_image1": "DSIFN/val/t1",
        "val_image2": "DSIFN/val/t2",
    },
}


@dataclass(frozen=True)
class PairSample:
    sample_id: str
    base_id: str
    image1: Path
    image2: Path
    label: int
    split: str
    caption1: str
    caption2: str
    synthetic: bool = False


@dataclass
class DatasetBundle:
    name: str
    train: list[PairSample]
    validation: list[PairSample]
    stats: dict[str, object] = field(default_factory=dict)


def is_augmented(image_name: str) -> bool:
    return "_aug" in Path(str(image_name)).stem


def base_id(image_name: str) -> str:
    return Path(str(image_name)).stem.split("_aug")[0]


def resolve_data_root(value: str | None) -> Path:
    root = value or os.environ.get("CHANGE_DATA_ROOT")
    if not root:
        raise ValueError("Pass --data-root or set CHANGE_DATA_ROOT to the archive directory.")
    path = Path(root)
    if not path.exists():
        raise FileNotFoundError(f"Dataset root does not exist: {path}")
    return path


def _load_split(
    spec: dict[str, str],
    root: Path,
    csv_key: str,
    image1_key: str,
    image2_key: str,
    split: str,
    include_augmented: bool,
) -> tuple[list[PairSample], dict[str, int]]:
    csv_path = root / spec[csv_key]
    directory1 = root / spec[image1_key]
    directory2 = root / spec[image2_key]
    if not csv_path.exists():
        raise FileNotFoundError(f"Caption CSV not found: {csv_path}")
    if not directory1.exists() or not directory2.exists():
        raise FileNotFoundError(f"Image directories not found under {root}")

    frame = pd.read_csv(csv_path)
    required = {"img", "caption1", "caption2", "change"}
    missing_columns = required - set(frame.columns)
    if missing_columns:
        raise ValueError(f"{csv_path} is missing columns: {sorted(missing_columns)}")
    frame = frame.dropna(subset=["img", "change"]).copy()
    frame["change"] = frame["change"].astype(int)
    if not set(frame["change"].unique()).issubset({0, 1}):
        raise ValueError(f"{csv_path} contains labels other than 0/1.")

    samples: list[PairSample] = []
    skipped_missing = 0
    skipped_synthetic = 0
    for row in frame.itertuples(index=False):
        image_name = str(row.img)
        image1 = directory1 / image_name
        image2 = directory2 / image_name
        if not image1.exists() or not image2.exists():
            skipped_missing += 1
            continue
        synthetic = is_augmented(image_name)
        if synthetic and not include_augmented:
            skipped_synthetic += 1
            continue
        samples.append(
            PairSample(
                sample_id=image_name,
                base_id=base_id(image_name),
                image1=image1,
                image2=image2,
                label=int(row.change),
                split=split,
                caption1=str(getattr(row, "caption1", "")),
                caption2=str(getattr(row, "caption2", "")),
                synthetic=synthetic,
            )
        )

    if not samples:
        raise ValueError(f"No usable image pairs found in {csv_path}.")
    if skipped_missing:
        raise ValueError(
            f"{csv_path} references {skipped_missing} image pairs that are missing from "
            f"{directory1} or {directory2}. This split is incomplete; refusing to use it."
        )

    synthetic_rows = sum(1 for sample in samples if sample.synthetic)
    counts = {
        "rows": len(samples),
        "changed": int(sum(sample.label for sample in samples)),
        "unchanged": int(sum(1 - sample.label for sample in samples)),
        "synthetic_rows": int(synthetic_rows),
        "real_rows": int(len(samples) - synthetic_rows),
        "skipped_synthetic_rows": int(skipped_synthetic),
    }
    return samples, counts


def load_dataset(
    name: str,
    data_root: str | None = None,
    include_augmented: bool = False,
) -> DatasetBundle:
    name = name.lower()
    if name not in DATASET_SPECS:
        raise ValueError(f"Unknown dataset {name!r}. Choices: {sorted(DATASET_SPECS)}")
    root = resolve_data_root(data_root)
    spec = DATASET_SPECS[name]
    train, train_counts = _load_split(
        spec, root, "train_csv", "train_image1", "train_image2", "train", include_augmented
    )
    validation, val_counts = _load_split(
        spec, root, "val_csv", "val_image1", "val_image2", "validation", include_augmented
    )

    train_bases = {sample.base_id for sample in train}
    val_bases = {sample.base_id for sample in validation}
    overlap = train_bases & val_bases
    if overlap:
        raise ValueError(
            f"{name} train/validation base images overlap ({len(overlap)} shared). "
            "This split would leak images; choose a clean dataset or rebuild the split."
        )

    stats = {
        "name": name,
        "data_root": str(root),
        "include_augmented": include_augmented,
        "train": train_counts,
        "validation": val_counts,
        "train_base_images": len(train_bases),
        "validation_base_images": len(val_bases),
        "base_overlap": len(overlap),
    }
    return DatasetBundle(name=name, train=train, validation=validation, stats=stats)
