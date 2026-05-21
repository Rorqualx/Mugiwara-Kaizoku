"""
Transformer-CRF Model for Web Information Extraction

Implements a LayoutLMv3 encoder with a CRF layer for
sequence labeling of manga metadata from web pages.
"""

import torch
import torch.nn as nn
from torchcrf import CRF
from transformers import LayoutLMv3Model, LayoutLMv3Config
from typing import Optional, Tuple, Dict, Any

from .config import ModelConfig, LABEL2ID, ID2LABEL


class FeatureProjection(nn.Module):
    """Projects additional DOM/visual features into hidden space."""

    def __init__(self, input_dim: int, hidden_dim: int, dropout: float = 0.1):
        super().__init__()
        self.projection = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
        )

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        return self.projection(features)


class TransformerCRF(nn.Module):
    """
    Transformer-CRF model for web information extraction.

    Architecture:
    - LayoutLMv3 encoder for text + layout understanding
    - Feature projection for additional DOM features
    - Linear classifier
    - CRF layer for sequence labeling
    """

    def __init__(self, config: ModelConfig):
        super().__init__()
        self.config = config

        # LayoutLMv3 encoder
        self.encoder = LayoutLMv3Model.from_pretrained(config.encoder_name)
        encoder_hidden_size = self.encoder.config.hidden_size

        # Feature projection for DOM features
        self.feature_proj = FeatureProjection(
            config.feature_dim,
            config.hidden_dim,
            config.dropout
        )

        # Combine encoder output with projected features
        self.combiner = nn.Sequential(
            nn.Linear(encoder_hidden_size + config.hidden_dim, config.hidden_dim),
            nn.ReLU(),
            nn.Dropout(config.dropout),
        )

        # Classification head
        self.classifier = nn.Linear(config.hidden_dim, config.num_labels)

        # CRF layer
        if config.use_crf:
            self.crf = CRF(config.num_labels, batch_first=True)
        else:
            self.crf = None

        # Label mappings
        self.label2id = LABEL2ID
        self.id2label = ID2LABEL

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        bbox: Optional[torch.Tensor] = None,
        pixel_values: Optional[torch.Tensor] = None,
        features: Optional[torch.Tensor] = None,
        labels: Optional[torch.Tensor] = None,
    ) -> Dict[str, Any]:
        """
        Forward pass.

        Args:
            input_ids: Token IDs [batch, seq_len]
            attention_mask: Attention mask [batch, seq_len]
            bbox: Bounding boxes [batch, seq_len, 4] (optional)
            pixel_values: Image pixels [batch, 3, H, W] (optional)
            features: Additional DOM features [batch, seq_len, feature_dim]
            labels: Ground truth labels [batch, seq_len] (for training)

        Returns:
            Dictionary with loss (if training) and predictions
        """
        # Encode with LayoutLMv3
        encoder_outputs = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            bbox=bbox,
            pixel_values=pixel_values,
        )
        hidden_states = encoder_outputs.last_hidden_state  # [batch, seq_len, hidden]

        # Project additional features if provided
        if features is not None:
            feature_hidden = self.feature_proj(features)
            combined = torch.cat([hidden_states, feature_hidden], dim=-1)
        else:
            # Pad with zeros if no features
            batch_size, seq_len, _ = hidden_states.shape
            zero_features = torch.zeros(
                batch_size, seq_len, self.config.hidden_dim,
                device=hidden_states.device
            )
            combined = torch.cat([hidden_states, zero_features], dim=-1)

        # Combine and classify
        combined = self.combiner(combined)
        emissions = self.classifier(combined)  # [batch, seq_len, num_labels]

        output = {"emissions": emissions}

        if labels is not None:
            # Training mode: compute loss
            if self.crf is not None:
                # CRF loss (negative log-likelihood)
                mask = attention_mask.bool()
                loss = -self.crf(emissions, labels, mask=mask, reduction="mean")
            else:
                # Cross-entropy loss
                loss_fct = nn.CrossEntropyLoss()
                active_loss = attention_mask.view(-1) == 1
                active_logits = emissions.view(-1, self.config.num_labels)
                active_labels = torch.where(
                    active_loss,
                    labels.view(-1),
                    torch.tensor(loss_fct.ignore_index).type_as(labels)
                )
                loss = loss_fct(active_logits, active_labels)

            output["loss"] = loss

        return output

    def decode(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        bbox: Optional[torch.Tensor] = None,
        pixel_values: Optional[torch.Tensor] = None,
        features: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Decode predictions using Viterbi algorithm (CRF) or argmax.

        Returns:
            Tuple of (predictions, confidence_scores)
        """
        with torch.no_grad():
            output = self.forward(
                input_ids=input_ids,
                attention_mask=attention_mask,
                bbox=bbox,
                pixel_values=pixel_values,
                features=features,
            )
            emissions = output["emissions"]

            if self.crf is not None:
                # CRF Viterbi decode
                mask = attention_mask.bool()
                predictions = self.crf.decode(emissions, mask=mask)
                # Pad predictions to match sequence length
                max_len = emissions.size(1)
                padded_predictions = []
                for pred in predictions:
                    padded = pred + [0] * (max_len - len(pred))
                    padded_predictions.append(padded)
                predictions = torch.tensor(padded_predictions, device=emissions.device)
                # Confidence from emission scores
                confidence = torch.softmax(emissions, dim=-1).max(dim=-1).values
            else:
                # Argmax decode
                predictions = emissions.argmax(dim=-1)
                confidence = torch.softmax(emissions, dim=-1).max(dim=-1).values

            return predictions, confidence

    def get_transition_matrix(self) -> Optional[torch.Tensor]:
        """Get CRF transition matrix for export."""
        if self.crf is not None:
            return self.crf.transitions.detach()
        return None


def create_model(config: Optional[ModelConfig] = None) -> TransformerCRF:
    """Factory function to create model."""
    if config is None:
        config = ModelConfig()
    return TransformerCRF(config)
