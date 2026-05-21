# Transformer-CRF Model for Manga Metadata Extraction

This directory contains the Python ML training pipeline for the web information extraction model.

## Architecture

- **Encoder**: LayoutLMv3 (microsoft/layoutlmv3-base)
- **Decoder**: CRF (Conditional Random Field)
- **Task**: BIO sequence labeling for 16 entity types

## Entity Types

```
TITLE, ALT_TITLE, AUTHOR, ARTIST, SUMMARY, STATUS, GENRE,
VOLUME_COUNT, CHAPTER_COUNT, VOLUME_TITLE, CHAPTER_TITLE,
RELEASE_DATE, PUBLISHER, MAGAZINE, COVER_IMAGE, DEMOGRAPHIC
```

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt
```

## Training

```bash
# Prepare training data (from Node.js annotation system)
# Data should be exported to data/processed/

# Train model
python scripts/train.py --epochs 20 --batch-size 8

# Export to ONNX for Node.js inference
python scripts/export_onnx.py --model outputs/best_model.pt --output models/
```

## Directory Structure

```
ml/
├── src/
│   ├── __init__.py
│   ├── config.py      # Training configuration
│   └── model.py       # Transformer-CRF model
├── scripts/
│   ├── train.py       # Training script
│   └── export_onnx.py # ONNX export
├── data/
│   ├── raw/           # Raw HTML snapshots
│   ├── processed/     # Tokenized + labeled data
│   └── splits/        # Train/val/test splits
├── models/            # Trained models + ONNX
├── outputs/           # Training outputs
├── notebooks/         # Jupyter notebooks
└── requirements.txt
```

## Integration with Node.js

After training and export:
1. Copy `models/transformer_crf.onnx` to the Node.js project
2. Copy `models/crf_params.json` for Viterbi decoding
3. Use `onnxruntime-node` for inference

See `src/server/ml/inference/` for the Node.js integration.
