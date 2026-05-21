"""
Training Configuration for Transformer-CRF Model

Defines hyperparameters and model configuration for the
LayoutLMv3-CRF web information extraction model.
"""

from dataclasses import dataclass, field
from typing import List, Optional


# BIO Tag Schema
BIO_LABELS = [
    "O",
    "B-TITLE", "I-TITLE",
    "B-ALT_TITLE", "I-ALT_TITLE",
    "B-AUTHOR", "I-AUTHOR",
    "B-ARTIST", "I-ARTIST",
    "B-SUMMARY", "I-SUMMARY",
    "B-STATUS", "I-STATUS",
    "B-GENRE", "I-GENRE",
    "B-VOLUME_COUNT", "I-VOLUME_COUNT",
    "B-CHAPTER_COUNT", "I-CHAPTER_COUNT",
    "B-VOLUME_TITLE", "I-VOLUME_TITLE",
    "B-CHAPTER_TITLE", "I-CHAPTER_TITLE",
    "B-RELEASE_DATE", "I-RELEASE_DATE",
    "B-PUBLISHER", "I-PUBLISHER",
    "B-MAGAZINE", "I-MAGAZINE",
    "B-COVER_IMAGE", "I-COVER_IMAGE",
    "B-DEMOGRAPHIC", "I-DEMOGRAPHIC",
]

LABEL2ID = {label: idx for idx, label in enumerate(BIO_LABELS)}
ID2LABEL = {idx: label for idx, label in enumerate(BIO_LABELS)}


@dataclass
class ModelConfig:
    """Model architecture configuration."""

    encoder_name: str = "microsoft/layoutlmv3-base"
    num_labels: int = len(BIO_LABELS)
    hidden_dim: int = 256
    feature_dim: int = 64  # Additional DOM/visual features
    dropout: float = 0.1
    use_crf: bool = True


@dataclass
class TrainingConfig:
    """Training hyperparameters."""

    # Training
    batch_size: int = 8
    learning_rate: float = 2e-5
    num_epochs: int = 20
    warmup_ratio: float = 0.1
    weight_decay: float = 0.01
    max_grad_norm: float = 1.0

    # Sequence length
    max_seq_length: int = 512

    # Data splits
    train_ratio: float = 0.8
    val_ratio: float = 0.1
    test_ratio: float = 0.1

    # Regularization
    label_smoothing: float = 0.1

    # Early stopping
    patience: int = 5
    min_delta: float = 0.001

    # Checkpointing
    save_steps: int = 500
    eval_steps: int = 100
    logging_steps: int = 50

    # Reproducibility
    seed: int = 42


@dataclass
class DataConfig:
    """Data paths and processing configuration."""

    data_dir: str = "data"
    raw_dir: str = "data/raw"
    processed_dir: str = "data/processed"
    splits_dir: str = "data/splits"
    output_dir: str = "outputs"
    model_dir: str = "models"

    # Processing
    min_tokens: int = 10
    max_tokens: int = 2000

    # Sources to include
    sources: List[str] = field(
        default_factory=lambda: ["FANDOM", "WIKIPEDIA", "ANILIST", "COMICVINE"]
    )


@dataclass
class ExportConfig:
    """ONNX export configuration."""

    onnx_path: str = "models/transformer_crf.onnx"
    opset_version: int = 14
    dynamic_axes: bool = True
    optimize: bool = True


def get_default_config() -> dict:
    """Get default configuration as dictionary."""
    return {
        "model": ModelConfig().__dict__,
        "training": TrainingConfig().__dict__,
        "data": DataConfig().__dict__,
        "export": ExportConfig().__dict__,
    }
