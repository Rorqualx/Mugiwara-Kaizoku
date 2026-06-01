"""Open-vocabulary, *labeled* object segmentation for the `grounded-sam`
segmenter (Option C) — the GPU tier.

Pipeline (reuses A + B; only the box step is new torch):
    WD14 tags (ONNX, Option B)  ->  GroundingDINO boxes (torch, new)
                                ->  MobileSAM box-prompted masks (ONNX, Option A)

Each kept region carries its semantic `label`, so `layerize.py` can give every
layer motion appropriate to *what it is* (cloud drifts sideways, fire rises,
debris scatters) instead of A's depth-ordered blobs + B's single global mood.

torch + `transformers` are imported lazily inside the inference functions, so
this module imports — and `probe()` runs — on a CPU-only box with no torch. The
GroundingDINO weights live under `<models-dir>/grounding-dino-tiny/` (fetched by
`download_models.py --tier grounded-sam`, run on the GPU host).
"""

from __future__ import annotations

import os
import pathlib

import numpy as np
from PIL import Image

from sam_segment import decode_box, encode_image, feather, load_sam
from tag_cover import load_tagger, tag_cover

# Local snapshot dir + HF repo for the GroundingDINO checkpoint.
GROUNDING_DIR = "grounding-dino-tiny"
GROUNDING_REPO = "IDEA-Research/grounding-dino-tiny"

BOX_THRESHOLD = 0.20      # GroundingDINO box-confidence floor (manga art scores lower than photos)
TEXT_THRESHOLD = 0.15     # phrase-match floor
NMS_IOU = 0.5             # dedup overlapping boxes (keep higher score)
EXCLUDE_OVERLAP = 0.55    # drop a box mostly inside the character/text hole
AREA_MIN = 0.004          # box area as a fraction of the image...
AREA_MAX = 0.62           # ...kept in a band (skip specks + whole-frame boxes)
MASK_AREA_MIN = 0.003     # decoded-mask area floor (a box may segment to nothing)
MAX_OBJECTS = 4

# WD14 tags worth grounding as separable layers (elements + common props). Other
# tags ("1girl", "solo", "looking_at_viewer", …) are abstract and not grounded.
GROUNDABLE: set[str] = {
    "cloud", "clouds", "sky", "fire", "flames", "smoke", "explosion", "fog", "mist",
    "sword", "katana", "knife", "dagger", "gun", "weapon", "spear", "polearm", "axe",
    "scythe", "bow", "shield", "staff", "bo_staff", "cape", "coat", "flag", "banner",
    "ribbon", "scarf", "tree", "mountain", "water", "ocean", "sea", "wave", "river",
    "waterfall", "moon", "sun", "building", "city", "castle", "car", "motor_vehicle",
    "flower", "flowers", "petals", "cherry_blossoms", "leaf", "leaves", "bird", "wing",
    "wings", "feathers", "balloon", "lantern", "sparks", "lightning", "star", "stars",
    "snow", "rain", "bubble", "bubbles", "butterfly", "smoke",
}


def _grounding_path(models_dir: str) -> pathlib.Path:
    return pathlib.Path(models_dir) / GROUNDING_DIR


def _mps_ok(torch) -> bool:  # noqa: ANN001 - torch is lazy-typed
    """True if a usable Apple-Silicon Metal (MPS) backend is present."""
    backend = getattr(torch.backends, "mps", None)
    return backend is not None and bool(backend.is_available())


def probe(models_dir: str = "") -> dict:
    """Capability snapshot — importable and runnable with no torch installed.

    @returns `{torch, cuda, mps, dino}` (booleans). The tier only needs `torch`
        + `dino`; `cuda`/`mps` just report which accelerator (if any) will be
        used. `dino` is whether the local GroundingDINO snapshot is present.
    """
    has_torch = has_cuda = has_mps = False
    try:
        import torch  # noqa: PLC0415 - intentionally lazy

        has_torch = True
        has_cuda = bool(torch.cuda.is_available())
        has_mps = _mps_ok(torch)
    except Exception:  # noqa: BLE001 - any import/runtime failure means "unavailable"
        has_torch = has_cuda = has_mps = False
    dino = models_dir != "" and (_grounding_path(models_dir) / "config.json").exists()
    return {"torch": has_torch, "cuda": has_cuda, "mps": has_mps, "dino": dino}


