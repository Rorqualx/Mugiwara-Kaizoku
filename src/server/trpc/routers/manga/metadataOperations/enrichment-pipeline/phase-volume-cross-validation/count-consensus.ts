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
 * identical, so they live here once.
 *
 * The result never depends on candidate order: equally large clusters are
 * ranked by {@link compareClusters}, and a tie between clusters that share no
 * member is reported as 'low' because the sources then split evenly.
 */

import { isAnchor } from '@/lib/metadata/provider-registry';

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
  /** Source order that settles equally sized clusters; earlier wins. */
  tieBreakPriority?: string[];
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

/** `anilist-db` is AniList's stored count, so it is an anchor like `anilist`. */
function isAnchorSource(source: string): boolean {
  return isAnchor(source.replace(/-db$/u, ''));
}

function nonAnchorSupport(cluster: CountCandidate[]): number {
  return new Set(cluster.filter(c => !isAnchorSource(c.source)).map(c => c.source)).size;
}

/** Best (lowest) priority rank held by any member; unlisted sources rank last. */
function bestRank(cluster: CountCandidate[], priority: string[]): number {
  let best = priority.length;
  for (const c of cluster) {
    const rank = priority.indexOf(c.source);
    if (rank !== -1 && rank < best) best = rank;
  }
  return best;
}

/**
 * Order clusters best-first: more members, then more distinct non-anchor
 * sources (AniList and MAL share one binding, so a cluster of only those two
 * is one opinion), then source priority, then the lower count so the order is
 * total and a tight cap wins when nothing else separates them.
 */
function compareClusters(a: CountCandidate[], b: CountCandidate[], priority: string[]): number {
  if (a.length !== b.length) return b.length - a.length;
  const support = nonAnchorSupport(b) - nonAnchorSupport(a);
  if (support !== 0) return support;
  const rank = bestRank(a, priority) - bestRank(b, priority);
  if (rank !== 0) return rank;
  return Math.min(...a.map(c => c.count)) - Math.min(...b.map(c => c.count));
}

/**
 * Every distinct cluster of candidates within ±window of some seed. Members
 * are compared by reference, so two seeds that gather the same candidates
 * yield one cluster.
 */
function distinctClusters(candidates: CountCandidate[], window: number): CountCandidate[][] {
  const clusters: CountCandidate[][] = [];
  for (const seed of candidates) {
    const cluster = candidates.filter(c => Math.abs(c.count - seed.count) <= window);
    const duplicate = clusters.some(k => k.length === cluster.length && k.every(c => cluster.includes(c)));
    if (!duplicate) clusters.push(cluster);
  }
  return clusters;
}

/** How far apart candidates may be and still bound the count together. */
const SOFT_CEILING_SPREAD = 0.10;

/**
 * Upper bound that survives a 'low' consensus.
 *
 * 'low' means the candidates did not cluster tightly enough to name a count —
 * not that nothing is known. When every candidate lies within 10% of the
 * largest (1171 vs 1185 vs 1194), the largest is still a safe ceiling for
 * creating stub chapters: no source claims more. Returns null with fewer than
 * two candidates or a wider spread, where any ceiling would be a guess.
 */
export function softCountCeiling(candidates: CountCandidate[]): number | null {
  if (candidates.length < 2) return null;
  const counts = candidates.map(c => c.count);
  const highest = Math.max(...counts);
  const lowest = Math.min(...counts);
  if (lowest <= 0 || lowest < highest * (1 - SOFT_CEILING_SPREAD)) return null;
  return highest;
}

/**
 * Aggregate count candidates into a consensus value via seed-clustering.
 *
 *   - 0 candidates            -> { count: 0, confidence: 'unknown' }
 *   - 1 candidate             -> { count: that, confidence: 'low' }
 *   - ≥2 within ±window       -> `clusterWinner`, 'high' if every candidate
 *                                participates, else 'medium'
 *   - two disjoint clusters   -> `clusterWinner` of the better-ranked one,
 *     of the same size           'low' (e.g. [2, 2, 34, 34])
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

  const priority = opts.tieBreakPriority ?? [];
  const ranked = distinctClusters(candidates, opts.window).sort((a, b) => compareClusters(a, b, priority));
  const bestCluster = ranked[0] ?? [];

  if (bestCluster.length >= 2) {
    const consensusCount = opts.clusterWinner(median(bestCluster.map(c => c.count)), bestCluster);
    // Overlapping runners-up (10,11,12 vs 11,12,13) are the same neighbourhood
    // seen from two seeds, not a split; only a disjoint rival of equal size is.
    const split = ranked.some(k => k !== bestCluster && k.length === bestCluster.length && !k.some(c => bestCluster.includes(c)));
    let confidence: CountConfidence = bestCluster.length === candidates.length ? 'high' : 'medium';
    if (split) confidence = 'low';
    return { count: consensusCount, confidence, sources: bestCluster.map(c => c.source), raw: candidates };
  }

  return opts.fallback(candidates);
}
