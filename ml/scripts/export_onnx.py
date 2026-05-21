#!/usr/bin/env python3
"""
ONNX Export Script

Exports trained Transformer-CRF model to ONNX format for Node.js inference.

Usage:
    python scripts/export_onnx.py --model outputs/best_model.pt --output models/
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

import torch
import onnx
from onnxruntime import InferenceSession

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import ModelConfig, ExportConfig, BIO_LABELS, LABEL2ID, ID2LABEL
from src.model import create_model


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def export_to_onnx(
    model: torch.nn.Module,
    output_path: str,
    max_seq_length: int = 512,
    opset_version: int = 14,
) -> None:
    """Export model to ONNX format."""
    model.eval()

    # Create dummy inputs
    batch_size = 1
    dummy_input_ids = torch.zeros(batch_size, max_seq_length, dtype=torch.long)
    dummy_attention_mask = torch.ones(batch_size, max_seq_length, dtype=torch.long)

    # Export encoder + classifier (CRF decoded in JS)
    class EncoderWrapper(torch.nn.Module):
        def __init__(self, full_model):
            super().__init__()
            self.model = full_model

        def forward(self, input_ids, attention_mask):
            outputs = self.model(
                input_ids=input_ids,
                attention_mask=attention_mask,
            )
            return outputs["emissions"]

    wrapper = EncoderWrapper(model)

    # Export
    torch.onnx.export(
        wrapper,
        (dummy_input_ids, dummy_attention_mask),
        output_path,
        input_names=["input_ids", "attention_mask"],
        output_names=["emissions"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "sequence"},
            "attention_mask": {0: "batch", 1: "sequence"},
            "emissions": {0: "batch", 1: "sequence"},
        },
        opset_version=opset_version,
        do_constant_folding=True,
    )

    logger.info(f"Model exported to {output_path}")


def export_crf_params(model: torch.nn.Module, output_dir: str) -> None:
    """Export CRF transition matrix for JS Viterbi decoder."""
    if model.crf is None:
        logger.warning("Model does not use CRF, skipping transition export")
        return

    transitions = model.crf.transitions.detach().cpu().numpy().tolist()
    start_transitions = model.crf.start_transitions.detach().cpu().numpy().tolist()
    end_transitions = model.crf.end_transitions.detach().cpu().numpy().tolist()

    crf_params = {
        "transitions": transitions,
        "start_transitions": start_transitions,
        "end_transitions": end_transitions,
        "num_tags": len(BIO_LABELS),
        "label2id": LABEL2ID,
        "id2label": ID2LABEL,
    }

    output_path = os.path.join(output_dir, "crf_params.json")
    with open(output_path, "w") as f:
        json.dump(crf_params, f, indent=2)

    logger.info(f"CRF parameters exported to {output_path}")


def validate_onnx(onnx_path: str) -> bool:
    """Validate exported ONNX model."""
    try:
        model = onnx.load(onnx_path)
        onnx.checker.check_model(model)
        logger.info("ONNX model validation passed")
        return True
    except Exception as e:
        logger.error(f"ONNX validation failed: {e}")
        return False


def test_inference(onnx_path: str) -> bool:
    """Test ONNX model inference."""
    try:
        session = InferenceSession(onnx_path)

        # Create test input
        input_ids = [[101] + [0] * 510 + [102]]  # [CLS] ... [SEP]
        attention_mask = [[1] * 512]

        outputs = session.run(
            None,
            {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
            }
        )

        emissions = outputs[0]
        logger.info(f"Test inference successful. Output shape: {emissions.shape}")
        return True
    except Exception as e:
        logger.error(f"Test inference failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Export model to ONNX")
    parser.add_argument("--model", type=str, required=True, help="Path to model checkpoint")
    parser.add_argument("--output", type=str, default="models", help="Output directory")
    parser.add_argument("--opset", type=int, default=14, help="ONNX opset version")
    parser.add_argument("--max-length", type=int, default=512, help="Max sequence length")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)

    # Load model
    config = ModelConfig()
    model = create_model(config)

    if os.path.exists(args.model):
        model.load_state_dict(torch.load(args.model, map_location="cpu"))
        logger.info(f"Loaded model from {args.model}")
    else:
        logger.warning(f"Model file not found: {args.model}. Using untrained model.")

    # Export ONNX
    onnx_path = os.path.join(args.output, "transformer_crf.onnx")
    export_to_onnx(model, onnx_path, args.max_length, args.opset)

    # Export CRF parameters
    export_crf_params(model, args.output)

    # Validate
    if validate_onnx(onnx_path):
        test_inference(onnx_path)

    logger.info("Export complete!")


if __name__ == "__main__":
    main()
