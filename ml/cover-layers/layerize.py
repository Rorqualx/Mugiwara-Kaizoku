"""Cover layerizer — turns a flat manga cover into living-cover layers.

Pipeline (proven on the real cover cache, see docs):
  1. Segment the character with the anime-tuned IS-Net model (isnetis.onnx).
  2. Detect title/credit text regions with a DBNet text detector
     (text_det.onnx, optional) — used both to lift the text onto its own layer
     and to mask it out of the background plate so it never ghosts.
  3. Gate on what was found: if there's neither a usable character nor any text
     (painterly art) or the character is full-bleed with no text, emit a `flat`
     manifest and stop — the app falls back to the static cover.
  4. Inpaint the character+text hole with LaMa (lama_fp32.onnx) for a clean plate.
  5. Optionally split the plate into depth bands with a monocular depth model
     (depth.onnx, optional): nearer scenery drifts more than the far plate, for
     real multi-plane parallax. Without the model it stays a single plate.
  6. Write the layers (background plate / near band / character / text) + a
     manifest describing each layer's z-order and drift motion for <LivingCover>.

ONNX-only (onnxruntime + numpy + pillow). CPU on Mac dev, CUDA on prod — the
same .onnx files run in both; only the execution provider differs. The text and
depth models are optional: a missing model simply skips its stage, so the
pipeline always produces *something* renderable.

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
GATE_LOW = 0.10            # below this fg coverage -> no character
GATE_HIGH = 0.92           # above this -> full-bleed character

# Text detection (DBNet). Optional model `text_det.onnx`.
DET_MAX_SIDE = 960         # longest side fed to the detector (downscaled, /32)
DET_THRESH = 0.3           # DBNet probability over this counts as text
TEXT_MIN_FRAC = 0.004      # extract a text layer above this (when a character exists)
TEXT_UNLOCK_FRAC = 0.02    # text ALONE only animates a character-less cover above this
TEXT_DILATE_FRAC = 0.006   # grow text mask before inpainting (cover glyph fringe)

# Depth banding. Optional model `depth.onnx`.
NEAR_PERCENTILE = 62       # depth >= this percentile -> "near" band
NEAR_MIN_FRAC = 0.04       # skip banding if the near band is tiny...
NEAR_MAX_FRAC = 0.85       # ...or basically the whole frame (no depth structure)
BAND_FEATHER_FRAC = 0.012  # feather the near-band edge (% short side) to blend

# Drift motion, as a % of cover dimension (component overscans by 2*maxAmp).
BG_AMP_SINGLE = (3.2, 2.2)   # single un-banded plate
BG_SCALE_SINGLE = 0.04
BG_AMP_FAR = (2.2, 1.5)      # far band drifts gently...
BG_SCALE_FAR = 0.03
BG_AMP_NEAR = (5.0, 3.4)     # ...near band drifts more (parallax)
BG_SCALE_NEAR = 0.06
BG_DURATION_MS = 14000

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

PROVIDERS = {
    "cpu": ["CPUExecutionProvider"],
    "cuda": ["CUDAExecutionProvider", "CPUExecutionProvider"],
    "coreml": ["CoreMLExecutionProvider", "CPUExecutionProvider"],
}


def load_session(path: pathlib.Path, providers: list[str]) -> ort.InferenceSession | None:
    """Open an ONNX session, or None if the model file is absent."""
    if not path.exists():
        return None
    return ort.InferenceSession(str(path), providers=providers)


def imagenet_chw(img: Image.Image, w: int, h: int) -> np.ndarray:
    """Resize to (w,h) and ImageNet-normalize to a 1x3xHxW float tensor."""
    arr = np.asarray(img.convert("RGB").resize((w, h), Image.BILINEAR), dtype=np.float32) / 255.0
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
    return np.transpose(arr, (2, 0, 1))[None]


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


# --- Text detection -------------------------------------------------------

def infer_text_prob(sess: ort.InferenceSession, img: Image.Image, size0: tuple[int, int]) -> Image.Image:
    """Run DBNet; return the text-probability map (L, 0-255) at original size."""
    w0, h0 = size0
    scale = min(1.0, DET_MAX_SIDE / max(w0, h0))
    w = max(32, (round(w0 * scale) // 32) * 32)
    h = max(32, (round(h0 * scale) // 32) * 32)
    in_name = sess.get_inputs()[0].name
    out_name = sess.get_outputs()[0].name
    prob = np.squeeze(sess.run([out_name], {in_name: imagenet_chw(img, w, h)})[0])
    prob = (np.clip(prob, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(prob, mode="L").resize((w0, h0), Image.BILINEAR)


def text_masks(prob: Image.Image, short_side: int) -> tuple[Image.Image, Image.Image, float]:
    """From a text-probability map derive (hard hole mask, soft layer alpha, area frac)."""
    binary = prob.point(lambda v: 255 if v > round(DET_THRESH * 255) else 0)
    grow = max(2, round(short_side * TEXT_DILATE_FRAC))
    k = grow if grow % 2 == 1 else grow + 1
    hole = binary.filter(ImageFilter.MaxFilter(min(k, 31)))
    soft = hole.filter(ImageFilter.GaussianBlur(max(1.0, grow / 2)))
    frac = float(np.asarray(binary, dtype=np.float32).mean()) / 255.0
    return hole, soft, frac


# --- Depth banding --------------------------------------------------------

def infer_depth(sess: ort.InferenceSession, img: Image.Image, size0: tuple[int, int]) -> np.ndarray:
    """Run a monocular depth model; return a 0-1 map (near=high) at original size."""
    w0, h0 = size0
    shp = sess.get_inputs()[0].shape
    h = shp[2] if isinstance(shp[2], int) and shp[2] > 0 else 256
    w = shp[3] if isinstance(shp[3], int) and shp[3] > 0 else 256
    in_name = sess.get_inputs()[0].name
    out_name = sess.get_outputs()[0].name
    out = np.squeeze(sess.run([out_name], {in_name: imagenet_chw(img, w, h)})[0]).astype(np.float32)
    lo, hi = float(out.min()), float(out.max())
    norm = (out - lo) / (hi - lo) if hi > lo else np.zeros_like(out)
    resized = Image.fromarray((norm * 255).astype(np.uint8), mode="L").resize((w0, h0), Image.BILINEAR)
    return np.asarray(resized, dtype=np.float32) / 255.0


def near_band_alpha(depth01: np.ndarray, short_side: int) -> Image.Image | None:
    """Feathered alpha for the near depth band, or None if there's no usable split."""
    thr = float(np.percentile(depth01, NEAR_PERCENTILE))
    near = depth01 >= thr
    frac = float(near.mean())
    if frac < NEAR_MIN_FRAC or frac > NEAR_MAX_FRAC:
        return None
    mask = Image.fromarray((near * 255).astype(np.uint8), mode="L")
    return mask.filter(ImageFilter.GaussianBlur(max(1.0, short_side * BAND_FEATHER_FRAC)))


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


