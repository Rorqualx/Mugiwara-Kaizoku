/**
 * Generic count-consensus primitive.
 *
 * Extracted verbatim from the volume (`consensus-resolver.ts`) and chapter
 * (`chapter-consensus-resolver.ts`) resolvers, which were byte-for-byte the
 * same cluster-vote template differing only in four parameters:
 *
 *   1. `window`        — the ±tolerance for cluster membership
 *                        (volumes ±1; chapters ±2 + observed bonus count).
 *   2. candidate list  — which providers contribute a count (stays in each
 *                        resolver's own `collectCandidates`, since the source
 *                        set is metric-specific).
 *   3. `clusterWinner` — how the winning cluster collapses to one number
 *                        (volumes: the median; chapters: min(median, smallest)
 *                        so a bonus-inflated member can't lift the cap).
 *   4. `fallback`      — the no-cluster tie-break (volumes: source-priority
 *                        then min; chapters: plain min).
 *
 * The clustering, confidence classification, and result struct are shared and
 * identical, so they live here once. Behavior is unchanged — this is pure
 * consolidation (structural lesson #3).
 */

export type CountConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface CountCandidate {
  source: string;
  count: number;
}

export interface CountConsensus {
  count: number;
  confidence: CountConfidence;
  sources: string[];
  raw: CountCandidate[];
}

/** How the winning cluster collapses to a single count. */
export type ClusterWinner = (medianValue: number, members: CountCandidate[]) => number;

/** No-cluster tie-break: choose a count from the raw candidates. */
export type CountFallback = (candidates: CountCandidate[]) => CountConsensus;

export interface CountConsensusOptions {
  /** ±tolerance for cluster membership around each seed. */
  window: number;
  /** Collapse the winning cluster to one number. */
  clusterWinner: ClusterWinner;
  /** Applied when no cluster of ≥2 forms. */
  fallback: CountFallback;
}

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

/**
 * Plain-minimum fallback: the lowest count wins (a tight cap is safer than a
 * loose one when sources disagree). Used directly by the chapter resolver and
 * as the defensive tail of the volume resolver's priority fallback.
 */
export function minFallback(candidates: CountCandidate[]): CountConsensus {
  const sorted = [...candidates].sort((a, b) => a.count - b.count);
  const lowest = sorted[0];
  if (!lowest) return { count: 0, confidence: 'unknown', sources: [], raw: candidates };
  return { count: lowest.count, confidence: 'low', sources: [lowest.source], raw: candidates };
}

/**
 * Source-priority fallback: the first present source in `priority` wins; if
 * none match (defensively — the volume collector only emits known sources),
 * fall through to {@link minFallback}.
 */
export function priorityThenMinFallback(priority: string[]): CountFallback {
  return (candidates: CountCandidate[]): CountConsensus => {
    for (const source of priority) {
      const c = candidates.find(x => x.source === source);
      if (c) return { count: c.count, confidence: 'low', sources: [c.source], raw: candidates };
    }
    return minFallback(candidates);
  };
}

/**
 * Aggregate count candidates into a consensus value via seed-clustering.
 *
 *   - 0 candidates            -> { count: 0, confidence: 'unknown' }
 *   - 1 candidate             -> { count: that, confidence: 'low' }
 *   - ≥2 within ±window       -> `clusterWinner`, 'high' if every candidate
 *                                participates, else 'medium'
 *   - no cluster of ≥2 forms  -> `fallback`
 */
export function resolveCountConsensus(
  candidates: CountCandidate[],
  opts: CountConsensusOptions,
): CountConsensus {
  if (candidates.length === 0) return { count: 0, confidence: 'unknown', sources: [], raw: [] };
  if (candidates.length === 1) {
    const c = candidates[0];
    if (!c) return { count: 0, confidence: 'unknown', sources: [], raw: [] };
    return { count: c.count, confidence: 'low', sources: [c.source], raw: candidates };
  }

  // Find the largest cluster where every member is within ±window of the seed.
  // Try every candidate as a seed; pick the largest cluster.
  let bestCluster: CountCandidate[] = [];
  for (const seed of candidates) {
    const cluster = candidates.filter(c => Math.abs(c.count - seed.count) <= opts.window);
    if (cluster.length > bestCluster.length) bestCluster = cluster;
  }

  if (bestCluster.length >= 2) {
    const consensusCount = opts.clusterWinner(median(bestCluster.map(c => c.count)), bestCluster);
    const confidence: CountConfidence = bestCluster.length === candidates.length ? 'high' : 'medium';
    return { count: consensusCount, confidence, sources: bestCluster.map(c => c.source), raw: candidates };
  }

  return opts.fallback(candidates);
}
