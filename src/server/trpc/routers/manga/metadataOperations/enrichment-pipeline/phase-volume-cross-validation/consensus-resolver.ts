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
 *   - AniList   raw `anilistCounts.volumes` (scalar; see `witness-counts`)
 *   - MangaDex  `mangadexAggregate` max `volumeNumber`
 *   - MAL       `malResult.volumes`
 *   - Wikipedia distinct volume numbers in `wikipediaResult.data.volumeList`
 *
 * Aggregation:
 *   - 0 sources  -> { count: 0, confidence: 'unknown' }
 *   - 1 source   -> { count: that, confidence: 'low' }
 *   - >=2 within +/-1 -> median of cluster, confidence 'high' if all
 *     sources participate, 'medium' otherwise
 *   - Two disjoint clusters tie -> pick by non-anchor support, then source
 *     priority, confidence 'low'
 *   - No cluster -> source-priority pick (mangadex > anilist > mal >
 *     wikipedia), confidence 'low'
 *
 * MangaUpdates has no volume count field (only `latestChapter`) so it
 * does NOT participate.
 *
 * The cluster-vote mechanics live in the shared `count-consensus` primitive;
 * this file supplies the volume-specific candidate collection and tie-break.
 */

import {
  priorityThenMinFallback,
  resolveCountConsensus,
  type CountConfidence,
  type CountConsensus,
} from './count-consensus';
import { anilistOwnCount, appliedCount, wikipediaVolumeCount } from './witness-counts';

import type { UnifiedProviderResults } from '../types';

export type VolumeConfidence = CountConfidence;
export type VolumeConsensus = CountConsensus;

/** Shared by the no-cluster fallback and the tied-cluster tie-break. */
const SOURCE_PRIORITY = ['mangadex', 'anilist', 'anilist-db', 'mal', 'wikipedia'];

function collectCandidates(
  result: UnifiedProviderResults,
  fallbackAniListVolumes?: number,
): Array<{ source: string; count: number }> {
  const out: Array<{ source: string; count: number }> = [];

  const anilist = anilistOwnCount(result, 'volumes');
  if (anilist > 0) {
    out.push({ source: 'anilist', count: anilist });
  } else if (appliedCount(result, 'volumes') <= 0 && fallbackAniListVolumes !== undefined && fallbackAniListVolumes > 0) {
    // Caller supplied the persisted Metadata.volumes value — used when the
    // applied match is empty mid-pipeline but the manga has a stored AL
    // anchor from a prior run. Not when another provider filled the field
    // this run: MAL already votes for itself below.
    out.push({ source: 'anilist-db', count: fallbackAniListVolumes });
  }

  const mdxVols = result.mangadexAggregate?.volumes ?? [];
  if (mdxVols.length > 0) {
    const mdxMax = Math.max(...mdxVols.map(v => v.volumeNumber).filter(n => n > 0));
    if (mdxMax > 0) out.push({ source: 'mangadex', count: mdxMax });
  }

  const malVols = result.malResult?.volumes;
  if (typeof malVols === 'number' && malVols > 0) out.push({ source: 'mal', count: malVols });

  const wikiVols = wikipediaVolumeCount(result.wikipediaResult?.data.volumeList);
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

/**
 * Aggregate volume-count candidates into a consensus value.
 *
 * Exposed for unit tests and the audit script. The pipeline callsite
 * uses `resolveExpectedVolumeCount` (which composes this + collection).
 *
 * Volume specifics vs the shared primitive: cluster window ±1, the winning
 * cluster collapses to its median, and the no-cluster tie-break prefers rich
 * per-volume sources.
 *
 * iter-PVM-N-tune-1: the no-cluster fallback prefers MDX (per-volume granular
 * data, empirically the most reliable for vol counts) over AL/MAL/WP scalars.
 * Previously fell back to `min()` "to keep the cap tight" but that picked
 * outlier WP stubs over rich MDX (Cyborg 009: AL=27,MDX=19,MAL=15,WP=1 →
 * min picked 1, capping 19 MDX vols to 2). Priority: mangadex >
 * anilist/anilist-db > mal > wikipedia, then a defensive min.
 */
export function aggregateConsensus(
  candidates: Array<{ source: string; count: number }>,
): VolumeConsensus {
  return resolveCountConsensus(candidates, {
    window: 1,
    clusterWinner: (medianValue) => medianValue,
    fallback: priorityThenMinFallback(SOURCE_PRIORITY),
    tieBreakPriority: SOURCE_PRIORITY,
  });
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
