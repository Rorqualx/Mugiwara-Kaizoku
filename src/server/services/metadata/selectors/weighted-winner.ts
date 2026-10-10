/**
 * Shared spine for the weighted-vote selectors.
 *
 * `select-numeric` (clustering by value) and `select-categorical` (grouping by
 * normalized value) share the same "sort groups by summed weight, derive a
 * confidence from agreement" logic, so it lives here once.
 *
 * `select-string`, `select-list`, and `select-structured` use genuinely
 * different scoring (richness ranking, frequency union, per-field strategies)
 * and confidence floors, so they intentionally do NOT consume this module.
 */

import { countIndependentWitnesses } from '@/lib/metadata/provider-registry';

/** Minimal shape shared by `select-numeric`'s Cluster and `select-categorical`'s ValueGroup. */
export interface WeightedGroup {
  members: unknown[];
  totalWeight: number;
}

/**
 * Pick the winning group: sort by summed weight desc, tie-break on member
 * count desc (more agreement = stronger), then on the caller's `tieBreak` so
 * an exact tie resolves the same way whatever order the candidates arrived in.
 *
 * Throws if `groups` is empty. Callers guarantee non-empty — both selectors
 * early-return before this when there are zero parsed candidates. `context`
 * names the caller for the (unreachable) error message.
 */
export function pickWeightedWinner<T extends WeightedGroup>(
  groups: T[],
  context: string,
  tieBreak?: (a: T, b: T) => number,
): T {
  const sorted = [...groups].sort((a, b) => {
    if (b.totalWeight !== a.totalWeight) return b.totalWeight - a.totalWeight;
    if (b.members.length !== a.members.length) return b.members.length - a.members.length;
    return tieBreak ? tieBreak(a, b) : 0;
  });
  const winner = sorted[0];
  if (!winner) {
    throw new Error(`${context}: pickWeightedWinner called with empty groups[]`);
  }
  return winner;
}

/**
 * Corroboration factor f(k) for k independent witnesses behind the winner.
 * One source alone is a claim, not a consensus, so it lands in the review-badge
 * band of both weighted field-types; two independent sources clear `accept`
 * when unanimous; three or more add nothing further.
 */
const SINGLE_WITNESS_FACTOR = 0.60;
const TWO_WITNESS_FACTOR = 0.85;

function corroborationFactor(witnesses: number): number {
  if (witnesses >= 3) return 1;
  return witnesses === 2 ? TWO_WITNESS_FACTOR : SINGLE_WITNESS_FACTOR;
}

/**
 * Winner confidence = agreement × f(k).
 *
 * `agreement` is the winning group's share of total field weight; k is the
 * number of independent witnesses in that group (AniList and MAL count as one,
 * see `countIndependentWitnesses`). Both terms can only rise when another
 * source joins the winning group, so corroboration never lowers confidence —
 * the previous formula divided by the group's own total and fell as it grew.
 */
export function computeAgreementConfidence(
  agreement: number,
  winningProviders: readonly string[],
): number {
  return agreement * corroborationFactor(countIndependentWitnesses(winningProviders));
}
