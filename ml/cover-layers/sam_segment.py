"""SAM object segmentation for the `sam` segmenter (Option A).

MobileSAM (ONNX, no torch) automatic-mask-generation, trimmed for layering:
a coarse point grid through the mask decoder, then a greedy selection of a few
LARGE, mostly-disjoint background regions (the character/text area is excluded
so the locked character stays its own layer). Returns feathered full-res alpha
masks the caller turns into drifting `object` layers.

Models (optional): `sam_encoder.onnx` (Tiny-ViT image encoder, preprocessing
baked in) + `sam_decoder.onnx` (standard SAM ONNX decoder). Both from
Acly/MobileSAM.
"""

from __future__ import annotations

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

GRID = 14                # NxN seed points
IOU_MIN = 0.85           # decoder confidence floor
AREA_MIN = 0.01          # candidate area as fraction of image...
AREA_MAX = 0.55          # ...kept in a band (skip specks + near-whole-frame)
EXCLUDE_OVERLAP = 0.55   # drop a mask if >this fraction sits in the char/text hole
SELECT_OVERLAP = 0.30    # when selecting, reject a mask overlapping kept-union by >this
MAX_OBJECTS = 4
LOWRES = 256             # decoder low-res mask size (selection works here)
SAM_INPUT = 1024         # SAM resize-longest-side frame


def load_sam(models_dir: str, providers: list[str]) -> tuple[ort.InferenceSession, ort.InferenceSession] | None:
    """Loads the SAM encoder+decoder sessions, or None if either model is absent."""
    import pathlib
    enc = pathlib.Path(models_dir) / "sam_encoder.onnx"
    dec = pathlib.Path(models_dir) / "sam_decoder.onnx"
    if not enc.exists() or not dec.exists():
        return None
    return (
        ort.InferenceSession(str(enc), providers=providers),
        ort.InferenceSession(str(dec), providers=providers),
    )


def encode_image(enc: ort.InferenceSession, rgb: Image.Image) -> np.ndarray:
    """Run the (Tiny-ViT) image encoder once; returns the reusable image embedding."""
    return enc.run(["image_embeddings"], {"input_image": np.asarray(rgb, dtype=np.float32)})[0]


def decode_box(dec: ort.InferenceSession, emb: np.ndarray, box: tuple[float, float, float, float],
               size: tuple[int, int]) -> np.ndarray:
    """Decode one full-res mask from a box prompt.

    SAM encodes a box as two prompt points — top-left (label 2) and bottom-right
    (label 3) — in the resize-longest-1024 frame. Used by the grounded-sam path
    (boxes come from GroundingDINO). Returns a full-res bool mask `(h, w)`.
    """
    w0, h0 = size
    scale = float(SAM_INPUT) / max(w0, h0)
    x0, y0, x1, y1 = box
    masks, ious, _ = dec.run(
        ["masks", "iou_predictions", "low_res_masks"],
        {
            "image_embeddings": emb,
            "point_coords": np.array([[[x0 * scale, y0 * scale], [x1 * scale, y1 * scale]]], np.float32),
            "point_labels": np.array([[2, 3]], np.float32),
            "mask_input": np.zeros((1, 1, 256, 256), np.float32),
            "has_mask_input": np.array([0], np.float32),
            "orig_im_size": np.array([h0, w0], dtype=np.float32),
        },
    )
    bi = int(np.argmax(ious[0]))
    return masks[0, bi] > 0  # `masks` is upscaled to orig_im_size (h0, w0)


def feather(mask_bool: np.ndarray, size: tuple[int, int], short_side: int) -> tuple[Image.Image, np.ndarray]:
    """Turn a full-res bool mask into a (feathered alpha `L`, hard `uint8`) layer pair."""
    w0, h0 = size
    up = Image.fromarray((mask_bool.astype(np.uint8) * 255), "L")
    if up.size != (w0, h0):
        up = up.resize((w0, h0), Image.BILINEAR)
    soft = up.filter(ImageFilter.GaussianBlur(max(1.0, short_side * 0.01)))
    hard = (np.asarray(up, np.uint8) > 127).astype(np.uint8) * 255
    return soft, hard


