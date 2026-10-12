/**
 * MangaUpdates Direct Fetch
 *
 * Fetches series-level metadata from MangaUpdates for the enrichment pipeline.
 * Provides publisher, categories, genres, licensing status, and related series.
 * Does NOT provide per-chapter/per-volume data.
 */

import { mangaUpdatesService } from '@/server/services/mangaupdates/service';
import type { MUSearchHit, MUSeriesDetails } from '@/server/services/mangaupdates/types';
import { logger } from '@/utils/logger';

import { diceCoefficient, hasEditionMismatch, normalizeTitle } from '../utils';

import { dropRejected, mayBindAfterRejection, type MangaUpdatesPinId, type ProviderDirective } from './provider-pins';

const log = logger.child('PhaseProviderFetch:MangaUpdates');

// ============================================================================
// Types
// ============================================================================

export interface MangaUpdatesDirectResult {
  seriesId: number;
  /**
   * MangaUpdates' base36 URL slug extracted from `details.url`
   * (e.g. "o9w1mbt"). The numeric `seriesId` is the API key but the web
   * UI uses the slug — store both so providerMetadata can render a live
   * "View on MangaUpdates" link. `null` when MU doesn't return a parseable
   * URL.
   */
  urlSlug: string | null;
  title: string;
  publisher: string | undefined;
  categories: string[];
  genres: string[];
  status: string;
  licensed: boolean;
  // Extended fields
  completed: boolean;
  type: string;
  year: string;
  bayesianRating: number;
  ratingVotes: number;
  latestChapter: number;
  authors: Array<{ name: string; type: string; authorId: number }>;
  publishers: Array<{ name: string; type: string; notes: string; publisherId: number }>;
  publications: Array<{ publicationName: string; publisherName: string }>;
  relatedSeries: Array<{ name: string; type: string; seriesId: number }>;
  recommendations: Array<{ name: string; seriesId: number; weight: number }>;
  alternativeTitles: string[];
  animeMapping: { start: string; end: string } | null;
  /**
   * Phase 3 #2 (rollout): matcher score the title-similarity selector
   * computed for this result. Undefined when the entry was pin-fetched
   * by series id — the freshness check skips those.
   */
  matchScore?: number;
  /** True when this series was fetched by the user's manual pin, not picked by the matcher. */
  manualPin?: boolean;
}

/**
 * Extract the base36 slug from a MangaUpdates URL like
 * `https://www.mangaupdates.com/series/o9w1mbt/ase-to-sekken`.
 * Returns null when the URL doesn't match the new path scheme.
 */
function extractMangaUpdatesSlug(url: string | undefined): string | null {
  if (!url) return null;
  const match = /\/series\/([a-z0-9]+)(?:\/|$)/.exec(url);
  return match?.[1] ?? null;
}

// ============================================================================
// Cross-Validation Hints
// ============================================================================

/** AniList metadata hints for cross-validating MU search results */
export interface MUSearchHints {
  year?: number | undefined;
  countryOfOrigin?: string | undefined;
  authors?: string[] | undefined;
  alternativeTitles?: string[] | undefined;
}

// ============================================================================
// Fetch Function
// ============================================================================

/** Pattern to detect doujinshi titles (fan works, not official series) */
const DOUJINSHI_PATTERN = /\bdj\b|\bdoujin/i;

/** Map AniList countryOfOrigin to expected MU type */
const COUNTRY_TO_MU_TYPE: Record<string, string> = {
  JP: 'manga', KR: 'manhwa', CN: 'manhua', TW: 'manhua',
};

/**
 * Compute cross-validation bonus/penalty from AniList hints.
 * Returns a score adjustment (positive = bonus, negative = penalty).
 */
function computeHintAdjustment(hit: MUSearchHit, hints: MUSearchHints): number {
  let adjustment = 0;
  const muType = hit.record.type.toLowerCase();
  const muYear = parseInt(hit.record.year, 10);

  // Country/type concordance
  if (hints.countryOfOrigin) {
    const expectedType = COUNTRY_TO_MU_TYPE[hints.countryOfOrigin];
    if (expectedType) {
      if (muType === expectedType) adjustment += 0.15;
      else if (muType && muType !== expectedType) adjustment -= 0.3;
    }
  }

  // Year concordance
  if (hints.year && !isNaN(muYear)) {
    const yearDiff = Math.abs(hints.year - muYear);
    if (yearDiff <= 2) adjustment += 0.1;
    else if (yearDiff > 5) adjustment -= 0.25;
  }

  return adjustment;
}

