#!/usr/bin/env bash
#
# One-time provisioning for the grounded-sam tier (Option C).
#
# Installs PyTorch + transformers (the only heavy deps) and downloads the
# GroundingDINO weights. After this runs, Settings → Living Covers → Separation
# quality → "Grounded-SAM" becomes selectable (the availability probe gates on
# the weights being present, which this fetches).
#
# Honors the same env the layerizer service uses:
#   COVER_LAYER_PYTHON      uv (default, dev/M4) or a python interpreter (container)
#   COVER_LAYER_MODELS_DIR  where models live (default: data/cache/cover-layer-models)
#
# Usage:  ./ml/cover-layers/provision-grounded-sam.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_MODELS_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)/data/cache/cover-layer-models"
MODELS_DIR="${COVER_LAYER_MODELS_DIR:-${DEFAULT_MODELS_DIR}}"
RUNNER="${COVER_LAYER_PYTHON:-uv}"

mkdir -p "${MODELS_DIR}"
echo "Provisioning grounded-sam (PyTorch + GroundingDINO weights)"
echo "  runner:     ${RUNNER}"
echo "  models dir: ${MODELS_DIR}"
echo "  note: first run downloads ~2-3 GB of torch wheels — give it a few minutes."

if [ "${RUNNER}" = "uv" ]; then
  # uv installs --with deps into a cached env; the layerizer reuses the exact
  # same dep set, so its probe/run hit the warm cache. Pins: transformers<4.46
  # keeps GroundingDINO usable with the torch the macOS wheel provides; numpy<2
  # matches torch's build ABI.
  uv run --python 3.11 \
    --with onnxruntime --with 'numpy<2' --with pillow \
    --with torch --with 'transformers<4.46' --with huggingface_hub \
    python "${SCRIPT_DIR}/download_models.py" --tier grounded-sam --models-dir "${MODELS_DIR}"
else
  "${RUNNER}" -m pip install --upgrade torch 'transformers<4.46' huggingface_hub 'numpy<2'
  "${RUNNER}" "${SCRIPT_DIR}/download_models.py" --tier grounded-sam --models-dir "${MODELS_DIR}"
fi

echo
echo "Done. Reload Settings → Living Covers; 'Grounded-SAM' should now be selectable."
echo "Then set Separation quality to Grounded-SAM and run Process Library Covers."
