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

# Discrete near-item sprites (closest blobs lifted off the plate to drift alone).
ITEM_PERCENTILE = 78       # depth >= this percentile -> candidate (closest) pixels
ITEM_MIN_AREA_FRAC = 0.004 # ignore specks...
ITEM_MAX_AREA_FRAC = 0.10  # ...and blobs so big they're just scenery (leave in band)
ITEM_MAX_COUNT = 3
ITEM_LABEL_SIDE = 320      # connected-components run on a mask downscaled to this
ITEM_FEATHER_FRAC = 0.008  # feather a sprite's edge (% short side)

# Drift motion, as a % of cover dimension (component overscans by 2*maxAmp).
BG_AMP_SINGLE = (3.2, 2.2)   # single un-banded plate
BG_SCALE_SINGLE = 0.04
BG_AMP_FAR = (2.2, 1.5)      # far band drifts gently...
BG_SCALE_FAR = 0.03
BG_AMP_NEAR = (5.0, 3.4)     # ...near band drifts more (parallax)
BG_SCALE_NEAR = 0.06
ITEM_AMP = (7.0, 4.6)        # ...and a lifted near-item drifts most of all
ITEM_SCALE = 0.08
ITEM_DUR_BASE = 13000        # items get slightly different durations so they desync
ITEM_DUR_STEP = 1500
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


def _label_components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """4-connectivity connected-component labels for a small bool mask (no scipy/cv2)."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    cur = 0
    for sy, sx in zip(*np.nonzero(mask)):
        if labels[sy, sx]:
            continue
        cur += 1
        stack = [(int(sy), int(sx))]
        labels[sy, sx] = cur
        while stack:
            y, x = stack.pop()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = cur
                    stack.append((ny, nx))
    return labels, cur


def find_items(depth01: np.ndarray, exclude: Image.Image, size: tuple[int, int],
               short_side: int) -> list[tuple[Image.Image, np.ndarray]]:
    """Closest discrete background blobs as (soft alpha, hard mask) sprite pairs.

    Runs connected components on a downscaled near-depth mask, keeps a few blobs
    in a sane area band that don't overlap the character/text hole, and returns
    full-res masks. Empty when nothing qualifies -> caller keeps plain bands.
    """
    w0, h0 = size
    scale = min(1.0, ITEM_LABEL_SIDE / max(w0, h0))
    dw, dh = max(1, round(w0 * scale)), max(1, round(h0 * scale))
    small = np.asarray(Image.fromarray((depth01 * 255).astype(np.uint8), "L").resize((dw, dh), Image.BILINEAR),
                       dtype=np.float32) / 255.0
    ex = np.asarray(exclude.resize((dw, dh), Image.NEAREST), dtype=np.uint8) > 127
    cand = (small >= float(np.percentile(small, ITEM_PERCENTILE))) & (~ex)
    labels, n = _label_components(cand)
    total = float(dw * dh)
    blobs = []
    for lab in range(1, n + 1):
        comp = labels == lab
        area = float(comp.sum()) / total
        if ITEM_MIN_AREA_FRAC <= area <= ITEM_MAX_AREA_FRAC:
            blobs.append((area, comp))
    blobs.sort(key=lambda b: -b[0])
    out: list[tuple[Image.Image, np.ndarray]] = []
    for _, comp in blobs[:ITEM_MAX_COUNT]:
        up = Image.fromarray((comp * 255).astype(np.uint8), "L").resize((w0, h0), Image.BILINEAR)
        soft = up.filter(ImageFilter.GaussianBlur(max(1.0, short_side * ITEM_FEATHER_FRAC)))
        hard = (np.asarray(up, dtype=np.uint8) > 127).astype(np.uint8) * 255
        out.append((soft, hard))
    return out


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

def drift(amp: tuple[float, float], scale: float, dur: int = BG_DURATION_MS) -> dict:
    return {
        "type": "drift",
        "ampPct": list(amp),
        "scaleAmp": scale,
        "durationMs": dur,
        "easing": "ease-in-out",
        "alternate": True,
    }


def manifest(cover_id: str, src_hash: str, size: tuple[int, int], coverage: float,
             mode: str, layers: list[dict], segmenter: str, reason: str | None = None,
             smart_effects: bool = False, effect: str = "none", tags: list[str] | None = None) -> dict:
    m = {
        "schemaVersion": 2,
        "coverId": cover_id,
        "sourceHash": src_hash,
        "w": size[0], "h": size[1],
        "fgCoverage": round(coverage, 4),
        "mode": mode,
        "segmenter": segmenter,
        "smartEffects": smart_effects,
        "effect": effect,
        "tags": tags if tags is not None else [],
        "layers": layers,
    }
    if reason is not None:
        m["reason"] = reason
    return m


# --- Smart effects (Option B) — tag-driven motion presets -----------------

EFFECT_AMP_CAP = 9.0  # keep amplitude within the component's overscan margin

# (name, trigger tags, {amp scale, duration scale, vertical bias 0..1}). First
# match by tag-overlap count wins; order is the tie-break priority.
EFFECT_PRESETS: list[tuple[str, set[str], dict]] = [
    ("weather", {"rain", "raining", "snow", "snowing", "falling_petals", "cherry_blossoms", "confetti", "ash", "bubbles"},
     {"amp": 1.2, "dur": 0.85, "vbias": 0.7}),
    ("rising", {"fire", "flames", "smoke", "embers", "sparks", "steam", "explosion", "burning"},
     {"amp": 1.15, "dur": 1.2, "vbias": 0.6}),
    ("action", {"weapon", "sword", "katana", "knife", "dagger", "gun", "fighting", "battle", "blood",
                "motion_blur", "speed_lines", "bo_staff", "spear", "polearm", "axe", "holding_weapon"},
     {"amp": 1.4, "dur": 0.72, "vbias": 0.0}),
    ("calm", {"cloud", "clouds", "sky", "scenery", "ocean", "water", "landscape", "night", "starry_sky",
              "sunset", "mountain", "field", "forest", "beach"},
     {"amp": 0.7, "dur": 1.3, "vbias": 0.0}),
]


def apply_effect_profile(layers: list[dict], tags: set[str]) -> str:
    """Pick a mood profile from `tags` and retune each drifting layer's motion in place."""
    best_name, best_profile, best_score = "none", None, 0
    for name, triggers, profile in EFFECT_PRESETS:
        score = len(triggers & tags)
        if score > best_score:
            best_name, best_profile, best_score = name, profile, score
    if best_profile is None:
        return "none"
    for layer in layers:
        motion = layer.get("motion")
        if not motion:
            continue
        ax, ay = motion["ampPct"]
        vbias = best_profile["vbias"]
        motion["ampPct"] = [
            round(min(EFFECT_AMP_CAP, ax * best_profile["amp"] * (1.0 - 0.5 * vbias)), 2),
            round(min(EFFECT_AMP_CAP, ay * best_profile["amp"] * (1.0 + 0.7 * vbias)), 2),
        ]
        motion["durationMs"] = int(motion["durationMs"] * best_profile["dur"])
    return best_name