def _torch_device(requested: str, torch) -> str:  # noqa: ANN001 - torch is lazy-typed
    """Best torch device: honor an explicit cuda/mps request, else auto-pick (cuda > mps > cpu).

    The ONNX `--device` (cpu/cuda/coreml) and the torch device are separate
    concerns, so we auto-detect here — on an M-series Mac the ONNX stage stays on
    CPU/CoreML while GroundingDINO still runs on Metal.
    """
    if requested == "cuda" and torch.cuda.is_available():
        return "cuda"
    if requested == "mps" and _mps_ok(torch):
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    if _mps_ok(torch):
        return "mps"
    return "cpu"


def load_grounding(models_dir: str, device: str):  # noqa: ANN201 - torch types are lazy
    """Load the GroundingDINO processor + model onto the best device, or None if unavailable."""
    local = _grounding_path(models_dir)
    if not (local / "config.json").exists():
        return None
    try:
        import torch  # noqa: PLC0415
        from transformers import AutoProcessor, GroundingDinoForObjectDetection  # noqa: PLC0415

        dev = _torch_device(device, torch)
        if dev == "mps":
            # Let unsupported ops (e.g. deformable attention) fall back to CPU
            # instead of hard-erroring on Metal.
            os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
        proc = AutoProcessor.from_pretrained(str(local))
        model = GroundingDinoForObjectDetection.from_pretrained(str(local)).to(dev).eval()
        print(f"grounded: GroundingDINO on {dev}", flush=True)
        return proc, model, dev
    except Exception as err:  # noqa: BLE001 - missing torch/transformers -> caller falls back
        print(f"grounded: load_grounding failed: {err}", flush=True)
        return None


def _prompt(tags: set[str]) -> tuple[str, list[str]]:
    """Build a GroundingDINO text prompt from the groundable subset of WD14 tags."""
    phrases = sorted({t.replace("_", " ") for t in (tags & GROUNDABLE)})
    return (". ".join(phrases) + "." if phrases else ""), phrases


def _detect(grounding, rgb: Image.Image, phrases: list[str]) -> list[tuple[tuple[float, float, float, float], float, str]]:
    """Run GroundingDINO once per phrase so each box carries a clean label.

    post_process returns the whole prompt string as the per-box label (it doesn't
    split phrases reliably), so we prompt one phrase at a time and tag the boxes
    with that phrase — which is what drives `LABEL_MOTION`.
    """
    import torch  # noqa: PLC0415

    proc, model, dev = grounding
    w0, h0 = rgb.size
    out: list[tuple[tuple[float, float, float, float], float, str]] = []
    for phrase in phrases:
        inputs = proc(images=rgb, text=f"{phrase}.", return_tensors="pt").to(dev)
        with torch.no_grad():
            outputs = model(**inputs)
        res = proc.post_process_grounded_object_detection(
            outputs, inputs["input_ids"], box_threshold=BOX_THRESHOLD,
            text_threshold=TEXT_THRESHOLD, target_sizes=[(h0, w0)],
        )[0]
        for box, score in zip(res["boxes"].tolist(), res["scores"].tolist()):
            x0, y0, x1, y1 = box
            out.append(((float(x0), float(y0), float(x1), float(y1)), float(score), phrase))
    return out


def _iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ix0, iy0 = max(a[0], b[0]), max(a[1], b[1])
    ix1, iy1 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)
    if inter <= 0.0:
        return 0.0
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    return inter / max(1.0, area_a + area_b - inter)


