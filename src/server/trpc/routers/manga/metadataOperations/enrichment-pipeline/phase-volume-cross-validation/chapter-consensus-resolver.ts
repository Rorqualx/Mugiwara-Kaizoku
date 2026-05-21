/**
 * Chapter-count consensus resolver (defect 1 of the Sweat-and-Soap audit).
 *
 * Cross-source agreement on the manga's authoritative chapter count. Used
 * to cap `expectedCount` in `mergeEnrichmentChapters` and short-circuit
 * stub-chapter creation when AniList's scalar overshoots reality.
 *
 * Replaces "trust AniList's `Metadata.chapters` outright" which inflated
 * the manifest for series where AniList counts MangaDex split-part
 * releases (1.1/1.2) as full chapters (Sweat and Soap: AL=110, canon=66).
 *
 * Sources (no preference; aggregation handles ties):
 *   - AniList       `appliedMatch.metadata.chapters` (scalar)
 *   - MangaDex      max `chapterEnd` across `mangadexAggregate.volumes`
 *   - MAL           `malResult.chapters`
 *   - Wikipedia     `wikipediaResult.chapterList.length`
 *   - Kitsu         `kitsuResult.chapterCount`
 *   - MangaUpdates  `mangaupdatesResult.latestChapter`
 *
 * Aggregation:
 *   - 0 sources                 -> { count: 0, confidence: 'unknown' }
 *   - 1 source                  -> { count: that, confidence: 'low' }
 *   - >=2 within +/-2 of a seed -> median of cluster, confidence 'high'
 *     if every source participates, 'medium' otherwise
 *   - No cluster found          -> min(sources), confidence 'low'
 *
 * Window is +/-2 (volume resolver uses +/-1) because chapter counts have
 * more natural variance: omake, "Chapter 0", side stories, bonus pages
 * can legitimately add 1-2 to the canonical numbered total.
 *
 * Fandom and ComicVine are intentionally excluded. Fandom chapter lists
 * frequently include omake/extras; CV `issueCount` is per-issue (often
 * per-volume for manga), not per-chapter, so it's not a comparable signal.
 */

import type { UnifiedProviderResults } from '../types';

export type ChapterConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface ChapterConsensus {
  count: number;
  confidence: ChapterConfidence;
  sources: string[];
  raw: Array<{ source: string; count: number }>;
}

const CLUSTER_WINDOW = 2;

/**
 * Provider counts diverge by the number of bonus / side-story / omake
 * chapters each one happens to include. CV's per-volume "Contents" lists
 * count only numbered chapters (97 for Sweat and Soap), while MAL counts
 * bonus mini-chapters too (104) — a 7-row difference that's entirely
 * explained by the bonus stubs in our DB. Widening the cluster window by
 * the observed bonus count keeps that gap from looking like genuine
 * disagreement so a count-with-bonuses isn't rejected as an outlier.
 */
function effectiveWindow(bonusChapterCount: number): number {
  return CLUSTER_WINDOW + Math.max(0, bonusChapterCount);
}

function appliedAniListChapters(result: UnifiedProviderResults): number {
  const appliedMetadata = result.enrichmentResult.appliedMatch?.metadata as Record<string, unknown> | undefined;
  const value = appliedMetadata?.['chapters'];
  return typeof value === 'number' && value > 0 ? value : 0;
}

function collectCandidates(
  result: UnifiedProviderResults,
  fallbackAniListChapters?: number,
): Array<{ source: string; count: number }> {
  const out: Array<{ source: string; count: number }> = [];

  const applied = appliedAniListChapters(result);
  if (applied > 0) {
    out.push({ source: 'anilist', count: applied });
  } else if (fallbackAniListChapters !== undefined && fallbackAniListChapters > 0) {
    out.push({ source: 'anilist-db', count: fallbackAniListChapters });
  }

  const mdxVols = result.mangadexAggregate?.volumes ?? [];
  if (mdxVols.length > 0) {
    const mdxMax = Math.max(...mdxVols.map(v => v.chapterEnd).filter(n => n > 0));
    if (mdxMax > 0) out.push({ source: 'mangadex', count: mdxMax });
  }

  const malCh = result.malResult?.chapters;
  if (typeof malCh === 'number' && malCh > 0) out.push({ source: 'mal', count: malCh });

  const wikiCh = result.wikipediaResult?.chapterList.length ?? 0;
  if (wikiCh > 0) out.push({ source: 'wikipedia', count: wikiCh });

  const kitsuCh = result.kitsuResult?.chapterCount;
  if (typeof kitsuCh === 'number' && kitsuCh > 0) out.push({ source: 'kitsu', count: kitsuCh });

  const muCh = result.mangaupdatesResult?.latestChapter;
  if (typeof muCh === 'number' && muCh > 0) out.push({ source: 'mangaupdates', count: muCh });

  return out;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

export function aggregateChapterConsensus(
  candidates: Array<{ source: string; count: number }>,
  bonusChapterCount = 0,
): ChapterConsensus {
  if (candidates.length === 0) return { count: 0, confidence: 'unknown', sources: [], raw: [] };
  if (candidates.length === 1) {
    const c = candidates[0];
    if (!c) return { count: 0, confidence: 'unknown', sources: [], raw: [] };
    return { count: c.count, confidence: 'low', sources: [c.source], raw: candidates };
  }

  const window = effectiveWindow(bonusChapterCount);
  let bestCluster: Array<{ source: string; count: number }> = [];
  for (const seed of candidates) {
    const cluster = candidates.filter(c => Math.abs(c.count - seed.count) <= window);
    if (cluster.length > bestCluster.length) bestCluster = cluster;
  }

  if (bestCluster.length >= 2) {
    // The cluster includes both numbered-only and includes-bonus counts —
    // take the LOWER of (median, smallest cluster member) as the consensus
    // so we don't accidentally cap the manifest above the numbered set.
    // The bonus stubs are added separately.
    const consensusCount = Math.min(
      median(bestCluster.map(c => c.count)),
      ...bestCluster.map(c => c.count),
    );
    const confidence: ChapterConfidence = bestCluster.length === candidates.length ? 'high' : 'medium';
    return { count: consensusCount, confidence, sources: bestCluster.map(c => c.source), raw: candidates };
  }

  const sorted = [...candidates].sort((a, b) => a.count - b.count);
  const lowest = sorted[0];
  if (!lowest) return { count: 0, confidence: 'unknown', sources: [], raw: candidates };
  return { count: lowest.count, confidence: 'low', sources: [lowest.source], raw: candidates };
}

export function resolveExpectedChapterCount(
  result: UnifiedProviderResults,
  fallbackAniListChapters?: number,
  bonusChapterCount = 0,
): ChapterConsensus {
  return aggregateChapterConsensus(
    collectCandidates(result, fallbackAniListChapters),
    bonusChapterCount,
  );
}