/** Lowest final score (title + bonuses) a candidate may be bound at. */
const MIN_FINAL_SCORE = 0.3;

/**
 * Lowest TITLE score a candidate needs before bonuses count. Type (+0.15),
 * year (+0.10) and popularity (up to +0.15) add up to 0.40, so without this a
 * popular same-year series with no title overlap at all cleared the 0.30
 * floor in the AniList-hinted path. Set to the same 0.30: the title has to
 * clear the floor by itself and the bonuses only rank title-plausible
 * candidates against each other.
 */
export const MIN_TITLE_SCORE = 0.3;

/**
 * Pick the MangaUpdates result with the best title match.
 *
 * Scoring combines title similarity (dice coefficient) with popularity
 * weighting (rating_votes) and optional AniList cross-validation hints
 * to disambiguate same-name series. Filters out doujinshi and
 * edition/spinoff mismatches.
 */
export function pickBestMUMatch(hits: MUSearchHit[], query: string, hints?: MUSearchHints): { hit: MUSearchHit; score: number } | null {
  const normalized = normalizeTitle(query);
  const normalizedQueryLen = Math.max(normalized.length, 1);
  let best: MUSearchHit | null = null;
  let bestScore = 0;

  for (const hit of hits) {
    const title = hit.record.title;

    // Skip doujinshi (fan works)
    if (DOUJINSHI_PATTERN.test(title) || DOUJINSHI_PATTERN.test(hit.hit_title)) continue;

    // Per-candidate adjusted scoring. The length-ratio penalty must follow
    // the candidate that produced the score, not be applied blanket from
    // `record.title`. Otherwise a perfect `hit_title` exact match (e.g. MU's
    // "Love in Hell" alias on entry "Jigokuren - Love in the Hell") gets
    // halved by the canonical title's length and loses to coincidental
    // shorter matches like "Alice in Hell" → "Jigoku no Alice".
    const queryVariants = [normalized, ...(hints?.alternativeTitles ?? []).map(normalizeTitle)];

    // A candidate that exactly (or near-exactly) matches a known title variant
    // is a confirmed alias — bypass the edition/spinoff gate. Otherwise markers
    // like "Shin" in "Shin Seiki Evangelion" (新世紀 = New Century, part of NGE's
    // real title) wrongly trip the spinoff filter even though MU returned it as
    // a known synonym of the queried series.
    const normTitle = normalizeTitle(title);
    const matchesKnownVariant = queryVariants.some(
      qv => qv.length >= 4 && diceCoefficient(qv, normTitle) >= 0.9,
    );
    if (!matchesKnownVariant && hasEditionMismatch(query, title)) continue;

    const candidates = [hit.hit_title, title].filter(Boolean);
    let titleScore = 0;
    for (const c of candidates) {
      const normC = normalizeTitle(c);
      const lengthRatio = normC.length / normalizedQueryLen;
      const lengthMultiplier = lengthRatio > 1.5 ? Math.max(0.5, 1 / lengthRatio) : 1;
      for (const qv of queryVariants) {
        const adjusted = diceCoefficient(qv, normC) * lengthMultiplier;
        if (adjusted > titleScore) titleScore = adjusted;
      }
    }

    // Popularity boost (log scale, max +0.15)
    const votes = hit.record.rating_votes;
    const popularityBonus = votes > 0 ? Math.min(0.15, Math.log10(votes) / 25) : 0;

    // Cross-validation bonus/penalty from AniList hints
    const hintAdjustment = hints ? computeHintAdjustment(hit, hints) : 0;

    if (titleScore < MIN_TITLE_SCORE) continue;

    const finalScore = titleScore + popularityBonus + hintAdjustment;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      best = hit;
    }
  }

  // Require minimum similarity (after adjustments)
  if (bestScore < MIN_FINAL_SCORE) {
    log.warn('MangaUpdates: best match too dissimilar', { query, bestScore: bestScore.toFixed(2) });
    return null;
  }

  if (best) {
    log.info('MangaUpdates: title-matched', {
      title: best.record.title,
      score: bestScore.toFixed(2),
      votes: best.record.rating_votes,
    });
    return { hit: best, score: bestScore };
  }

  return null;
}

