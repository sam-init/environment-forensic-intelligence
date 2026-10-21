"""Train a change/no-change classifier from frozen ResNet-18 pair embeddings.

The official validation split is never used for model selection or threshold
tuning. A grouped calibration slice is carved out of the training split for
that purpose, then the untouched validation split is evaluated once.
"""
from __future__ import annotations

import argparse
import csv
import json
from datetime import date
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from change_detection.dataset import PairSample, load_dataset
from change_detection.features import BACKBONE, load_or_extract_features

DEFAULT_CACHE_DIR = Path("data/processed/change_detection/features")
DEFAULT_MODEL_DIR = Path("data/processed/change_detection/models")


def pair_matrix(payload: dict[str, np.ndarray]) -> np.ndarray:
    first = payload["features1"]
    second = payload["features2"]
    return np.concatenate([first, second, np.abs(first - second)], axis=1)


def select_threshold(labels: np.ndarray, probabilities: np.ndarray) -> tuple[float, str]:
    if len(np.unique(labels)) < 2:
        return 0.5, "calibration split had one class; defaulted to 0.5"
    candidates = np.unique(np.concatenate([probabilities, np.array([0.5])]))
    best_threshold, best_f1 = 0.5, -1.0
    for threshold in candidates:
        predicted = (probabilities >= threshold).astype(int)
        score = f1_score(labels, predicted, zero_division=0)
        if score > best_f1:
            best_threshold, best_f1 = float(threshold), float(score)
    return best_threshold, "maximum F1 on the calibration slice"


