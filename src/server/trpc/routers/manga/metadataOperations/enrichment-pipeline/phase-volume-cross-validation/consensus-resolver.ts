/**
 * Volume-count consensus resolver (iter-MM-1).
 *
 * Cross-source agreement on the manga's authoritative volume count. Used
 * to feed `crossValidateVolumeRanges`'s `capVolumeCount` guard and any
 * downstream consumer that needs a credible upper bound.
 *
 * Replaces the prior `Math.max(AniList, Wikipedia)` heuristic which
 * over-counted when Wikipedia crawled the parent series's article and
 * inflated the cap above the true count (the SS-vs-parent bug).
 *
 * Sources (in order of preference for tie-break):
 *   - AniList   `metadata.volumes` (scalar)
 *   - MangaDex  `mangadexAggregate` max `volumeNumber`
 *   - MAL       `malResult.volumes`
 *   - Wikipedia `wikipediaResult.data.volumeList.length`
 *
 * Aggregation:
 *   - 0 sources  -> { count: 0, confidence: 'unknown' }
 *   - 1 source   -> { count: that, confidence: 'low' }
 *   - >=2 within +/-1 -> median of cluster, confidence 'high' if all
 *     sources participate, 'medium' otherwise
 *   - No cluster -> min(sources), confidence 'low' (tight cap is safer
 *     than a loose one when sources disagree)
 *
 * MangaUpdates has no volume count field (only `latestChapter`) so it
 * does NOT participate.
 */

import type { UnifiedProviderResults } from '../types';

export type VolumeConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface VolumeConsensus {
  count: number;
  confidence: VolumeConfidence;
  sources: string[];
  raw: Array<{ source: string; count: number }>;
}

/** Read AniList volume count from the applied match, when present. */
function appliedAniListVolumes(result: UnifiedProviderResults): number {
  const appliedMetadata = result.enrichmentResult.appliedMatch?.metadata as Record<string, unknown> | undefined;
  const value = appliedMetadata?.['volumes'];
  return typeof value === 'number' && value > 0 ? value : 0;
}

function collectCandidates(
  result: UnifiedProviderResults,
  fallbackAniListVolumes?: number,
): Array<{ source: string; count: number }> {
  const out: Array<{ source: string; count: number }> = [];

  const applied = appliedAniListVolumes(result);
  if (applied > 0) {
    out.push({ source: 'anilist', count: applied });
  } else if (fallbackAniListVolumes !== undefined && fallbackAniListVolumes > 0) {
    // Caller supplied the persisted Metadata.volumes value — used when the
    // applied match is empty mid-pipeline but the manga has a stored AL
    // anchor from a prior run.
    out.push({ source: 'anilist-db', count: fallbackAniListVolumes });
  }

  const mdxVols = result.mangadexAggregate?.volumes ?? [];
  if (mdxVols.length > 0) {
    const mdxMax = Math.max(...mdxVols.map(v => v.volumeNumber).filter(n => n > 0));
    if (mdxMax > 0) out.push({ source: 'mangadex', count: mdxMax });
  }

  const malVols = result.malResult?.volumes;
  if (typeof malVols === 'number' && malVols > 0) out.push({ source: 'mal', count: malVols });

  const wikiVols = result.wikipediaResult?.data.volumeList?.length ?? 0;
  if (wikiVols > 0) out.push({ source: 'wikipedia', count: wikiVols });

  // iter-PVM-N-tune-1: drop Wikipedia outliers when other sources have rich
  // data. WP `volumeList.length === 1` is almost always a parse-failure stub
  // (the article didn't have a chapter-list table, so the parser returned a
  // single placeholder entry). When any other source reports ≥ 3 volumes,
  // trust them. Surfaced by Anjo (MDX=17, WP=1 → min-fallback picked 1 →
  // capped 17 MDX vols to 2), Cyborg 009 (AL=27,MDX=19,WP=1 → 1), Minami
  // no Teiou (AL=188,MDX=5,WP=1 → 1).
  const wpEntry = out.find(c => c.source === 'wikipedia');
  if (wpEntry?.count === 1 && out.some(c => c.source !== 'wikipedia' && c.count >= 3)) {
    return out.filter(c => c.source !== 'wikipedia');
  }

  return out;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

/**
 * Aggregate volume-count candidates into a consensus value.
 *
 * Exposed for unit tests and the audit script. The pipeline callsite
 * uses `resolveExpectedVolumeCount` (which composes this + collection).
 */
export function aggregateConsensus(
  candidates: Array<{ source: string; count: number }>,
): VolumeConsensus {
  if (candidates.length === 0) return { count: 0, confidence: 'unknown', sources: [], raw: [] };
  if (candidates.length === 1) {
    const c = candidates[0];
    if (!c) return { count: 0, confidence: 'unknown', sources: [], raw: [] };
    return { count: c.count, confidence: 'low', sources: [c.source], raw: candidates };
  }

  // Find the largest cluster where every member is within +/-1 of the cluster median.
  // Try every candidate as a seed; pick the largest cluster.
  let bestCluster: Array<{ source: string; count: number }> = [];
  for (const seed of candidates) {
    const cluster = candidates.filter(c => Math.abs(c.count - seed.count) <= 1);
    if (cluster.length > bestCluster.length) bestCluster = cluster;
  }

  if (bestCluster.length >= 2) {
    const consensusCount = median(bestCluster.map(c => c.count));
    const confidence: VolumeConfidence = bestCluster.length === candidates.length ? 'high' : 'medium';
    return { count: consensusCount, confidence, sources: bestCluster.map(c => c.source), raw: candidates };
  }

  // iter-PVM-N-tune-1: no cluster. Prefer MDX (per-volume granular data,
  // empirically the most reliable for vol counts) over AL/MAL/WP scalars.
  // Previously fell back to `min()` "to keep the cap tight" but that picked
  // outlier WP stubs over rich MDX (Cyborg 009: AL=27,MDX=19,MAL=15,WP=1 →
  // min picked 1, capping 19 MDX vols to 2). Source priority: mangadex >
  // anilist/anilist-db > mal > wikipedia.
  const priority = ['mangadex', 'anilist', 'anilist-db', 'mal', 'wikipedia'];
  for (const source of priority) {
    const c = candidates.find(x => x.source === source);
    if (c) return { count: c.count, confidence: 'low', sources: [c.source], raw: candidates };
  }
  // Defensive: no recognized source — fall back to min.
  const sorted = [...candidates].sort((a, b) => a.count - b.count);
  const lowest = sorted[0];
  if (!lowest) return { count: 0, confidence: 'unknown', sources: [], raw: candidates };
  return { count: lowest.count, confidence: 'low', sources: [lowest.source], raw: candidates };
}

/**
 * Resolve the expected volume count from a UnifiedProviderResults bundle.
 *
 * Returns `{ count: 0, confidence: 'unknown' }` when no source supplies a
 * count; callers should fall back to `Infinity` (no cap) in that case
 * since blocking writes with no evidence is worse than letting them through.
 *
 * `fallbackAniListVolumes` is the persisted `Metadata.volumes` value
 * (DB lookup is the caller's responsibility); used only when no applied
 * AniList match exists in the current run.
 */
export function resolveExpectedVolumeCount(
  result: UnifiedProviderResults,
  fallbackAniListVolumes?: number,
): VolumeConsensus {
  return aggregateConsensus(collectCandidates(result, fallbackAniListVolumes));
}
