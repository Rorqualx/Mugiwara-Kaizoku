/**
 * Binding-plausibility detection.
 *
 * Detects when a manga's stored volume/chapter count is implausibly low versus
 * a strong consensus of INDEPENDENT (non-anchor) providers — the signature of a
 * wrong provider binding (e.g. Attack on Titan stored as 2 volumes when every
 * independently-searched source says 34).
 *
 * We compare against non-anchor sources only (mangadex, kitsu, mangaupdates,
 * wikipedia): the anchors (anilist, mal) are the bound entities, so they are the
 * suspects when a binding is wrong and must not vote in their own defence.
 *
 * This is a DETECTOR, not an overwriter — the selector already picks the anchor
 * cluster before persistence, and edition differences (e.g. Tomie 1 vs 3 vols)
 * must not be auto-changed. A positive finding flags the manga for reidentify.
 *
 * Thresholds tuned on the metadata-accuracy harness: the true errors (AoT 17×,
 * Black Clover 392×) sit far above the edition noise (Tomie 3×, one-shots 2×,
 * Hellsing/MHA ~1×), with nothing in the 4×–16× band.
 */

import { ANCHOR_PROVIDERS } from '@/lib/metadata/provider-registry';

/** Anchor providers — excluded from the plausibility consensus (from the registry). */
export const PLAUSIBILITY_ANCHORS = new Set<string>(ANCHOR_PROVIDERS);

/** A non-anchor source must have ≥ this many agreeing peers to form consensus. */
export const PLAUSIBILITY_MIN_AGREE = 2;

/** Consensus must be ≥ this multiple of the stored value to flag. */
export const PLAUSIBILITY_RATIO = 4;

/** Two counts "agree" within this relative tolerance (or ±1, whichever larger). */
const AGREE_TOLERANCE = 0.05;

export type CountField = 'volumes' | 'chapters';

export interface CountCandidate {
  provider: string;
  value: number;
}

export interface PlausibilityFinding {
  field: CountField;
  stored: number;
  consensus: number;
  ratio: number;
  agree: number;
}

/**
 * Return a finding when the stored count is implausibly low vs a ≥2-source
 * non-anchor consensus that is ≥4× larger; otherwise null.
 */
export function detectImplausibleCount(
  field: CountField,
  stored: number | null | undefined,
  candidates: CountCandidate[],
): PlausibilityFinding | null {
  if (stored === null || stored === undefined || !Number.isFinite(stored) || stored <= 0) {
    return null;
  }

  const values = candidates
    .filter(c => !PLAUSIBILITY_ANCHORS.has(c.provider))
    .map(c => c.value)
    .filter(v => Number.isFinite(v) && v > 0);
  if (values.length < PLAUSIBILITY_MIN_AGREE) return null;

  // Consensus = the value with the most agreeing peers (ties → the larger value,
  // since we are testing for an implausibly-LOW stored count).
  let consensus = 0;
  let agree = 0;
  for (const v of values) {
    const peers = values.filter(o => Math.abs(o - v) <= Math.max(1, AGREE_TOLERANCE * v)).length;
    if (peers > agree || (peers === agree && v > consensus)) {
      agree = peers;
      consensus = v;
    }
  }
  if (agree < PLAUSIBILITY_MIN_AGREE) return null;

  const ratio = consensus / stored;
  if (ratio < PLAUSIBILITY_RATIO) return null;

  return { field, stored, consensus, ratio: Math.round(ratio * 10) / 10, agree };
}