def classification_metrics(
    labels: np.ndarray, probabilities: np.ndarray, threshold: float
) -> dict[str, Any]:
    predicted = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(labels, predicted, labels=[0, 1]).ravel()
    precision = precision_score(labels, predicted, zero_division=0)
    recall = recall_score(labels, predicted, zero_division=0)
    f1 = f1_score(labels, predicted, zero_division=0)
    return {
        "threshold": round(float(threshold), 6),
        "n": int(labels.size),
        "positives": int(labels.sum()),
        "negatives": int((1 - labels).sum()),
        "accuracy": round(float(accuracy_score(labels, predicted)), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "roc_auc": round(float(roc_auc_score(labels, probabilities)), 4)
        if len(np.unique(labels)) == 2
        else None,
        "average_precision": round(float(average_precision_score(labels, probabilities)), 4)
        if len(np.unique(labels)) == 2
        else None,
        "brier_score": round(float(brier_score_loss(labels, probabilities)), 4),
        "confusion_matrix": {
            "true_negative": int(tn),
            "false_positive": int(fp),
            "false_negative": int(fn),
            "true_positive": int(tp),
        },
    }


def subset(samples: list[PairSample], limit: int | None, seed: int) -> list[PairSample]:
    if not limit or limit >= len(samples):
        return samples
    bases = np.array(sorted({sample.base_id for sample in samples}))
    if limit >= len(bases):
        return samples
    chosen, _ = train_test_split(bases, train_size=limit, random_state=seed)
    chosen_set = set(chosen)
    return [sample for sample in samples if sample.base_id in chosen_set]


def split_fit_calibration(
    samples: list[PairSample], fraction: float, seed: int
) -> tuple[list[PairSample], list[PairSample]]:
    if not 0.0 < fraction < 0.5:
        raise ValueError("--calibration-fraction must be between 0 and 0.5")
    bases = np.array(sorted({sample.base_id for sample in samples}))
    fit_bases, _ = train_test_split(bases, test_size=fraction, random_state=seed)
    fit_set = set(fit_bases)
    return (
        [sample for sample in samples if sample.base_id in fit_set],
        [sample for sample in samples if sample.base_id not in fit_set],
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Train the image-pair change classifier.")
    parser.add_argument("--dataset", default="s2looking")
    parser.add_argument("--data-root", default=None)
    parser.add_argument("--cache-dir", default=str(DEFAULT_CACHE_DIR))
    parser.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR))
    parser.add_argument("--model-name", default=None)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--calibration-fraction", type=float, default=0.1)
    parser.add_argument("--limit-train", type=int, default=None)
    parser.add_argument("--limit-val", type=int, default=None)
    parser.add_argument("--force-features", action="store_true")
    parser.add_argument(
        "--include-augmented",
        action="store_true",
        help="Include the synthetic identical-image negatives (demo mode only).",
    )
    args = parser.parse_args()

    bundle = load_dataset(
        args.dataset, args.data_root, include_augmented=args.include_augmented
    )
    train_samples = subset(bundle.train, args.limit_train, args.seed)
    val_samples = subset(bundle.validation, args.limit_val, args.seed)
    fit_samples, calibration_samples = split_fit_calibration(
        train_samples, args.calibration_fraction, args.seed
    )
    fit_bases = {sample.base_id for sample in fit_samples}
    calibration_bases = {sample.base_id for sample in calibration_samples}
    if len(fit_bases & calibration_bases):
        raise SystemExit("Fit/calibration split leaked base images; refusing to train.")

    tag = f"limit{args.limit_train}" if args.limit_train else ""
    cache_dir = Path(args.cache_dir)
    train_payload = load_or_extract_features(
        train_samples,
        bundle.name,
        "train",
        cache_dir,
        image_size=args.image_size,
        batch_size=args.batch_size,
        workers=args.workers,
        force=args.force_features,
        tag=tag,
        include_augmented=args.include_augmented,
    )
    val_payload = load_or_extract_features(
        val_samples,
        bundle.name,
        "validation",
        cache_dir,
        image_size=args.image_size,
        batch_size=args.batch_size,
        workers=args.workers,
        force=args.force_features,
        tag=tag,
        include_augmented=args.include_augmented,
    )

    expected_train_labels = np.asarray([sample.label for sample in train_samples], dtype=int)
    if not np.array_equal(train_payload["labels"].astype(int), expected_train_labels):
        raise SystemExit("Cached training features do not match the dataset labels.")
    expected_val_labels = np.asarray([sample.label for sample in val_samples], dtype=int)
    if not np.array_equal(val_payload["labels"].astype(int), expected_val_labels):
        raise SystemExit("Cached validation features do not match the dataset labels.")

    id_to_index = {sample_id: index for index, sample_id in enumerate(train_payload["sample_ids"])}
    fit_indices = np.array([id_to_index[sample.sample_id] for sample in fit_samples])
    calibration_indices = np.array(
        [id_to_index[sample.sample_id] for sample in calibration_samples]
    )

    matrix = pair_matrix(train_payload)
    labels = train_payload["labels"].astype(int)
    fit_labels = labels[fit_indices]
    calibration_labels = labels[calibration_indices]

    candidates: list[tuple[float, float, Pipeline]] = []
    for penalty in (0.01, 0.1, 1.0, 10.0):
        pipeline = Pipeline(
            [
                ("scale", StandardScaler()),
                (
                    "model",
                    LogisticRegression(
                        C=penalty,
                        class_weight="balanced",
                        max_iter=3000,
                        solver="lbfgs",
                        random_state=args.seed,
                    ),
                ),
            ]
        )
        pipeline.fit(matrix[fit_indices], fit_labels)
        calibration_probabilities = pipeline.predict_proba(matrix[calibration_indices])[:, 1]
        if len(np.unique(calibration_labels)) == 2:
            score = float(roc_auc_score(calibration_labels, calibration_probabilities))
        else:
            score = 0.0
        candidates.append((score, penalty, pipeline))

    best_score, best_c, pipeline = max(candidates, key=lambda item: (item[0], -item[1]))
    calibration_probabilities = pipeline.predict_proba(matrix[calibration_indices])[:, 1]
    threshold, threshold_rule = select_threshold(calibration_labels, calibration_probabilities)

    validation_matrix = pair_matrix(val_payload)
    validation_labels = val_payload["labels"].astype(int)
    validation_probabilities = pipeline.predict_proba(validation_matrix)[:, 1]
    validation_metrics = classification_metrics(
        validation_labels, validation_probabilities, threshold
    )
    fixed_metrics = classification_metrics(validation_labels, validation_probabilities, 0.5)
    calibration_metrics = classification_metrics(
        calibration_labels, calibration_probabilities, threshold
    )
    synthetic_mask = np.asarray([sample.synthetic for sample in val_samples], dtype=bool)
    real_metrics = (
        classification_metrics(
            validation_labels[~synthetic_mask],
            validation_probabilities[~synthetic_mask],
            threshold,
        )
        if (~synthetic_mask).any()
        else None
    )
    synthetic_metrics = (
        classification_metrics(
            validation_labels[synthetic_mask],
            validation_probabilities[synthetic_mask],
            threshold,
        )
        if synthetic_mask.any()
        else None
    )

    model_name = args.model_name or f"{bundle.name}_{BACKBONE}_logreg"
    model_dir = Path(args.model_dir)
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / f"{model_name}.joblib"
    metadata_path = model_dir / f"{model_name}.json"
    predictions_path = model_dir / f"{model_name}_predictions.csv"

    metadata = {
        "model_name": model_name,
        "model_type": "frozen ResNet-18 embeddings + standardized logistic regression",
        "backbone": BACKBONE,
        "embedding_dim": 512,
        "feature_layout": "concat(embedding1, embedding2, abs(embedding1 - embedding2))",
        "image_size": args.image_size,
        "dataset": bundle.name,
        "dataset_stats": bundle.stats,
        "demo_mode": bool(args.include_augmented),
        "demo_warning": (
            "Demo only: the archive's unchanged class is mostly identical-image pairs. "
            "This model learns image identity, not real land-cover change."
            if args.include_augmented
            else None
        ),
        "trained_on": date.today().isoformat(),
        "calibration_fraction": args.calibration_fraction,
        "selected_c": best_c,
        "selected_calibration_roc_auc": round(best_score, 4),
        "threshold": threshold,
        "threshold_rule": threshold_rule,
        "train": {
            "fit": len(fit_samples),
            "calibration": len(calibration_samples),
            "fit_positives": int(fit_labels.sum()),
            "calibration_positives": int(calibration_labels.sum()),
        },
        "calibration": calibration_metrics,
        "validation": validation_metrics,
        "validation_at_fixed_0_5": fixed_metrics,
        "validation_real_only": real_metrics,
        "validation_synthetic_negatives": synthetic_metrics,
        "limitations": [
            "Image-level labels only; the archive contains no pixel masks.",
            "The dataset is generic change detection, not mining or dumping specific.",
            "Frozen ImageNet features may miss small or subtle changes.",
        ]
        + (
            [
                (
                    "DEMO ONLY: synthetic negatives are pixel-identical copies, so the model "
                    "learns identity rather than real change."
                ),
            ]
            if args.include_augmented
            else [
                (
                    "Real unchanged pairs are extremely rare in this archive; class balance is "
                    "not representative."
                ),
            ]
        ),
    }
    joblib.dump(pipeline, model_path)
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    with predictions_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            ["sample_id", "base_id", "synthetic", "label", "probability", "predicted_at_threshold"]
        )
        for sample_id, base, synthetic, label, probability in zip(
            val_payload["sample_ids"],
            val_payload["base_ids"],
            synthetic_mask,
            validation_labels,
            validation_probabilities,
            strict=True,
        ):
            writer.writerow(
                [
                    sample_id,
                    base,
                    int(synthetic),
                    int(label),
                    round(float(probability), 6),
                    int(probability >= threshold),
                ]
            )

    summary = {
        "model": str(model_path),
        "metadata": str(metadata_path),
        "predictions": str(predictions_path),
        "selected_c": best_c,
        "threshold": threshold,
        "validation": validation_metrics,
        "validation_at_fixed_0_5": fixed_metrics,
        "validation_real_only": real_metrics,
        "validation_synthetic_negatives": synthetic_metrics,
        "demo_mode": bool(args.include_augmented),
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
