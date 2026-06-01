"""Cover layerizer — turns a flat manga cover into living-cover layers.

Pipeline (proven on the real cover cache, see docs):
  1. Segment the character with the anime-tuned IS-Net model (isnetis.onnx).
  2. Gate on foreground coverage: if the cutout is empty (model didn't find a
     character, e.g. painterly art) or full-bleed (nothing to parallax), emit a
     `flat` manifest and stop — the app falls back to the static cover.
  3. Otherwise inpaint the character-shaped hole with LaMa (lama_fp32.onnx) to
     get a clean background plate, and write:
        character.webp  (RGBA, full-frame, static foreground layer)
        background.webp  (opaque RGB, the layer that drifts)
        manifest.json    (layer + motion description for <LivingCover>)

ONNX-only (onnxruntime + numpy + pillow). CPU on Mac dev, CUDA on prod — the
same .onnx files run in both; only the execution provider differs.

Usage:
    python layerize.py --cover /path/cover.jpg --id 4948 --out /path/out \
        --models-dir ./models --device cpu
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

# --- Tunables -------------------------------------------------------------

SEG_SIZE = 1024            # IS-Net input (letterboxed, aspect preserved)
LAMA_SIZE = 512            # LaMa ONNX is fixed 512x512
ALPHA_THRESHOLD = 40       # alpha>this counts as "character" when building the hole
HOLE_DILATE_FRAC = 0.012   # grow the hole by ~1.2% of the short side (hide fringe)
GATE_LOW = 0.10            # below this fg coverage -> nothing found -> flat
GATE_HIGH = 0.92           # above this -> full-bleed, no background to move -> flat

# Background drift, as a % of cover dimension. Kept small so the (slightly
# distorted) inpainted plate and any baked title text drift only subtly.
BG_AMP_PCT = (1.6, 1.0)
BG_DURATION_MS = 16000

PROVIDERS = {
    "cpu": ["CPUExecutionProvider"],
    "cuda": ["CUDAExecutionProvider", "CPUExecutionProvider"],
    "coreml": ["CoreMLExecutionProvider", "CPUExecutionProvider"],
}


# --- Segmentation ---------------------------------------------------------

def infer_alpha(sess: ort.InferenceSession, img: Image.Image) -> Image.Image:
    """Run IS-Net; return a single-channel (L) matte at the original size."""
    in_name = sess.get_inputs()[0].name
    out_name = sess.get_outputs()[0].name
    w0, h0 = img.size
    if h0 > w0:
        h, w = SEG_SIZE, max(1, round(SEG_SIZE * w0 / h0))
    else:
        h, w = max(1, round(SEG_SIZE * h0 / w0)), SEG_SIZE
    ph, pw = (SEG_SIZE - h) // 2, (SEG_SIZE - w) // 2
    resized = img.convert("RGB").resize((w, h), Image.BILINEAR)
    canvas = np.zeros((SEG_SIZE, SEG_SIZE, 3), dtype=np.float32)
    canvas[ph:ph + h, pw:pw + w] = np.asarray(resized, dtype=np.float32) / 255.0
    inp = np.transpose(canvas, (2, 0, 1))[None]
    mask = np.squeeze(sess.run([out_name], {in_name: inp})[0])
    mask = mask[ph:ph + h, pw:pw + w]
    mask = (np.clip(mask, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(mask, mode="L").resize((w0, h0), Image.BILINEAR)


def refine_alpha(alpha: Image.Image) -> Image.Image:
    """Erode 1px + slight blur to kill the bright halo at the cutout edge."""
    eroded = alpha.filter(ImageFilter.MinFilter(3))
    return eroded.filter(ImageFilter.GaussianBlur(0.8))


# --- Inpainting -----------------------------------------------------------

def lama_fill(sess: ort.InferenceSession, rgb: Image.Image, hole: Image.Image) -> Image.Image:
    """Fill the white region of `hole` in `rgb` with LaMa; return full-res RGB."""
    in_img = sess.get_inputs()[0].name
    in_mask = sess.get_inputs()[1].name
    out_name = sess.get_outputs()[0].name
    w0, h0 = rgb.size
    img_s = np.asarray(rgb.convert("RGB").resize((LAMA_SIZE, LAMA_SIZE), Image.BILINEAR), np.float32) / 255.0
    msk_s = np.asarray(hole.resize((LAMA_SIZE, LAMA_SIZE), Image.NEAREST), np.float32) / 255.0
    msk_s = (msk_s > 0.5).astype(np.float32)
    out = np.squeeze(sess.run([out_name], {in_img: np.transpose(img_s, (2, 0, 1))[None],
                                           in_mask: msk_s[None, None]})[0])
    if out.shape[0] == 3:
        out = np.transpose(out, (1, 2, 0))
    if out.max() <= 1.5:
        out = out * 255.0
    filled = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((w0, h0), Image.BILINEAR)
    soft = hole.filter(ImageFilter.GaussianBlur(3))
    return Image.composite(filled, rgb.convert("RGB"), soft)


def build_hole(alpha: Image.Image, short_side: int) -> Image.Image:
    """Dilate the thresholded character alpha into the inpaint hole."""
    grow = max(6, round(short_side * HOLE_DILATE_FRAC))
    k = grow if grow % 2 == 1 else grow + 1
    binary = alpha.point(lambda v: 255 if v > ALPHA_THRESHOLD else 0)
    return binary.filter(ImageFilter.MaxFilter(min(k, 31)))


# --- Manifest -------------------------------------------------------------

def flat_manifest(cover_id: str, src_hash: str, size: tuple[int, int], coverage: float, reason: str) -> dict:
    return {
        "schemaVersion": 1,
        "coverId": cover_id,
        "sourceHash": src_hash,
        "w": size[0], "h": size[1],
        "fgCoverage": round(coverage, 4),
        "mode": "flat",
        "reason": reason,
        "layers": [],
    }


def layered_manifest(cover_id: str, src_hash: str, size: tuple[int, int], coverage: float) -> dict:
    return {
        "schemaVersion": 1,
        "coverId": cover_id,
        "sourceHash": src_hash,
        "w": size[0], "h": size[1],
        "fgCoverage": round(coverage, 4),
        "mode": "layered",
        "layers": [
            {
                "id": "bg", "role": "background", "file": "background.webp", "z": 0,
                "motion": {
                    "type": "drift",
                    "ampPct": list(BG_AMP_PCT),
                    "scaleAmp": 0.0,
                    "durationMs": BG_DURATION_MS,
                    "easing": "ease-in-out",
                    "alternate": True,
                },
            },
            # Character stays locked in frame — no motion.
            {"id": "char", "role": "character", "file": "character.webp", "z": 10, "motion": None},
        ],
    }


# --- Main -----------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="Layerize a manga cover for living-cover animation.")
    ap.add_argument("--cover", required=True, type=pathlib.Path)
    ap.add_argument("--id", required=True, help="manga/cover id (manifest coverId)")
    ap.add_argument("--out", required=True, type=pathlib.Path)
    ap.add_argument("--models-dir", required=True, type=pathlib.Path)
    ap.add_argument("--device", choices=list(PROVIDERS), default="cpu")
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    providers = PROVIDERS[args.device]

    raw = args.cover.read_bytes()
    src_hash = "sha256:" + hashlib.sha256(raw).hexdigest()
    img = Image.open(args.cover).convert("RGBA")
    size = img.size
    short_side = min(size)

    seg = ort.InferenceSession(str(args.models_dir / "isnetis.onnx"), providers=providers)
    alpha = refine_alpha(infer_alpha(seg, img))
    coverage = float(np.asarray(alpha).mean()) / 255.0

    def write_manifest(m: dict) -> None:
        (args.out / "manifest.json").write_text(json.dumps(m, indent=2))

    if coverage < GATE_LOW or coverage > GATE_HIGH:
        reason = "no-subject" if coverage < GATE_LOW else "full-bleed"
        write_manifest(flat_manifest(args.id, src_hash, size, coverage, reason))
        print(f"FLAT {args.id}: coverage={coverage:.0%} ({reason})", flush=True)
        return 0

    # Foreground layer (locked character).
    char = img.copy()
    char.putalpha(alpha)
    char.save(args.out / "character.webp", "WEBP", quality=90, method=6)

    # Background plate (the layer that drifts).
    hole = build_hole(alpha, short_side)
    lama = ort.InferenceSession(str(args.models_dir / "lama_fp32.onnx"), providers=providers)
    plate = lama_fill(lama, img.convert("RGB"), hole)
    plate.save(args.out / "background.webp", "WEBP", quality=88, method=6)

    write_manifest(layered_manifest(args.id, src_hash, size, coverage))
    print(f"LAYERED {args.id}: coverage={coverage:.0%}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