# --- Background / object layer builders -----------------------------------

def standard_bg_layers(out: pathlib.Path, models: pathlib.Path, providers: list[str], rgb: Image.Image,
                       plate: Image.Image, lama: ort.InferenceSession, hole_arr: np.ndarray,
                       size: tuple[int, int], short_side: int) -> list[dict]:
    """Depth-band + connected-component item heuristics (the original pipeline)."""
    layers: list[dict] = []
    near_alpha = None
    items: list[tuple[Image.Image, np.ndarray]] = []
    depth_sess = load_session(models / "depth.onnx", providers)
    if depth_sess is not None:
        depth01 = infer_depth(depth_sess, rgb, size)
        near_alpha = near_band_alpha(depth01, short_side)
        if near_alpha is not None:
            items = find_items(depth01, Image.fromarray(hole_arr, mode="L"), size, short_side)

    plate_bands = plate
    if items:
        union = np.zeros((size[1], size[0]), dtype=np.uint8)
        for _, hard in items:
            union = np.maximum(union, hard)
        plate_bands = lama_fill(lama, plate, Image.fromarray(union, mode="L"))

    if near_alpha is not None:
        plate_bands.save(out / "background-far.webp", "WEBP", quality=88, method=6)
        with_alpha(plate_bands, near_alpha).save(out / "background-near.webp", "WEBP", quality=88, method=6)
        layers.append({"id": "bg-far", "role": "background", "file": "background-far.webp", "z": 0,
                       "motion": drift(BG_AMP_FAR, BG_SCALE_FAR)})
        layers.append({"id": "bg-near", "role": "background", "file": "background-near.webp", "z": 5,
                       "motion": drift(BG_AMP_NEAR, BG_SCALE_NEAR)})
    else:
        plate.save(out / "background.webp", "WEBP", quality=88, method=6)
        layers.append({"id": "bg", "role": "background", "file": "background.webp", "z": 0,
                       "motion": drift(BG_AMP_SINGLE, BG_SCALE_SINGLE)})

    for i, (soft, _) in enumerate(items):
        fname = f"item-{i}.webp"
        with_alpha(plate, soft).save(out / fname, "WEBP", quality=90, method=6)
        layers.append({"id": f"item-{i}", "role": "object", "file": fname, "z": 6 + i,
                       "motion": drift(ITEM_AMP, ITEM_SCALE, ITEM_DUR_BASE + i * ITEM_DUR_STEP)})
    return layers