/** Map a MangaUpdates series payload to the pipeline's result shape. */
function buildMangaUpdatesResult(details: MUSeriesDetails): MangaUpdatesDirectResult {
  const englishPublisher = details.publishers.find(p => p.type === 'English');
  const originalPublisher = details.publishers.find(p => p.type === 'Original');
  const hasAnime = details.anime.start || details.anime.end;

  return {
    seriesId: details.series_id,
    urlSlug: extractMangaUpdatesSlug(details.url),
    title: details.title,
    publisher: englishPublisher?.publisher_name ?? originalPublisher?.publisher_name,
    categories: details.categories
      .filter(c => c.votes_plus > c.votes_minus)
      .map(c => c.category),
    genres: details.genres.map(g => g.genre),
    status: details.status,
    licensed: details.licensed,
    completed: details.completed,
    type: details.type,
    year: details.year,
    bayesianRating: details.bayesian_rating,
    ratingVotes: details.rating_votes,
    latestChapter: details.latest_chapter,
    authors: details.authors.map(a => ({
      name: a.name, type: a.type, authorId: a.author_id,
    })),
    publishers: details.publishers.map(p => ({
      name: p.publisher_name, type: p.type, notes: p.notes, publisherId: p.publisher_id,
    })),
    publications: details.publications.map(p => ({
      publicationName: p.publication_name, publisherName: p.publisher_name,
    })),
    relatedSeries: details.related_series.map(r => ({
      name: r.related_series_name, type: r.relation_type, seriesId: r.related_series_id,
    })),
    recommendations: details.recommendations.slice(0, 15).map(r => ({
      name: r.series_name, seriesId: r.series_id, weight: r.weight,
    })),
    alternativeTitles: details.associated.map(a => a.title),
    animeMapping: hasAnime ? { start: details.anime.start, end: details.anime.end } : null,
  };
}

function logMatched(details: MUSeriesDetails, result: MangaUpdatesDirectResult, message: string): void {
  log.info(message, {
    seriesId: result.seriesId,
    title: details.title,
    publisher: result.publisher,
    status: details.status,
    licensed: details.licensed,
    categories: details.categories.length,
    related: details.related_series.length,
    recommendations: details.recommendations.length,
  });
}

/**
 * Fetch the manually pinned series by id. Returns null — so the caller falls
 * back to the matcher — when the API has no such series, or when the id was
 * decoded from a slug and the series it resolves to carries a different slug
 * (the decode is then not to be trusted for this entry).
 */
async function fetchPinnedMangaUpdates(pin: MangaUpdatesPinId): Promise<MangaUpdatesDirectResult | null> {
  const details = await mangaUpdatesService.getSeriesDetails(pin.seriesId);
  if (!details) {
    log.warn('MangaUpdates: manual binding not found via API — falling back to the matcher', { ...pin });
    return null;
  }
  const result = buildMangaUpdatesResult(details);
  if (pin.slug !== null && result.urlSlug !== null && result.urlSlug !== pin.slug) {
    log.warn('MangaUpdates: manual binding slug does not match the fetched series — falling back to the matcher', {
      ...pin, fetchedSlug: result.urlSlug,
    });
    return null;
  }
  logMatched(details, result, 'MangaUpdates: honoring manual binding (matcher skipped)');
  return { ...result, manualPin: true };
}

/**
 * Fetch MangaUpdates series-level metadata directly.
 * Provides publisher, categories, genres, licensing status, and related series.
 * When hints are provided, searches multiple title variants and uses
 * cross-validation scoring for better disambiguation.
 *
 * The directive carries the user's binding decisions: an unbound provider is
 * not fetched, a manual pin is fetched by id, and rejected series are removed
 * before the picker runs (all rejected → null, never a rejected id).
 */
