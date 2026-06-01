/**
 * Deterministic per-cover "living motion" definitions for the Web Animations
 * API. A grid of covers all drifting in lockstep reads as mechanical, so each
 * cover's drift path, duration, and phase are derived from a stable seed (the
 * manga id, or the cover URL as a fallback) — never `Math.random`, so the
 * motion is stable across re-renders and SSR/CSR.
 *
 * The motion is run imperatively via `Element.animate()` (see MangaCover.tsx),
 * not CSS keyframes: that sidesteps CSS-Modules keyframe-scoping quirks and any
 * CSS `animation-play-state` interference, and autoplays reliably.
 *
 * Keyframes stay overscanned (scale ≥ ~1.13 while panning ≤ 5%) so the panning
 * image never reveals a gap at the container edge.
 */

/** Cheap, stable 32-bit string hash (FNV-1a style) for non-numeric seeds. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Normalizes a numeric or string seed to a non-negative integer. */
function toSeedInt(seed: number | string | undefined): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.abs(Math.trunc(seed));
  }
  if (typeof seed === 'string' && seed.length > 0) {
    return hashString(seed);
  }
  return 0;
}

interface CoverVariant {
  /** Two-frame drift (transform endpoints); played `alternate` so it eases back. */
  keyframes: Keyframe[];
  /** Full one-way drift duration in ms. */
  durationMs: number;
}

/**
 * Distinct drift paths. Each combines a clear pan with a modest zoom so the
 * motion is obviously alive (not a static zoom). `translate` percentages are
 * relative to the image's own box, matching CSS semantics.
 */
const VARIANTS: CoverVariant[] = [
  {
    keyframes: [
      { transform: 'scale(1.14) translate(-5%, -4%)' },
      { transform: 'scale(1.18) translate(5%, 4%)' },
    ],
    durationMs: 11000,
  },
  {
    keyframes: [
      { transform: 'scale(1.17) translate(5%, -4%)' },
      { transform: 'scale(1.13) translate(-5%, 5%)' },
    ],
    durationMs: 13000,
  },
  {
    keyframes: [
      { transform: 'scale(1.15) translate(-4%, 5%)' },
      { transform: 'scale(1.19) translate(4%, -5%)' },
    ],
    durationMs: 12000,
  },
];

export interface CoverAnimation {
  /** Transform keyframes for `Element.animate()`. */
  keyframes: Keyframe[];
  /** Iteration duration (ms). */
  durationMs: number;
  /** Start offset (ms) so covers don't move in lockstep (WAA has no negative delay). */
  offsetMs: number;
}

/**
 * Derives a stable drift animation (path + duration + phase offset) for a cover.
 *
 * @param seed - Stable identifier (prefer manga id; falls back to cover URL).
 * @returns Keyframes, duration, and a per-cover start offset for `Element.animate`.
 */
export function getCoverAnimation(seed: number | string | undefined): CoverAnimation {
  const n = toSeedInt(seed);
  const variant = VARIANTS[n % VARIANTS.length] ?? VARIANTS[0];
  // VARIANTS is a non-empty literal, so this is always defined.
  const safe = variant as CoverVariant;
  return {
    keyframes: safe.keyframes,
    durationMs: safe.durationMs,
    offsetMs: n % safe.durationMs,
  };
}

/**
 * Derives a stable per-cover phase offset (ms) for a layered "living cover", so
 * a grid of drifting backgrounds doesn't move in lockstep. WAA has no negative
 * delay, so we seed the start time instead.
 *
 * @param seed - Stable identifier (prefer manga id; falls back to cover URL).
 * @param durationMs - The layer's iteration duration.
 * @returns A start offset in `[0, durationMs)`.
 */
export function getSeedPhaseMs(seed: number | string | undefined, durationMs: number): number {
  if (durationMs <= 0) {
    return 0;
  }
  return toSeedInt(seed) % durationMs;
}
