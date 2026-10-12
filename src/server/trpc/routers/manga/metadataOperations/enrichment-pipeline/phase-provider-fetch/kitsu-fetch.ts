/**
 * Kitsu Direct Fetch
 *
 * Searches kitsu.io for a manga, picks the best title match, returns
 * series-level supplemental metadata. Kitsu has good age-rating and
 * community-curated category coverage; treated as supplemental to AniList.
 */

import { kitsuService } from '@/server/services/kitsu';
import type { KitsuManga } from '@/server/services/kitsu';
import { logger } from '@/utils/logger';

import { diceCoefficient, hasEditionMismatch, normalizeTitle } from '../utils';

import { dropRejected, mayBindAfterRejection, type ProviderDirective } from './provider-pins';

const log = logger.child('PhaseProviderFetch:Kitsu');

export interface KitsuDirectResult {
  kitsuId: string;
  slug: string;
  canonicalTitle: string;
  alternativeTitles: string[];
  synopsis: string | undefined;
  status: string;
  subtype: string;
  ageRating: string | undefined;
  ageRatingGuide: string | undefined;
  chapterCount: number | undefined;
  volumeCount: number | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
  serialization: string | undefined;
  averageRating: number | undefined;
  userCount: number;
  favoritesCount: number;
  posterImageUrl: string | undefined;
  coverImageUrl: string | undefined;
  /**
   * Phase 3 #2 (rollout): matcher score the title-similarity selector
   * computed for this result. Undefined when the entry was pin-fetched
   * by ID — the freshness check skips those.
   */
  matchScore?: number;
  /** True when this entry was fetched by the user's manual pin, not picked by the matcher. */
  manualPin?: boolean;
}

export interface KitsuSearchHints {
  year?: number | undefined;
  alternativeTitles?: string[] | undefined;
}

function pickBestPosterUrl(poster: KitsuManga['attributes']['posterImage']): string | undefined {
  if (!poster) return undefined;
  return poster.original ?? poster.large ?? poster.medium ?? poster.small ?? poster.tiny;
}

function pickBestCoverUrl(cover: KitsuManga['attributes']['coverImage']): string | undefined {
  if (!cover) return undefined;
  return cover.original ?? cover.large ?? cover.small ?? cover.tiny;
}

function collectAlternativeTitles(attrs: KitsuManga['attributes']): string[] {
  const titles = new Set<string>();
  for (const value of Object.values(attrs.titles)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      titles.add(value.trim());
    }
  }
  for (const abbr of attrs.abbreviatedTitles ?? []) {
    if (abbr.trim().length > 0) titles.add(abbr.trim());
  }
  titles.delete(attrs.canonicalTitle);
  return [...titles];
}

function scoreCandidate(hit: KitsuManga, query: string, hints?: KitsuSearchHints): number {
  const normQuery = normalizeTitle(query);
  const candidates = collectAlternativeTitles(hit.attributes);
  candidates.push(hit.attributes.canonicalTitle);
  const queryVariants = [normQuery, ...(hints?.alternativeTitles ?? []).map(normalizeTitle)];

  // Per-candidate length penalty: apply the length-ratio penalty against the
  // SPECIFIC title being matched, not blanket on the canonical title. The old
  // code penalized the best titleScore (which may have come from a short
  // alt-title match) using the canonical title's length — so a candidate whose
  // short English alt-title was a near-exact query match got docked for having
  // a long JP canonical. Mirrors pickBestMUMatch's per-candidate treatment.
  const normQueryLen = Math.max(normQuery.length, 1);
  let titleScore = 0;
  for (const c of candidates) {
    const normC = normalizeTitle(c);
    if (normC.length === 0) continue;
    const lengthRatio = normC.length / normQueryLen;
    const lengthMultiplier = lengthRatio > 1.5 ? Math.max(0.5, 1 / lengthRatio) : 1;
    for (const qv of queryVariants) {
      const adjusted = diceCoefficient(qv, normC) * lengthMultiplier;
      if (adjusted > titleScore) titleScore = adjusted;
    }
  }

  const popularityBonus = hit.attributes.favoritesCount > 0
    ? Math.min(0.1, Math.log10(hit.attributes.favoritesCount + 1) / 30)
    : 0;

  let yearAdjust = 0;
  if (hints?.year && hit.attributes.startDate) {
    const kitsuYear = parseInt(hit.attributes.startDate.slice(0, 4), 10);
    if (!isNaN(kitsuYear)) {
      const diff = Math.abs(hints.year - kitsuYear);
      if (diff <= 2) yearAdjust = 0.1;
      else if (diff > 5) yearAdjust = -0.2;
    }
  }

  return titleScore + popularityBonus + yearAdjust;
}

function pickBestKitsuMatch(
  hits: KitsuManga[], query: string, hints?: KitsuSearchHints,
): { hit: KitsuManga; score: number } | null {
  let best: KitsuManga | null = null;
  let bestScore = 0;

  for (const hit of hits) {
    if (hasEditionMismatch(query, hit.attributes.canonicalTitle)) continue;
    const score = scoreCandidate(hit, query, hints);
    if (score > bestScore) {
      bestScore = score;
      best = hit;
    }
  }

  if (bestScore < 0.3) {
    log.warn('Kitsu: best match too dissimilar', { query, bestScore: bestScore.toFixed(2) });
    return null;
  }
  if (best) {
    log.info('Kitsu: title-matched', {
      title: best.attributes.canonicalTitle,
      score: bestScore.toFixed(2),
      favoritesCount: best.attributes.favoritesCount,
    });
    return { hit: best, score: bestScore };
  }
  return null;
}