export async function fetchMangaUpdatesDirect(
  title: string,
  hints?: MUSearchHints,
  directive?: ProviderDirective<MangaUpdatesPinId>,
): Promise<MangaUpdatesDirectResult | null> {
  const pin = directive?.pin ?? { kind: 'none' };
  const onFailure = directive?.onFailure;
  if (pin.kind === 'unbound') {
    log.info('MangaUpdates: skipping — manually marked as unbound', { title });
    return null;
  }
  if (pin.kind === 'pinned') {
    // No failure sink here: a pin that cannot be fetched falls back to the
    // search below, and an outage is reported from there.
    const pinned = await fetchPinnedMangaUpdates(pin.id);
    if (pinned) return pinned;
  } else if (pin.kind === 'unusable') {
    log.warn('MangaUpdates: manual binding id is not usable — running the matcher', { raw: pin.raw, reason: pin.reason });
  }

  // Build search queries: original title + any alternative titles from hints
  const queries = new Set([title]);
  for (const alt of hints?.alternativeTitles ?? []) {
    if (alt.length >= 3) queries.add(alt);
  }

  // Search with all title variants, deduplicate by series_id
  const seenIds = new Set<number>();
  const allHits: MUSearchHit[] = [];
  for (const q of queries) {
    // eslint-disable-next-line no-await-in-loop -- MangaUpdates is rate-limited and the loop runs only over title + alternative titles (typically 1-5 queries); serial avoids 429s
    const hits = await mangaUpdatesService.searchSeries(q, 10, onFailure);
    for (const hit of hits) {
      if (!seenIds.has(hit.record.series_id)) {
        seenIds.add(hit.record.series_id);
        allHits.push(hit);
      }
    }
  }

  const candidates = dropRejected(allHits, (hit) => String(hit.record.series_id), directive?.rejectedIds);
  if (candidates.length === 0) {
    log.info('MangaUpdates: no results found', {
      title, queries: queries.size, rejectedSkipped: allHits.length,
    });
    return null;
  }

  // Pick best match with cross-validation hints
  const bestMatch = pickBestMUMatch(candidates, title, hints);
  if (!bestMatch) return null;
  const rejectedSkipped = allHits.length - candidates.length;
  if (!mayBindAfterRejection('mangaupdates', bestMatch.score, rejectedSkipped)) {
    log.info('MangaUpdates: best remaining candidate after a rejection is too weak to bind', {
      title, seriesId: bestMatch.hit.record.series_id, score: bestMatch.score, rejectedSkipped,
    });
    return null;
  }

  const details = await mangaUpdatesService.getSeriesDetails(bestMatch.hit.record.series_id, onFailure);
  if (!details) return null;

  const result = buildMangaUpdatesResult(details);
  logMatched(details, result, 'MangaUpdates: matched');
  return { ...result, matchScore: bestMatch.score };
}

// Metadata merge helpers live in ./mangaupdates-supplements (file-size split).
export { buildMangaUpdatesMetadataSupplements } from './mangaupdates-supplements';

// ============================================================================
// AniList Cross-Validation
// ============================================================================

/** Check if MU type contradicts AniList country of origin */
function hasCountryMismatch(country: string | undefined, muType: string): boolean {
  if (!country) return false;
  const muLower = muType.toLowerCase();
  if (country === 'KR' && muLower !== 'manhwa') return true;
  if ((country === 'CN' || country === 'TW') && muLower !== 'manhua') return true;
  if (country === 'JP' && (muLower === 'manhwa' || muLower === 'manhua')) return true;
  return false;
}

/**
 * Re-verify a MangaUpdates match using AniList metadata.
 * If the initial title-only match has suspicious year/country divergence,
 * re-searches with alternative titles and cross-validation scoring.
 *
 * Not called for a manually pinned or unbound series; `rejectedIds` keeps the
 * re-search from landing on an entity the user rejected.
 */
export async function verifyMUWithAniList(
  title: string,
  hints: MUSearchHints,
  existing: MangaUpdatesDirectResult | null,
  rejectedIds?: ReadonlySet<string>,
): Promise<MangaUpdatesDirectResult | null> {
  const directive: ProviderDirective<MangaUpdatesPinId> = {
    pin: { kind: 'none' }, rejectedIds: rejectedIds ?? new Set<string>(),
  };
  const alTitles = hints.alternativeTitles ?? [];

  // If no existing match, try with hints + alternative titles
  if (!existing) {
    if (alTitles.length > 0) {
      return fetchMangaUpdatesDirect(title, hints, directive);
    }
    return null;
  }

  // Check if existing match is plausible
  const muYear = parseInt(existing.year, 10);
  const yearGap = hints.year && !isNaN(muYear) ? Math.abs(hints.year - muYear) : 0;
  const countryMismatch = hasCountryMismatch(hints.countryOfOrigin, existing.type);

  // If year gap >5 or country mismatch, re-search with hints
  if (yearGap > 5 || countryMismatch) {
    log.info('MU: re-verifying with AniList hints', {
      title, existingMU: existing.title, yearGap, countryMismatch,
    });
    const better = await fetchMangaUpdatesDirect(title, hints, directive);
    return better ?? existing;
  }

  return existing;
}
