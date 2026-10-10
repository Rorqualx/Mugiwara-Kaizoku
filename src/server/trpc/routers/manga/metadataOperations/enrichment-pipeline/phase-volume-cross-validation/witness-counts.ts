/**
 * Per-provider count witnesses for the consensus resolvers.
 *
 * A consensus is only worth its confidence if each candidate is that
 * provider's OWN number. Two places used to break that: the "anilist"
 * candidate was read from `appliedMatch.metadata`, which the supplements and
 * the selector overlay rewrite (for an ongoing series whose AniList count is
 * null it holds the MangaUpdates number, so MangaUpdates corroborated itself),
 * and the "wikipedia" candidate was the length of a list padded up to another
 * provider's count (or to a total computed from the list itself). Both resolvers read their witnesses through here.
 */

import type { UnifiedProviderResults } from '../types';

export type CountField = 'chapters' | 'volumes';

function positive(value: unknown): number {
  return typeof value === 'number' && value > 0 ? value : 0;
}

/** The post-overlay value: whichever provider won the field, not necessarily AniList. */
export function appliedCount(result: UnifiedProviderResults, field: CountField): number {
  const metadata = result.enrichmentResult.appliedMatch?.metadata as Record<string, unknown> | undefined;
  return positive(metadata?.[field]);
}

/**
 * AniList's own count for `field`, or 0 when AniList did not supply one.
 *
 * Prefers the raw fetch result. Results built without it (tests, callers
 * outside the fetch phase) fall back to the applied value, but only when its
 * provenance says AniList supplied it.
 */
export function anilistOwnCount(result: UnifiedProviderResults, field: CountField): number {
  if (result.anilistCounts !== undefined) return positive(result.anilistCounts?.[field]);
  const provenance = result.enrichmentResult.appliedMatch?.perFieldProvenance?.[field];
  return provenance === 'anilist' ? appliedCount(result, field) : 0;
}

/**
 * Wikipedia's own chapter count (see `ownChapterCount`). A list emptied by the
 * cross-series gate is no witness at all, whatever the article stated.
 */
export function wikipediaOwnChapterCount(result: UnifiedProviderResults): number {
  const wiki = result.wikipediaResult;
  if (!wiki) return 0;
  const listed = wiki.chapterList.length;
  if (listed === 0) return 0;
  return wiki.ownChapterCount ?? listed;
}