def _filter_boxes(dets: list[tuple[tuple[float, float, float, float], float, str]], size: tuple[int, int],
                  hole: np.ndarray) -> list[tuple[tuple[float, float, float, float], str]]:
    """Area-band gate + drop char/text-hole boxes + greedy NMS; highest score first."""
    w0, h0 = size
    frame = float(w0 * h0)
    kept: list[tuple[tuple[float, float, float, float], float, str]] = []
    for box, score, label in sorted(dets, key=lambda d: -d[1]):
        x0, y0, x1, y1 = box
        frac = ((x1 - x0) * (y1 - y0)) / max(1.0, frame)
        if frac < AREA_MIN or frac > AREA_MAX:
            continue
        bx0, by0 = max(0, int(x0)), max(0, int(y0))
        bx1, by1 = min(w0, int(x1)), min(h0, int(y1))
        region = hole[by0:by1, bx0:bx1]
        if region.size > 0 and float(region.mean()) > EXCLUDE_OVERLAP:
            continue  # mostly the locked character/text — not a background object
        if any(_iou(box, k[0]) > NMS_IOU for k in kept):
            continue
        kept.append((box, score, label))
        if len(kept) >= MAX_OBJECTS:
            break
    return [(box, label) for box, _, label in kept]


def grounded_object_masks(grounding, sam_sessions, tagger, rgb: Image.Image, exclude: Image.Image,
                          short_side: int) -> list[tuple[Image.Image, np.ndarray, str]]:
    """Labeled background-object masks for the `grounded-sam` segmenter.

    @returns list of (feathered full-res alpha `L`, full-res hard `uint8`, label),
        highest-confidence first; empty when nothing groundable is found (caller
        falls back to a single plate).
    """
    if grounding is None or sam_sessions is None:
        return []
    tags = tag_cover(tagger, rgb) if tagger is not None else set()
    _, phrases = _prompt(tags)
    if not phrases:
        return []

    size = rgb.size
    hole = (np.asarray(exclude.convert("L"), np.uint8) > 127)
    boxes = _filter_boxes(_detect(grounding, rgb, phrases), size, hole)
    if not boxes:
        return []

    enc, dec = sam_sessions
    emb = encode_image(enc, rgb)
    out: list[tuple[Image.Image, np.ndarray, str]] = []
    for box, label in boxes:
        mask = decode_box(dec, emb, box, size)
        if float(mask.mean()) < MASK_AREA_MIN:
            continue
        soft, hard = feather(mask, size, short_side)
        out.append((soft, hard, label))
    return out


# --- Per-object semantic motion + the layerize entry point -----------------

DUR_STEP = 1500  # desync objects of the same class slightly

# label class -> (trigger tags, amp (x, y), scale, base duration ms). Drift is
# biased to suit the element: clouds/water drift sideways, fire/smoke rise,
# debris/sparks scatter fast, cloth/wings sway. First set-membership match wins.
LABEL_MOTION: list[tuple[str, set[str], tuple[float, float], float, int]] = [
    ("rising", {"fire", "flames", "smoke", "embers", "steam", "explosion", "burning"},
     (2.0, 7.0), 0.06, 16000),
    ("scatter", {"debris", "sparks", "lightning", "motion_blur", "speed_lines"},
     (7.5, 5.5), 0.09, 9000),
    ("horizontal", {"cloud", "clouds", "sky", "water", "ocean", "sea", "wave", "river",
                    "waterfall", "fog", "mist", "petals", "cherry_blossoms", "snow", "rain",
                    "bubble", "bubbles", "butterfly", "bird"},
     (7.0, 1.8), 0.05, 18000),
    ("sway", {"cape", "coat", "flag", "banner", "ribbon", "scarf", "wing", "wings",
              "feathers", "leaf", "leaves", "flower", "flowers", "balloon", "lantern"},
     (5.5, 2.0), 0.06, 12000),
    ("wield", {"sword", "katana", "knife", "dagger", "gun", "spear", "polearm", "axe",
               "scythe", "bow", "shield", "staff", "bo_staff", "weapon"},
     (3.5, 2.4), 0.05, 13000),
]


