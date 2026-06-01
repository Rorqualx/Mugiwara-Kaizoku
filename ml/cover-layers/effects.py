"""Smart effects (Option B) — tag-driven motion presets.

Maps WD14 tags (from `tag_cover.py`) to a mood profile that retunes each drifting
layer's motion, so an action cover drifts livelier than a calm scenery cover.
Leaf module (depends only on the `layers` dicts) so `layerize.py` stays under the
size cap.
"""

from __future__ import annotations

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