def _candidates(enc: ort.InferenceSession, dec: ort.InferenceSession, rgb: Image.Image,
                exclude_small: np.ndarray) -> list[np.ndarray]:
    """Run the grid through SAM; return low-res (LOWRES²) bool masks passing the filters."""
    w0, h0 = rgb.size
    emb = encode_image(enc, rgb)
    scale = float(SAM_INPUT) / max(w0, h0)
    orig = np.array([h0, w0], dtype=np.float32)
    blank = np.zeros((1, 1, 256, 256), np.float32)
    out: list[np.ndarray] = []
    for gy in range(GRID):
        for gx in range(GRID):
            px = (gx + 0.5) / GRID * w0
            py = (gy + 0.5) / GRID * h0
            masks, ious, low = dec.run(
                ["masks", "iou_predictions", "low_res_masks"],
                {
                    "image_embeddings": emb,
                    "point_coords": np.array([[[px * scale, py * scale]]], np.float32),
                    "point_labels": np.array([[1]], np.float32),
                    "mask_input": blank,
                    "has_mask_input": np.array([0], np.float32),
                    "orig_im_size": orig,
                },
            )
            bi = int(np.argmax(ious[0]))
            if float(ious[0][bi]) < IOU_MIN:
                continue
            lm = low[0, bi] > 0  # LOWRES x LOWRES (actually 256)
            small = np.asarray(
                Image.fromarray((lm * 255).astype(np.uint8)).resize((LOWRES, LOWRES), Image.NEAREST), np.uint8,
            ) > 127
            frac = float(small.mean())
            if frac < AREA_MIN or frac > AREA_MAX:
                continue
            inside = float(np.logical_and(small, exclude_small).sum())
            if inside / max(1.0, float(small.sum())) > EXCLUDE_OVERLAP:
                continue  # this is the character/text — not a background object
            out.append(small)
    return out


def _select(candidates: list[np.ndarray]) -> list[np.ndarray]:
    """Greedy: largest first, keep only regions mostly-disjoint from the kept union."""
    candidates.sort(key=lambda m: -float(m.sum()))
    kept: list[np.ndarray] = []
    union = np.zeros_like(candidates[0]) if candidates else None
    for m in candidates:
        if union is None:
            break
        inter = float(np.logical_and(m, union).sum())
        if inter / max(1.0, float(m.sum())) > SELECT_OVERLAP:
            continue
        kept.append(m)
        union = np.logical_or(union, m)
        if len(kept) >= MAX_OBJECTS:
            break
    return kept


def sam_object_masks(sessions: tuple[ort.InferenceSession, ort.InferenceSession], rgb: Image.Image,
                     exclude: Image.Image, short_side: int) -> list[tuple[Image.Image, np.ndarray]]:
    """Discrete background-object masks for the `sam` segmenter.

    @returns list of (feathered full-res alpha `L`, full-res hard mask `uint8`),
        largest-first; empty when SAM finds no usable regions (caller falls back).
    """
    w0, h0 = rgb.size
    exclude_small = np.asarray(exclude.resize((LOWRES, LOWRES), Image.NEAREST), np.uint8) > 127
    kept = _select(_candidates(sessions[0], sessions[1], rgb, exclude_small))
    feather = max(1.0, short_side * 0.01)
    out: list[tuple[Image.Image, np.ndarray]] = []
    for m in kept:
        up = Image.fromarray((m * 255).astype(np.uint8), "L").resize((w0, h0), Image.BILINEAR)
        soft = up.filter(ImageFilter.GaussianBlur(feather))
        hard = (np.asarray(up, np.uint8) > 127).astype(np.uint8) * 255
        out.append((soft, hard))
    return out
