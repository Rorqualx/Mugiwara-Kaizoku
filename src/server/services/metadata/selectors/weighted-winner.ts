/**
 * Shared spine for the weighted-vote selectors.
 *
 * `pickWeightedWinner` and `computeAgreementConfidence` were byte-identical
 * copies in `select-numeric` (clustering by value) and `select-categorical`
 * (grouping by normalized value) — the same "sort groups by summed weight,
 * derive a dampened agreement confidence" logic. They are extracted here
 * verbatim: pure consolidation, zero behavior change (structural lesson #3).
 *
 * `select-string`, `select-list`, and `select-structured` use genuinely
 * different scoring (richness ranking, frequency union, per-field strategies)
 * and confidence floors, so they intentionally do NOT consume this module.
 */

/** Minimal shape shared by `select-numeric`'s Cluster and `select-categorical`'s ValueGroup. */
export interface WeightedGroup {
  members: unknown[];
  totalWeight: number;
}

/**
 * Pick the winning group: sort by summed weight desc, tie-break on member
 * count desc (more agreement = stronger), return the top.
 *
 * Throws if `groups` is empty. Callers guarantee non-empty — both selectors
 * early-return before this when there are zero parsed candidates. `context`
 * names the caller for the (unreachable) error message.
 */
export function pickWeightedWinner<T extends WeightedGroup>(groups: T[], context: string): T {
  // Sort by totalWeight desc, then by member count desc (more agreement = stronger).
  const sorted = [...groups].sort((a, b) => {
    if (b.totalWeight !== a.totalWeight) return b.totalWeight - a.totalWeight;
    return b.members.length - a.members.length;
  });
  const winner = sorted[0];
  if (!winner) {
    throw new Error(`${context}: pickWeightedWinner called with empty groups[]`);
  }
  return winner;
}

/**
 * Per-candidate agreement confidence.
 *
 * `agreement` is the winning group's share of total field weight. This scales
 * it by the winner's share within its own group and adds a `0.5 × agreement`
 * dampening so a sole strong candidate still scores meaningfully, capped at 1.
 *
 * Falls back to bare `agreement` when either weight is non-positive (defensive:
 * when the group total is positive, the max-weight winner is positive too, so
 * the guard only ever fires for the empty/degenerate case).
 */
export function computeAgreementConfidence(
  agreement: number,
  winnerWeight: number,
  winnerGroupTotalWeight: number,
): number {
  return winnerWeight > 0 && winnerGroupTotalWeight > 0
    ? Math.min(1, agreement * (winnerWeight / winnerGroupTotalWeight) + agreement * 0.5)
    : agreement;
}
