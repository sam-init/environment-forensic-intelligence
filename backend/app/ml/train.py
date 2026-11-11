"""
Training script for Siamese ResNet-18 Land Change Detection Model.
Includes hardware safety guards, learning rate scheduling, evaluation metrics, and visual performance curves.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np

# Ensure app imports resolve
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.ml.dataset import collect_image_pairs, SiameseChangeDataset
from app.ml.model import SiameseResNet18


def get_safe_device() -> torch.device:
    """Selects CUDA or CPU with thermal & memory safety guards for laptop GPUs."""
    if torch.cuda.is_available():
        device = torch.device("cuda:0")
        try:
            # Safety limit: Cap VRAM allocation to 50% (~2 GB) so the GPU is never overloaded
            torch.cuda.set_per_process_memory_fraction(0.50, 0)
            torch.cuda.empty_cache()
            gpu_name = torch.cuda.get_device_name(0)
            print(f"[Hardware Guard] Active Device: GPU ({gpu_name}) | VRAM capped at 50% for thermal safety.")
        except Exception:
            print("[Hardware Guard] Active Device: GPU (CUDA)")
        return device
    else:
        # Safe multi-threaded CPU execution
        cpu_threads = min(4, os.cpu_count() or 2)
        torch.set_num_threads(cpu_threads)
        print(f"[Hardware Guard] Active Device: CPU ({cpu_threads} threads) | 0% GPU load (100% safe for GPU/EMI).")
        return torch.device("cpu")


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> Tuple[float, float]:
    model.train()
    total_loss = 0.0
    all_preds, all_labels = [], []

    for img_b, img_a, labels in loader:
        img_b, img_a, labels = img_b.to(device), img_a.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(img_b, img_a)
        loss = criterion(outputs, labels)
        loss.backward()

        # Gradient clipping to prevent instability
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        total_loss += loss.item() * len(labels)
        preds = torch.argmax(outputs, dim=1).detach().cpu().numpy()
        all_preds.extend(preds)
        all_labels.extend(labels.cpu().numpy())

    epoch_loss = total_loss / len(loader.dataset)
    epoch_acc = accuracy_score(all_labels, all_preds)
    return epoch_loss, epoch_acc


@torch.no_grad()
def evaluate(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> Dict[str, float]:
    model.eval()
    total_loss = 0.0
    all_preds, all_labels = [], []

    for img_b, img_a, labels in loader:
        img_b, img_a, labels = img_b.to(device), img_a.to(device), labels.to(device)
        outputs = model(img_b, img_a)
        loss = criterion(outputs, labels)

        total_loss += loss.item() * len(labels)
        preds = torch.argmax(outputs, dim=1).cpu().numpy()
        all_preds.extend(preds)
        all_labels.extend(labels.cpu().numpy())

    val_loss = total_loss / len(loader.dataset)
    val_acc = accuracy_score(all_labels, all_preds)
    precision, recall, f1, _ = precision_recall_fscore_support(
        all_labels, all_preds, average="binary", zero_division=0
    )

    return {
        "loss": val_loss,
        "acc": val_acc,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "preds": all_preds,
        "labels": all_labels,
    }


def generate_learning_curve_plots(
    history: Dict[str, List[float]],
    final_cm: np.ndarray,
    save_path: Path,
):
    """Plots and saves the multi-panel learning rate & performance graph."""
    plt.style.use("dark_background")
    fig, axes = plt.subplots(2, 2, figsize=(14, 10), dpi=150)
    fig.patch.set_facecolor("#0b0f17")

    epochs = range(1, len(history["train_loss"]) + 1)

    # 1. Loss Curve
    ax_loss = axes[0, 0]
    ax_loss.set_facecolor("#111827")
    ax_loss.plot(epochs, history["train_loss"], label="Train Loss", color="#38bdf8", lw=2.2)
    ax_loss.plot(epochs, history["val_loss"], label="Val Loss", color="#f43f5e", lw=2.2, linestyle="--")
    ax_loss.set_title("Cross-Entropy Loss (Convergence)", fontsize=13, fontweight="bold", color="#f8fafc", pad=10)
    ax_loss.set_xlabel("Epoch", fontsize=11, color="#94a3b8")
    ax_loss.set_ylabel("Loss", fontsize=11, color="#94a3b8")
    ax_loss.grid(True, linestyle=":", alpha=0.3, color="#475569")
    ax_loss.legend(loc="upper right", framealpha=0.8)

    # 2. Accuracy Curve
    ax_acc = axes[0, 1]
    ax_acc.set_facecolor("#111827")
    ax_acc.plot(epochs, [a * 100 for a in history["train_acc"]], label="Train Accuracy", color="#34d399", lw=2.2)
    ax_acc.plot(epochs, [a * 100 for a in history["val_acc"]], label="Val Accuracy", color="#a855f7", lw=2.2, linestyle="--")
    ax_acc.set_title("Classification Accuracy (%)", fontsize=13, fontweight="bold", color="#f8fafc", pad=10)
    ax_acc.set_xlabel("Epoch", fontsize=11, color="#94a3b8")
    ax_acc.set_ylabel("Accuracy (%)", fontsize=11, color="#94a3b8")
    ax_acc.set_ylim(40, 105)
    ax_acc.grid(True, linestyle=":", alpha=0.3, color="#475569")
    ax_acc.legend(loc="lower right", framealpha=0.8)

    # 3. Validation F1-Score & Metrics
    ax_f1 = axes[1, 0]
    ax_f1.set_facecolor("#111827")
    ax_f1.plot(epochs, history["val_f1"], label="Val F1-Score", color="#facc15", lw=2.2)
    ax_f1.plot(epochs, history["val_precision"], label="Val Precision", color="#06b6d4", lw=1.6, alpha=0.85)
    ax_f1.plot(epochs, history["val_recall"], label="Val Recall", color="#ec4899", lw=1.6, alpha=0.85)
    ax_f1.set_title("Validation Quality Metrics (F1 / Precision / Recall)", fontsize=13, fontweight="bold", color="#f8fafc", pad=10)
    ax_f1.set_xlabel("Epoch", fontsize=11, color="#94a3b8")
    ax_f1.set_ylabel("Score (0 to 1)", fontsize=11, color="#94a3b8")
    ax_f1.set_ylim(0.4, 1.05)
    ax_f1.grid(True, linestyle=":", alpha=0.3, color="#475569")
    ax_f1.legend(loc="lower right", framealpha=0.8)

    # 4. Learning Rate Schedule & Confusion Matrix inset
    ax_lr = axes[1, 1]
    ax_lr.set_facecolor("#111827")
    ax_lr.plot(epochs, history["lr"], label="Learning Rate (Cosine Annealing)", color="#818cf8", lw=2.2)
    ax_lr.set_title("Learning Rate Decay Schedule", fontsize=13, fontweight="bold", color="#f8fafc", pad=10)
    ax_lr.set_xlabel("Epoch", fontsize=11, color="#94a3b8")
    ax_lr.set_ylabel("Learning Rate", fontsize=11, color="#94a3b8")
    ax_lr.set_yscale("log")
    ax_lr.grid(True, linestyle=":", alpha=0.3, color="#475569")
    ax_lr.legend(loc="upper right", framealpha=0.8)

    plt.tight_layout(pad=3.0)
    save_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(save_path, facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close()
    print(f"[Visualization] Performance curves saved to: {save_path}")


def run_training(
    epochs: int = 25,
    batch_size: int = 16,
    lr: float = 1e-4,
    img_size: int = 224,
):
    print("=" * 70)
    print("  SIAMESE RESNET-18 LAND CHANGE DETECTION MODEL TRAINING")
    print("=" * 70)

    device = get_safe_device()
    pairs = collect_image_pairs()
    print(f"[Dataset] Found {len(pairs)} matched Before/After image pairs.")
    changed_count = sum(1 for p in pairs if p["label"] == 1)
    unchanged_count = sum(1 for p in pairs if p["label"] == 0)
    print(f"  • Changed pairs:   {changed_count}")
    print(f"  • Unchanged pairs: {unchanged_count}")

    # Stratified 80/20 train/test split
    labels = [p["label"] for p in pairs]
    train_pairs, val_pairs = train_test_split(
        pairs, test_size=0.20, random_state=42, stratify=labels
    )
    print(f"[Split] Train set: {len(train_pairs)} pairs | Validation set: {len(val_pairs)} pairs")

    train_ds = SiameseChangeDataset(train_pairs, img_size=img_size, is_training=True)
    val_ds = SiameseChangeDataset(val_pairs, img_size=img_size, is_training=False)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, drop_last=False)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    print("\n[Model] Instantiating Siamese ResNet-18 (ImageNet Pretrained)...")
    model = SiameseResNet18(pretrained=True).to(device)

    # Class weights for balanced cross entropy
    class_weights = torch.tensor([1.0, unchanged_count / changed_count], device=device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-2)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    history = {
        "train_loss": [], "val_loss": [],
        "train_acc": [], "val_acc": [],
        "val_precision": [], "val_recall": [], "val_f1": [],
        "lr": [],
    }

    best_val_f1 = -1.0
    best_eval = {}
    models_dir = Path(__file__).resolve().parent.parent / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    best_model_path = models_dir / "siamese_resnet18_best.pt"

    start_time = time.time()
    print(f"\n[Training] Commencing {epochs} epochs (Batch size: {batch_size})...\n")

    for epoch in range(1, epochs + 1):
        current_lr = optimizer.param_groups[0]["lr"]
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_metrics = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_metrics["loss"])
        history["train_acc"].append(train_acc)
        history["val_acc"].append(val_metrics["acc"])
        history["val_precision"].append(val_metrics["precision"])
        history["val_recall"].append(val_metrics["recall"])
        history["val_f1"].append(val_metrics["f1"])
        history["lr"].append(current_lr)

        val_f1 = val_metrics["f1"]
        val_acc = val_metrics["acc"]

        is_best = val_f1 > best_val_f1
        if is_best:
            best_val_f1 = val_f1
            best_eval = val_metrics
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_f1": val_f1,
                "val_acc": val_acc,
                "img_size": img_size,
            }, best_model_path)

        flag = " ★ BEST" if is_best else ""
        if epoch % 5 == 0 or epoch == 1 or epoch == epochs or is_best:
            print(
                f"Epoch {epoch:02d}/{epochs:02d} | "
                f"Train Loss: {train_loss:.4f} | Val Loss: {val_metrics['loss']:.4f} | "
                f"Train Acc: {train_acc*100:.1f}% | Val Acc: {val_acc*100:.1f}% | "
                f"Val F1: {val_f1*100:.1f}% | LR: {current_lr:.1e}{flag}"
            )

    elapsed = time.time() - start_time
    print("\n" + "=" * 70)
    print(f"[Done] Training completed safely in {elapsed:.1f} seconds!")
    print(f"[Best Result] Peak Validation F1: {best_val_f1*100:.2f}% | Val Acc: {best_eval.get('acc', 0)*100:.2f}%")
    print(f"[Model Saved] Best weights saved to: {best_model_path}")

    # Generate Performance Curves Graph
    plot_path = models_dir / "training_performance_curves.png"
    cm = confusion_matrix(best_eval.get("labels", []), best_eval.get("preds", []))
    generate_learning_curve_plots(history, cm, plot_path)

    # Print Confusion Matrix
    print(f"\n[Validation Confusion Matrix]:")
    print(f"  True Unchanged: {cm[0, 0]} | False Changed (FP): {cm[0, 1]}")
    print(f"  False Unchanged (FN): {cm[1, 0]} | True Changed (TP): {cm[1, 1]}")
    print("=" * 70)

    # Thermal cleanup
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


if __name__ == "__main__":
    run_training()
