"""
Siamese ResNet-18 Neural Network for Land Change Detection.
Compares two aligned temporal images to classify land changes (excavation, construction, deforestation).
"""
from __future__ import annotations

import torch
import torch.nn as nn
from torchvision import models


class SiameseResNet18(nn.Module):
    """
    Siamese CNN architecture with a shared ResNet-18 feature extraction backbone
    and a multi-feature differencing fusion head.
    """
    def __init__(self, pretrained: bool = True, freeze_early_layers: bool = False):
        super().__init__()
        weights = models.ResNet18_Weights.DEFAULT if pretrained else None
        resnet = models.resnet18(weights=weights)

        # Truncate final classification layer; retain feature extractor (outputs 512 channels)
        self.encoder = nn.Sequential(
            resnet.conv1,
            resnet.bn1,
            resnet.relu,
            resnet.maxpool,
            resnet.layer1,
            resnet.layer2,
            resnet.layer3,
            resnet.layer4,
            resnet.avgpool,
        )

        if freeze_early_layers:
            # Freeze low-level edge/texture layers; train higher semantic layers
            for param in list(self.encoder.parameters())[:-15]:
                param.requires_grad = False

        # Fusion head: concatenates [v_before, v_after, |v_before - v_after|, v_before * v_after]
        # 512 * 4 = 2048
        self.classifier = nn.Sequential(
            nn.Linear(512 * 4, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.4),
            nn.Linear(256, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(64, 2),  # Class 0: Unchanged, Class 1: Changed
        )

    def forward_single(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.encoder(x)
        return torch.flatten(feat, 1)  # shape: (batch_size, 512)

    def forward(self, img_before: torch.Tensor, img_after: torch.Tensor) -> torch.Tensor:
        # Extract features through shared Siamese backbone
        feat_b = self.forward_single(img_before)
        feat_a = self.forward_single(img_after)

        # Multi-modal feature differencing
        diff = torch.abs(feat_b - feat_a)
        prod = feat_b * feat_a
        fused = torch.cat([feat_b, feat_a, diff, prod], dim=1)  # (batch_size, 2048)

        # Classify change
        return self.classifier(fused)

    @torch.no_grad()
    def predict_change_probability(self, img_before: torch.Tensor, img_after: torch.Tensor) -> torch.Tensor:
        """Returns the probability (0.0 to 1.0) of land change."""
        self.eval()
        logits = self.forward(img_before, img_after)
        probs = torch.softmax(logits, dim=1)
        return probs[:, 1]
