"""WD14 anime tagging for the `smartEffects` motion presets (Option B).

Reads what's *in* a cover (Danbooru-vocabulary tags via WD14 ViT-v3, ONNX, no
torch) so `layerize.py` can pick a mood-appropriate drift profile — e.g. a
weapon-heavy action cover drifts livelier than a calm scenery cover.

Optional model: `tagger.onnx` (SmilingWolf/wd-vit-tagger-v3) + `tagger_tags.csv`
(selected_tags.csv: `tag_id,name,category,count`; category 0 = general). Returns
an empty set when the model is absent (the caller falls back to default motion).
"""

from __future__ import annotations

import csv
import pathlib

import numpy as np
import onnxruntime as ort
from PIL import Image

TAG_THRESHOLD = 0.35
GENERAL_CATEGORY = 0


def load_tagger(models_dir: str, providers: list[str]) -> tuple[ort.InferenceSession, list[str], list[int]] | None:
    """Loads the WD14 session + the general/character category-aligned tag table."""
    model = pathlib.Path(models_dir) / "tagger.onnx"
    tags = pathlib.Path(models_dir) / "tagger_tags.csv"
    if not model.exists() or not tags.exists():
        return None
    names: list[str] = []
    cats: list[int] = []
    with tags.open() as f:
        for row in csv.DictReader(f):
            names.append(row["name"])
            cats.append(int(row["category"]))
    return ort.InferenceSession(str(model), providers=providers), names, cats


def tag_cover(loaded: tuple[ort.InferenceSession, list[str], list[int]], rgb: Image.Image,
              threshold: float = TAG_THRESHOLD) -> set[str]:
    """General (category-0) tags above `threshold` for `rgb`."""
    sess, names, cats = loaded
    inp = sess.get_inputs()[0]
    size = inp.shape[1] if isinstance(inp.shape[1], int) else 448
    im = rgb.convert("RGB")
    w, h = im.size
    side = max(w, h)
    square = Image.new("RGB", (side, side), (255, 255, 255))
    square.paste(im, ((side - w) // 2, (side - h) // 2))
    arr = np.asarray(square.resize((size, size), Image.BICUBIC), dtype=np.float32)[:, :, ::-1]  # RGB->BGR
    probs = sess.run([sess.get_outputs()[0].name], {inp.name: arr[None]})[0][0]
    return {
        names[i]
        for i in range(min(len(names), len(probs)))
        if cats[i] == GENERAL_CATEGORY and float(probs[i]) >= threshold
    }