function buildResult(hit: KitsuManga): KitsuDirectResult {
  const attrs = hit.attributes;
  const synopsisRaw = attrs.synopsis ?? attrs.description ?? undefined;
  const synopsis = synopsisRaw && synopsisRaw.trim().length > 0 ? synopsisRaw.trim() : undefined;
  const averageRating = attrs.averageRating ? parseFloat(attrs.averageRating) : undefined;

  return {
    kitsuId: hit.id,
    slug: attrs.slug,
    canonicalTitle: attrs.canonicalTitle,
    alternativeTitles: collectAlternativeTitles(attrs),
    synopsis,
    status: attrs.status,
    subtype: attrs.subtype,
    ageRating: attrs.ageRating ?? undefined,
    ageRatingGuide: attrs.ageRatingGuide ?? undefined,
    chapterCount: attrs.chapterCount ?? undefined,
    volumeCount: attrs.volumeCount ?? undefined,
    startDate: attrs.startDate ?? undefined,
    endDate: attrs.endDate ?? undefined,
    serialization: attrs.serialization ?? undefined,
    averageRating: averageRating !== undefined && !isNaN(averageRating) ? averageRating : undefined,
    userCount: attrs.userCount,
    favoritesCount: attrs.favoritesCount,
    posterImageUrl: pickBestPosterUrl(attrs.posterImage),
    coverImageUrl: pickBestCoverUrl(attrs.coverImage),
  };
}

/**
 * Map a KitsuDirectResult to the UnifiedProviderResults.kitsuResult shape.
 * Currently identity, but kept as a seam in case the unified shape diverges.
 */
export function mapKitsuToUnifiedResult(kitsu: KitsuDirectResult): KitsuDirectResult {
  return { ...kitsu };
}

function logMatched(result: KitsuDirectResult, message: string): void {
  log.info(message, {
    kitsuId: result.kitsuId,
    slug: result.slug,
    canonicalTitle: result.canonicalTitle,
    chapterCount: result.chapterCount,
    volumeCount: result.volumeCount,
    ageRating: result.ageRating,
  });
}

/**
 * Fetch the manually pinned entry by numeric id. Null (API failure or unknown
 * id) sends the caller back to the matcher.
 */
async function fetchPinnedKitsu(kitsuId: string): Promise<KitsuDirectResult | null> {
  // No failure sink here: a pin that cannot be fetched falls back to the
  // search, and an outage is reported from there.
  const hit = await kitsuService.getMangaDetails(kitsuId);
  if (!hit) {
    log.warn('Kitsu: manual binding not found via API — falling back to the matcher', { kitsuId });
    return null;
  }
  const result: KitsuDirectResult = { ...buildResult(hit), manualPin: true };
  logMatched(result, 'Kitsu: honoring manual binding (matcher skipped)');
  return result;
}

/**
 * Fetch Kitsu series-level metadata directly. Searches by title (with optional
 * alt-title hints), scores candidates, returns the best match or null.
 *
 * The directive carries the user's binding decisions: an unbound provider is
 * not fetched, a manual numeric pin is fetched by id, and rejected entries are
 * removed before the picker runs (all rejected → null, never a rejected id).
 */
export async function fetchKitsuDirect(
  title: string,
  hints?: KitsuSearchHints,
  directive?: ProviderDirective<string>,
): Promise<KitsuDirectResult | null> {
  const pin = directive?.pin ?? { kind: 'none' };
  if (pin.kind === 'unbound') {
    log.info('Kitsu: skipping — manually marked as unbound', { title });
    return null;
  }
  if (pin.kind === 'pinned') {
    const pinned = await fetchPinnedKitsu(pin.id);
    if (pinned) return pinned;
  } else if (pin.kind === 'unusable') {
    log.warn('Kitsu: manual binding id is not usable — running the matcher', { raw: pin.raw, reason: pin.reason });
  }

  const queries = new Set([title]);
  for (const alt of hints?.alternativeTitles ?? []) {
    if (alt.length >= 3) queries.add(alt);
  }

  const seenIds = new Set<string>();
  const allHits: KitsuManga[] = [];
  for (const q of queries) {
    // eslint-disable-next-line no-await-in-loop -- Sequential by design; rate limiter throttles
    const hits = await kitsuService.searchManga(q, 5, directive?.onFailure);
    for (const hit of hits) {
      if (!seenIds.has(hit.id)) {
        seenIds.add(hit.id);
        allHits.push(hit);
      }
    }
  }

  const candidates = dropRejected(allHits, (hit) => hit.id, directive?.rejectedIds);
  if (candidates.length === 0) {
    log.info('Kitsu: no results found', { title, queries: queries.size, rejectedSkipped: allHits.length });
    return null;
  }

  const best = pickBestKitsuMatch(candidates, title, hints);
  if (!best) return null;
  const rejectedSkipped = allHits.length - candidates.length;
  if (!mayBindAfterRejection('kitsu', best.score, rejectedSkipped)) {
    log.info('Kitsu: best remaining candidate after a rejection is too weak to bind', {
      title, id: best.hit.id, score: best.score, rejectedSkipped,
    });
    return null;
  }

  const result = { ...buildResult(best.hit), matchScore: best.score };
  logMatched(result, 'Kitsu: matched');
  return result;
}