def sam_bg_layers(out: pathlib.Path, models: pathlib.Path, providers: list[str], rgb: Image.Image,
                  plate: Image.Image, lama: ort.InferenceSession, hole_arr: np.ndarray,
                  size: tuple[int, int], short_side: int) -> list[dict]:
    """MobileSAM object masks → depth-ordered drifting layers (falls back to a single plate)."""
    from sam_segment import load_sam, sam_object_masks  # lazy: only the sam path needs it

    layers: list[dict] = []
    sessions = load_sam(str(models), providers)
    objs = sam_object_masks(sessions, rgb, Image.fromarray(hole_arr, mode="L"), short_side) if sessions is not None else []

    # Order nearest-first using mean inverse-depth per mask (depth as ordering, not banding).
    depth_sess = load_session(models / "depth.onnx", providers)
    if depth_sess is not None and objs:
        depth01 = infer_depth(depth_sess, rgb, size)
        objs.sort(key=lambda o: -(float(depth01[o[1] > 127].mean()) if (o[1] > 127).any() else 0.0))

    if not objs:
        plate.save(out / "background.webp", "WEBP", quality=88, method=6)
        layers.append({"id": "bg", "role": "background", "file": "background.webp", "z": 0,
                       "motion": drift(BG_AMP_SINGLE, BG_SCALE_SINGLE)})
        return layers

    union = np.zeros((size[1], size[0]), dtype=np.uint8)
    for _, hard in objs:
        union = np.maximum(union, hard)
    deep = lama_fill(lama, plate, Image.fromarray(union, mode="L"))
    deep.save(out / "background-far.webp", "WEBP", quality=88, method=6)
    layers.append({"id": "bg-far", "role": "background", "file": "background-far.webp", "z": 0,
                   "motion": drift(BG_AMP_FAR, BG_SCALE_FAR)})
    for i, (soft, _) in enumerate(objs):
        factor = max(0.4, 1.0 - i * 0.18)  # nearer object → larger drift
        amp = (round(ITEM_AMP[0] * factor, 2), round(ITEM_AMP[1] * factor, 2))
        fname = f"object-{i}.webp"
        with_alpha(plate, soft).save(out / fname, "WEBP", quality=90, method=6)
        layers.append({"id": f"object-{i}", "role": "object", "file": fname, "z": 6 + i,
                       "motion": drift(amp, round(ITEM_SCALE * factor, 3), ITEM_DUR_BASE + i * ITEM_DUR_STEP)})
    return layers


# --- Main -----------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="Layerize a manga cover for living-cover animation.")
    ap.add_argument("--cover", required=True, type=pathlib.Path)
    ap.add_argument("--id", required=True, help="manga/cover id (manifest coverId)")
    ap.add_argument("--out", required=True, type=pathlib.Path)
    ap.add_argument("--models-dir", required=True, type=pathlib.Path)
    ap.add_argument("--device", choices=list(PROVIDERS), default="cpu")
    ap.add_argument("--segmenter", choices=["standard", "sam"], default="standard",
                    help="standard = depth bands + item heuristics; sam = MobileSAM object masks")
    ap.add_argument("--smart-effects", action="store_true",
                    help="tag the cover (WD14) and tune drift motion to the mood")
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
        write_manifest(manifest(args.id, src_hash, size, coverage, "flat", [], args.segmenter, reason,
                                smart_effects=args.smart_effects))
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

    # 5. Background + object layers — SAM object masks or the depth-band heuristic.
    if args.segmenter == "sam":
        layers = sam_bg_layers(args.out, models, providers, rgb, plate, lama, hole_arr, size, short_side)
    else:
        layers = standard_bg_layers(args.out, models, providers, rgb, plate, lama, hole_arr, size, short_side)

    # 6. Character layer (locked in frame).
    if use_character:
        with_alpha(rgb, alpha).save(args.out / "character.webp", "WEBP", quality=90, method=6)
        layers.append({"id": "char", "role": "character", "file": "character.webp", "z": 10, "motion": None})

    # 7. Text layer (locked, on top — kept static for readability).
    if use_text and text_soft is not None:
        with_alpha(rgb, text_soft).save(args.out / "text.webp", "WEBP", quality=90, method=6)
        layers.append({"id": "text", "role": "text", "file": "text.webp", "z": 20, "motion": None})

    # 8. Smart effects (optional) — tag the cover and retune drift to the mood.
    tags: list[str] = []
    effect = "none"
    if args.smart_effects:
        from tag_cover import load_tagger, tag_cover  # lazy: only this path needs it

        loaded = load_tagger(str(models), providers)
        if loaded is not None:
            found = tag_cover(loaded, rgb)
            tags = sorted(found)[:12]
            effect = apply_effect_profile(layers, found)

    write_manifest(manifest(args.id, src_hash, size, coverage, "layered", layers, args.segmenter,
                            smart_effects=args.smart_effects, effect=effect, tags=tags))
    objects = sum(1 for layer in layers if layer["role"] == "object")
    print(f"LAYERED {args.id}: coverage={coverage:.0%} char={use_character} text={use_text} "
          f"segmenter={args.segmenter} objects={objects} effect={effect}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
