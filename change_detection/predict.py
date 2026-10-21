"""Run the trained image-pair change classifier on a new before/after pair."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib

from change_detection.dataset import PairSample
from change_detection.features import extract_features
from change_detection.train import pair_matrix


def load_model(model_path: Path) -> tuple[object, dict]:
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    metadata_path = model_path.with_suffix(".json")
    if not metadata_path.exists():
        raise FileNotFoundError(f"Model metadata not found: {metadata_path}")
    pipeline = joblib.load(model_path)
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    return pipeline, metadata


def predict_pair(
    image1: Path,
    image2: Path,
    pipeline: object,
    metadata: dict,
) -> dict[str, object]:
    if not image1.exists() or not image2.exists():
        raise FileNotFoundError("Both input images must exist.")
    sample = PairSample(
        sample_id="query",
        base_id="query",
        image1=image1,
        image2=image2,
        label=0,
        split="query",
        caption1="",
        caption2="",
    )
    payload = extract_features(
        [sample],
        image_size=int(metadata.get("image_size", 224)),
        batch_size=1,
    )
    probability = float(pipeline.predict_proba(pair_matrix(payload))[0, 1])
    threshold = float(metadata["threshold"])
    return {
        "image1": str(image1),
        "image2": str(image2),
        "change_probability": round(probability, 6),
        "threshold": threshold,
        "changed": bool(probability >= threshold),
        "model": metadata["model_name"],
        "dataset": metadata["dataset"],
        "label_scope": "image-level changed vs unchanged",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Predict change for one image pair.")
    parser.add_argument("--image1", required=True)
    parser.add_argument("--image2", required=True)
    parser.add_argument("--model", required=True, help="Path to the .joblib model")
    args = parser.parse_args()

    pipeline, metadata = load_model(Path(args.model))
    result = predict_pair(Path(args.image1), Path(args.image2), pipeline, metadata)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
