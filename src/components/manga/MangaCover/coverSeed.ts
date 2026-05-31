/**
 * Deterministic per-cover motion variation.
 *
 * A grid of covers all running the identical Ken-Burns loop in lockstep reads
 * as mechanical. To break that up we vary each cover's motion path and phase
 * from a stable seed (the manga id, or the cover URL as a fallback) — never
 * `Math.random`, so the motion is stable across re-renders and SSR/CSR.
 */

/** Number of distinct Ken-Burns keyframe variants defined in the CSS module. */
export const COVER_VARIANT_COUNT = 3;

/** Base loop duration (seconds) the negative animation-delay is taken modulo of. */
export const COVER_LOOP_SECONDS = 18;

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

export interface CoverMotion {
  /** Which keyframe variant (0..COVER_VARIANT_COUNT-1) this cover uses. */
  variant: number;
  /** Negative animation-delay (seconds) so the loop starts mid-cycle. */
  delaySeconds: number;
}

/**
 * Derives a stable motion variant + phase offset for a cover.
 *
 * @param seed - Stable identifier (prefer manga id; falls back to cover URL).
 * @returns The keyframe variant index and a negative start delay in seconds.
 */
export function getCoverMotion(seed: number | string | undefined): CoverMotion {
  const n = toSeedInt(seed);
  return {
    variant: n % COVER_VARIANT_COUNT,
    delaySeconds: -(n % COVER_LOOP_SECONDS),
  };
}