def _label_drift_params(label: str, index: int) -> tuple[tuple[float, float], float, int] | None:
    """(amp, scale, dur) suited to a label, or None to use the default item drift."""
    key = label.strip().lower().replace(" ", "_")
    for _name, triggers, amp, scale, dur in LABEL_MOTION:
        if key in triggers:
            return amp, scale, dur + index * DUR_STEP
    return None


def grounded_sam_bg_layers(out, models, providers, rgb: Image.Image, plate: Image.Image,
                           lama, hole_arr: np.ndarray, size: tuple[int, int], short_side: int,
                           device: str) -> tuple[list[dict], str | None]:
    """Layerize entry point for the `grounded-sam` segmenter (Option C).

    Each object gets motion suited to its label. Needs torch + the GroundingDINO
    weights; on a box without them it degrades to MobileSAM (Option A) and returns
    its name so the caller records the fallback. Returns `(layers, fallback|None)`.
    """
    # Lazy: layerize is fully loaded by the time this runs (it imports us lazily),
    # so pulling its shared drift/helpers/constants here avoids a circular import.
    from layerize import (  # noqa: PLC0415
        BG_AMP_FAR, BG_AMP_SINGLE, BG_SCALE_FAR, BG_SCALE_SINGLE,
        ITEM_AMP, ITEM_DUR_BASE, ITEM_DUR_STEP, ITEM_SCALE,
        drift, lama_fill, sam_bg_layers, with_alpha,
    )

    cap = probe(str(models))
    if not (cap["torch"] and cap["dino"]):
        return sam_bg_layers(out, models, providers, rgb, plate, lama, hole_arr, size, short_side), "sam"

    grounding = load_grounding(str(models), device)
    sam_sessions = load_sam(str(models), providers)
    tagger = load_tagger(str(models), providers)
    objs = grounded_object_masks(grounding, sam_sessions, tagger, rgb,
                                 Image.fromarray(hole_arr, mode="L"), short_side)

    layers: list[dict] = []
    if not objs:
        plate.save(out / "background.webp", "WEBP", quality=88, method=6)
        layers.append({"id": "bg", "role": "background", "file": "background.webp", "z": 0,
                       "motion": drift(BG_AMP_SINGLE, BG_SCALE_SINGLE)})
        return layers, None

    union = np.zeros((size[1], size[0]), dtype=np.uint8)
    for _, hard, _ in objs:
        union = np.maximum(union, hard)
    deep = lama_fill(lama, plate, Image.fromarray(union, mode="L"))
    deep.save(out / "background-far.webp", "WEBP", quality=88, method=6)
    layers.append({"id": "bg-far", "role": "background", "file": "background-far.webp", "z": 0,
                   "motion": drift(BG_AMP_FAR, BG_SCALE_FAR)})
    for i, (soft, _, label) in enumerate(objs):
        params = _label_drift_params(label, i)
        if params is not None:
            amp, scale, dur = params
            motion = drift(amp, scale, dur)
        else:
            factor = max(0.4, 1.0 - i * 0.18)
            amp = (round(ITEM_AMP[0] * factor, 2), round(ITEM_AMP[1] * factor, 2))
            motion = drift(amp, round(ITEM_SCALE * factor, 3), ITEM_DUR_BASE + i * ITEM_DUR_STEP)
        fname = f"object-{i}.webp"
        with_alpha(plate, soft).save(out / fname, "WEBP", quality=90, method=6)
        layers.append({"id": f"object-{i}", "role": "object", "file": fname, "z": 6 + i,
                       "label": label, "motion": motion})
    return layers, None


__all__ = ["GROUNDING_DIR", "GROUNDING_REPO", "grounded_object_masks", "grounded_sam_bg_layers",
           "load_grounding", "load_sam", "load_tagger", "probe"]
