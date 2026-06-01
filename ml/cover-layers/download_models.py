"""Download the ONNX models the cover layerizer needs, if missing.

    python download_models.py --models-dir ./models
"""

from __future__ import annotations

import argparse
import pathlib
import urllib.request

# Required — the cutout + inpaint backbone.
MODELS = {
    # Anime-tuned IS-Net foreground segmentation (SkyTNT anime-seg). Apache-2.0.
    "isnetis.onnx": "https://huggingface.co/skytnt/anime-seg/resolve/main/isnetis.onnx",
    # LaMa inpainting, ONNX export (fixed 512x512). Apache-2.0.
    "lama_fp32.onnx": "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx",
}

# Optional — enable the text layer and depth-band parallax stages. A missing
# optional model just skips its stage; the pipeline still produces a cover.
OPTIONAL_MODELS = {
    # PP-OCRv4 DBNet text detector (RapidOCR mirror) — script-agnostic (JP/EN). Apache-2.0.
    "text_det.onnx": "https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_det_infer.onnx",
    # MiDaS v2.1 small monocular depth (inverse depth) for depth banding. MIT.
    "depth.onnx": "https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx",
    # MobileSAM (Tiny-ViT) — object segmentation for the `sam` segmenter. Apache-2.0.
    "sam_encoder.onnx": "https://huggingface.co/Acly/MobileSAM/resolve/main/mobile_sam_image_encoder.onnx",
    "sam_decoder.onnx": "https://huggingface.co/Acly/MobileSAM/resolve/main/sam_mask_decoder_multi.onnx",
    # WD14 anime tagger — drives the `smartEffects` mood presets. Apache-2.0.
    "tagger.onnx": "https://huggingface.co/SmilingWolf/wd-vit-tagger-v3/resolve/main/model.onnx",
    "tagger_tags.csv": "https://huggingface.co/SmilingWolf/wd-vit-tagger-v3/resolve/main/selected_tags.csv",
}


def _emit(idx: int, count: int, name: str, pct: int) -> None:
    """Machine-readable progress line consumed by the cover-layerizer service."""
    print(f"PROGRESS|{idx}|{count}|{name}|{pct}", flush=True)


def fetch(models_dir: pathlib.Path, name: str, url: str, *, required: bool, idx: int, count: int) -> None:
    dest = models_dir / name
    if dest.exists() and dest.stat().st_size > 1_000_000:
        print(f"have {name} ({dest.stat().st_size // 1_000_000} MB)", flush=True)
        _emit(idx, count, name, 100)
        return
    tag = "" if required else " (optional)"
    print(f"downloading {name}{tag} ...", flush=True)
    last = -1

    def hook(block_num: int, block_size: int, total_size: int) -> None:
        nonlocal last
        if total_size <= 0:
            return
        pct = min(100, int(block_num * block_size * 100 / total_size))
        if pct != last:
            last = pct
            _emit(idx, count, name, pct)

    try:
        urllib.request.urlretrieve(url, dest, reporthook=hook)
        _emit(idx, count, name, 100)
        print(f"  -> {dest} ({dest.stat().st_size // 1_000_000} MB)", flush=True)
    except Exception as err:  # noqa: BLE001 - optional models must not abort the run
        if required:
            raise
        dest.unlink(missing_ok=True)
        _emit(idx, count, name, 100)
        print(f"  !! skipped {name}: {err}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models-dir", required=True, type=pathlib.Path)
    args = ap.parse_args()
    args.models_dir.mkdir(parents=True, exist_ok=True)
    items = [(name, url, True) for name, url in MODELS.items()] + [
        (name, url, False) for name, url in OPTIONAL_MODELS.items()
    ]
    count = len(items)
    for idx, (name, url, required) in enumerate(items, start=1):
        fetch(args.models_dir, name, url, required=required, idx=idx, count=count)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
