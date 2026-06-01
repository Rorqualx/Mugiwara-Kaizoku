# Cover layerizer

Turns a flat manga cover into "living cover" layers: a **static character**
foreground, an optional **text** layer, and an **inpainted background** that
drifts behind them — with optional **depth banding** so nearer scenery drifts
more than the far plate (multi-plane 2.5D parallax). Runs once per cover at
import time. ONNX-only — no torch, no numba.

## Models

| File | Model | Purpose | License |
|------|-------|---------|---------|
| `isnetis.onnx` | SkyTNT anime-seg (IS-Net) | character cutout matte | Apache-2.0 |
| `lama_fp32.onnx` | LaMa (Carve ONNX export, 512²) | fill the character/text-shaped hole | Apache-2.0 |
| `text_det.onnx` *(optional)* | PP-OCRv4 DBNet (RapidOCR) | locate title/credit text (JP/EN) | Apache-2.0 |
| `depth.onnx` *(optional)* | MiDaS v2.1 small | monocular depth for near/far banding | MIT |

Optional models just **skip their stage** when absent — without `text_det` there's
no text layer; without `depth` the background is a single plate.

```bash
python download_models.py --models-dir ./models   # required + optional, best-effort
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

Outputs into `--out` (only the layers that apply are written):

- `manifest.json` — always written. `mode: "layered"` or `mode: "flat"`.
- `background.webp` — opaque inpainted plate (when depth banding is **off**).
- `background-far.webp` / `background-near.webp` — far plate + feathered near band
  (when depth banding is **on**; near drifts more).
- `character.webp` — RGBA foreground, locked (when a character is found).
- `text.webp` — RGBA title/credit text, locked (when text is found).

## The gate

After segmentation the script measures foreground coverage and **refuses to
layer** outside a sane band, emitting `mode: "flat"` so the app shows the normal
static cover:

- `< 10%` coverage → `no-subject` (e.g. painterly art the anime model misses).
- `> 92%` coverage → `full-bleed` (character fills the frame; no background to move).

A character-less cover can still go `layered` **if it has substantial text**
(≥ 2% area) — a drifting plate under a static title. A faint/false text detection
(< 2%) does *not* rescue a painterly cover from `flat`. When a character *is*
present, any text ≥ 0.4% is lifted onto its own layer.

## Notes

- The character layer is **locked** (`motion: null`); only the background drifts,
  so the inpaint never needs to be pixel-perfect — it sits behind a still subject.
- Same `.onnx` files run on CPU (Mac) and CUDA (prod); only `--device` changes.
- ~1 s/cover on an 8 GB CUDA GPU, ~10–16 s/cover CPU. Offline batch; cache by
  `sourceHash` so re-imports skip recompute.
