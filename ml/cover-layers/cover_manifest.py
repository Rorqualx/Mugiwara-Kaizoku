"""The cover-layer `manifest.json` builder.

The manifest is the artifact the UI reads (served by /api/cover-layers/[id]); the
layerizer service mirrors `mode`/`segmenter`/`smartEffects` into the DB row for
freshness. Kept in its own leaf module so `layerize.py` stays under the size cap.
"""

from __future__ import annotations


def manifest(cover_id: str, src_hash: str, size: tuple[int, int], coverage: float,
             mode: str, layers: list[dict], segmenter: str, reason: str | None = None,
             smart_effects: bool = False, effect: str = "none", tags: list[str] | None = None,
             segmenter_fallback: str | None = None) -> dict:
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
    if segmenter_fallback is not None:
        m["segmenterFallback"] = segmenter_fallback
    return m
