#!/usr/bin/env python3
"""
Training Script for Transformer-CRF Model

Trains the LayoutLMv3-CRF model on annotated manga pages.

Usage:
    python scripts/train.py --config config.yaml
    python scripts/train.py --epochs 10 --batch-size 4
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict, Any, List

import torch
from torch.utils.data import DataLoader, Dataset
from torch.optim import AdamW
from transformers import get_linear_schedule_with_warmup, AutoTokenizer
from tqdm import tqdm

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import ModelConfig, TrainingConfig, DataConfig, BIO_LABELS, LABEL2ID
from src.model import create_model


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class AnnotatedPageDataset(Dataset):
    """Dataset for annotated pages."""

    def __init__(
        self,
        data_path: str,
        tokenizer: Any,
        max_length: int = 512,
    ):
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.examples = self._load_data(data_path)

    def _load_data(self, data_path: str) -> List[Dict[str, Any]]:
        """Load annotated pages from JSON file."""
        if not os.path.exists(data_path):
            logger.warning(f"Data file not found: {data_path}")
            return []

        with open(data_path, "r") as f:
            data = json.load(f)

        return data

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        example = self.examples[idx]

        # Tokenize text tokens
        tokens = [t["text"] for t in example["tokens"]]
        labels = example["labels"]

        # Convert to model inputs
        encoding = self.tokenizer(
            tokens,
            is_split_into_words=True,
            max_length=self.max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )

        # Align labels with tokenized input
        word_ids = encoding.word_ids()
        aligned_labels = []
        previous_word_idx = None

        for word_idx in word_ids:
            if word_idx is None:
                aligned_labels.append(-100)  # Ignore padding
            elif word_idx != previous_word_idx:
                # First token of word
                label_str = labels[word_idx] if word_idx < len(labels) else "O"
                aligned_labels.append(LABEL2ID.get(label_str, 0))
            else:
                # Subsequent tokens of same word - use I- tag
                label_str = labels[word_idx] if word_idx < len(labels) else "O"
                if label_str.startswith("B-"):
                    label_str = "I-" + label_str[2:]
                aligned_labels.append(LABEL2ID.get(label_str, 0))
            previous_word_idx = word_idx

        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "labels": torch.tensor(aligned_labels, dtype=torch.long),
        }


def train_epoch(
    model: torch.nn.Module,
    dataloader: DataLoader,
    optimizer: torch.optim.Optimizer,
    scheduler: Any,
    device: torch.device,
) -> float:
    """Train for one epoch."""
    model.train()
    total_loss = 0.0

    progress = tqdm(dataloader, desc="Training")
    for batch in progress:
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = batch["labels"].to(device)

        optimizer.zero_grad()

        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=labels,
        )

        loss = outputs["loss"]
        loss.backward()

        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()

        total_loss += loss.item()
        progress.set_postfix({"loss": f"{loss.item():.4f}"})

    return total_loss / len(dataloader)


def evaluate(
    model: torch.nn.Module,
    dataloader: DataLoader,
    device: torch.device,
) -> Dict[str, float]:
    """Evaluate model on validation set."""
    model.eval()
    total_loss = 0.0
    all_predictions = []
    all_labels = []

    with torch.no_grad():
        for batch in tqdm(dataloader, desc="Evaluating"):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels,
            )

            total_loss += outputs["loss"].item()

            # Get predictions
            predictions, _ = model.decode(
                input_ids=input_ids,
                attention_mask=attention_mask,
            )

            # Collect for metrics
            for pred, label, mask in zip(predictions, labels, attention_mask):
                mask_bool = mask.bool()
                valid_preds = pred[mask_bool].tolist()
                valid_labels = label[mask_bool].tolist()
                # Filter out -100 (padding)
                valid_labels = [l for l in valid_labels if l != -100]
                valid_preds = valid_preds[:len(valid_labels)]
                all_predictions.append(valid_preds)
                all_labels.append(valid_labels)

    # Compute metrics
    avg_loss = total_loss / len(dataloader)

    # Simple accuracy
    correct = 0
    total = 0
    for preds, labels in zip(all_predictions, all_labels):
        for p, l in zip(preds, labels):
            if l != -100:
                total += 1
                if p == l:
                    correct += 1

    accuracy = correct / total if total > 0 else 0.0

    return {
        "loss": avg_loss,
        "accuracy": accuracy,
    }


def main():
    parser = argparse.ArgumentParser(description="Train Transformer-CRF model")
    parser.add_argument("--epochs", type=int, default=20, help="Number of epochs")
    parser.add_argument("--batch-size", type=int, default=8, help="Batch size")
    parser.add_argument("--lr", type=float, default=2e-5, help="Learning rate")
    parser.add_argument("--data-dir", type=str, default="data/processed", help="Data directory")
    parser.add_argument("--output-dir", type=str, default="outputs", help="Output directory")
    parser.add_argument("--device", type=str, default="auto", help="Device (cuda/cpu/auto)")
    args = parser.parse_args()

    # Setup device
    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(args.device)
    logger.info(f"Using device: {device}")

    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)

    # Initialize model and tokenizer
    model_config = ModelConfig()
    model = create_model(model_config)
    model.to(device)

    tokenizer = AutoTokenizer.from_pretrained(model_config.encoder_name)

    # Load datasets
    train_dataset = AnnotatedPageDataset(
        f"{args.data_dir}/train.json",
        tokenizer,
    )
    val_dataset = AnnotatedPageDataset(
        f"{args.data_dir}/val.json",
        tokenizer,
    )

    if len(train_dataset) == 0:
        logger.error("No training data found. Run data collection first.")
        return

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size)

    # Optimizer and scheduler
    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    total_steps = len(train_loader) * args.epochs
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=int(0.1 * total_steps),
        num_training_steps=total_steps,
    )

    # Training loop
    best_val_loss = float("inf")
    patience_counter = 0

    for epoch in range(args.epochs):
        logger.info(f"Epoch {epoch + 1}/{args.epochs}")

        train_loss = train_epoch(model, train_loader, optimizer, scheduler, device)
        logger.info(f"Train loss: {train_loss:.4f}")

        if len(val_dataset) > 0:
            val_metrics = evaluate(model, val_loader, device)
            logger.info(f"Val loss: {val_metrics['loss']:.4f}, Accuracy: {val_metrics['accuracy']:.4f}")

            if val_metrics["loss"] < best_val_loss:
                best_val_loss = val_metrics["loss"]
                patience_counter = 0
                # Save best model
                torch.save(model.state_dict(), f"{args.output_dir}/best_model.pt")
                logger.info("Saved best model")
            else:
                patience_counter += 1
                if patience_counter >= 5:
                    logger.info("Early stopping triggered")
                    break

    # Save final model
    torch.save(model.state_dict(), f"{args.output_dir}/final_model.pt")
    logger.info(f"Training complete. Models saved to {args.output_dir}")


if __name__ == "__main__":
    main()
