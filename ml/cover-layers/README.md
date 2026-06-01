# Cover layerizer

Turns a flat manga cover into "living cover" layers: a **static character**
foreground and an **inpainted background** that drifts behind it (2.5D parallax).
Runs once per cover at import time. ONNX-only — no torch, no numba.

## Models

| File | Model | Purpose | License |
|------|-------|---------|---------|
| `isnetis.onnx` | SkyTNT anime-seg (IS-Net) | character cutout matte | Apache-2.0 |
| `lama_fp32.onnx` | LaMa (Carve ONNX export, 512²) | fill the character-shaped hole | Apache-2.0 |

```bash
python download_models.py --models-dir ./models
```

## Run

```bash
python layerize.py \
  --cover /path/to/cover.jpg \
  --id 4948 \
  --out /path/to/output/4948 \
  --models-dir ./models \
  --device cpu          # cpu | coreml (mac) | cuda (prod)
```

Outputs into `--out`:

- `manifest.json` — always written. `mode: "layered"` or `mode: "flat"`.
- `character.webp` — RGBA foreground (only when `layered`).
- `background.webp` — opaque inpainted plate (only when `layered`).

## The coverage gate

After segmentation the script measures foreground coverage and **refuses to
layer** outside a sane band, emitting `mode: "flat"` so the app shows the normal
static cover:

- `< 10%` → `no-subject` (e.g. painterly art the anime model doesn't recognize).
- `> 92%` → `full-bleed` (character fills the frame; no background to move).

## Notes

- The character layer is **locked** (`motion: null`); only the background drifts,
  so the inpaint never needs to be pixel-perfect — it sits behind a still subject.
- Same `.onnx` files run on CPU (Mac) and CUDA (prod); only `--device` changes.
- ~1 s/cover on an 8 GB CUDA GPU, ~10–16 s/cover CPU. Offline batch; cache by
  `sourceHash` so re-imports skip recompute.