def with_alpha(rgb: Image.Image, alpha: Image.Image) -> Image.Image:
    """Attach `alpha` to `rgb` as an RGBA image."""
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


# --- Manifest -------------------------------------------------------------

def drift(amp: tuple[float, float], scale: float) -> dict:
    return {
        "type": "drift",
        "ampPct": list(amp),
        "scaleAmp": scale,
        "durationMs": BG_DURATION_MS,
        "easing": "ease-in-out",
        "alternate": True,
    }


def manifest(cover_id: str, src_hash: str, size: tuple[int, int], coverage: float,
             mode: str, layers: list[dict], reason: str | None = None) -> dict:
    m = {
        "schemaVersion": 2,
        "coverId": cover_id,
        "sourceHash": src_hash,
        "w": size[0], "h": size[1],
        "fgCoverage": round(coverage, 4),
        "mode": mode,
        "layers": layers,
    }
    if reason is not None:
        m["reason"] = reason
    return m


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
    models = args.models_dir

    raw = args.cover.read_bytes()
    src_hash = "sha256:" + hashlib.sha256(raw).hexdigest()
    img = Image.open(args.cover).convert("RGBA")
    rgb = img.convert("RGB")
    size = img.size
    short_side = min(size)

    def write_manifest(m: dict) -> None:
        (args.out / "manifest.json").write_text(json.dumps(m, indent=2))

    # 1. Character segmentation.
    seg = ort.InferenceSession(str(models / "isnetis.onnx"), providers=providers)
    alpha = refine_alpha(infer_alpha(seg, img))
    coverage = float(np.asarray(alpha).mean()) / 255.0
    use_character = GATE_LOW <= coverage <= GATE_HIGH

    # 2. Text detection (optional model).
    text_hole = text_soft = None
    use_text = False
    text_frac = 0.0
    det = load_session(models / "text_det.onnx", providers)
    if det is not None:
        text_hole, text_soft, text_frac = text_masks(infer_text_prob(det, rgb, size), short_side)
        use_text = text_frac >= TEXT_MIN_FRAC

    # 3. Gate: need a usable character, or — for a character-less cover — enough
    # text to be worth animating (a faint/false detection must not flip painterly
    # art out of its flat fallback).
    if not use_character and text_frac < TEXT_UNLOCK_FRAC:
        use_text = False
        reason = "no-subject" if coverage < GATE_LOW else "full-bleed"
        write_manifest(manifest(args.id, src_hash, size, coverage, "flat", [], reason))
        print(f"FLAT {args.id}: coverage={coverage:.0%} ({reason})", flush=True)
        return 0

    # 4. Inpaint hole = dilated character ∪ dilated text.
    hole_arr = np.zeros((size[1], size[0]), dtype=np.uint8)
    if use_character:
        hole_arr = np.maximum(hole_arr, np.asarray(build_hole(alpha, short_side)))
    if use_text and text_hole is not None:
        hole_arr = np.maximum(hole_arr, np.asarray(text_hole))
    lama = ort.InferenceSession(str(models / "lama_fp32.onnx"), providers=providers)
    plate = lama_fill(lama, rgb, Image.fromarray(hole_arr, mode="L"))

    # 5. Depth banding (optional model) -> background layer(s).
    layers: list[dict] = []
    depth_sess = load_session(models / "depth.onnx", providers)
    near_alpha = near_band_alpha(infer_depth(depth_sess, rgb, size), short_side) if depth_sess is not None else None
    if near_alpha is not None:
        plate.save(args.out / "background-far.webp", "WEBP", quality=88, method=6)
        with_alpha(plate, near_alpha).save(args.out / "background-near.webp", "WEBP", quality=88, method=6)
        layers.append({"id": "bg-far", "role": "background", "file": "background-far.webp", "z": 0,
                       "motion": drift(BG_AMP_FAR, BG_SCALE_FAR)})
        layers.append({"id": "bg-near", "role": "background", "file": "background-near.webp", "z": 5,
                       "motion": drift(BG_AMP_NEAR, BG_SCALE_NEAR)})
    else:
        plate.save(args.out / "background.webp", "WEBP", quality=88, method=6)
        layers.append({"id": "bg", "role": "background", "file": "background.webp", "z": 0,
                       "motion": drift(BG_AMP_SINGLE, BG_SCALE_SINGLE)})

    # 6. Character layer (locked in frame).
    if use_character:
        with_alpha(rgb, alpha).save(args.out / "character.webp", "WEBP", quality=90, method=6)
        layers.append({"id": "char", "role": "character", "file": "character.webp", "z": 10, "motion": None})

    # 7. Text layer (locked, on top — kept static for readability).
    if use_text and text_soft is not None:
        with_alpha(rgb, text_soft).save(args.out / "text.webp", "WEBP", quality=90, method=6)
        layers.append({"id": "text", "role": "text", "file": "text.webp", "z": 20, "motion": None})

    write_manifest(manifest(args.id, src_hash, size, coverage, "layered", layers))
    bands = "banded" if near_alpha is not None else "single"
    print(f"LAYERED {args.id}: coverage={coverage:.0%} char={use_character} text={use_text} bg={bands}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
