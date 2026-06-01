"""Download the ONNX models the cover layerizer needs, if missing.

    python download_models.py --models-dir ./models
"""

from __future__ import annotations

import argparse
import pathlib
import urllib.request

MODELS = {
    # Anime-tuned IS-Net foreground segmentation (SkyTNT anime-seg). Apache-2.0.
    "isnetis.onnx": "https://huggingface.co/skytnt/anime-seg/resolve/main/isnetis.onnx",
    # LaMa inpainting, ONNX export (fixed 512x512). Apache-2.0.
    "lama_fp32.onnx": "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models-dir", required=True, type=pathlib.Path)
    args = ap.parse_args()
    args.models_dir.mkdir(parents=True, exist_ok=True)
    for name, url in MODELS.items():
        dest = args.models_dir / name
        if dest.exists() and dest.stat().st_size > 1_000_000:
            print(f"have {name} ({dest.stat().st_size // 1_000_000} MB)", flush=True)
            continue
        print(f"downloading {name} ...", flush=True)
        urllib.request.urlretrieve(url, dest)
        print(f"  -> {dest} ({dest.stat().st_size // 1_000_000} MB)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
