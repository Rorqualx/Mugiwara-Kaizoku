/**
 * MangaUpdates Direct Fetch
 *
 * Fetches series-level metadata from MangaUpdates for the enrichment pipeline.
 * Provides publisher, categories, genres, licensing status, and related series.
 * Does NOT provide per-chapter/per-volume data.
 */

import { mangaUpdatesService } from '@/server/services/mangaupdates/service';
import type { MUSearchHit } from '@/server/services/mangaupdates/types';
import { logger } from '@/utils/logger';

import { diceCoefficient, hasEditionMismatch, normalizeTitle } from '../utils';

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

/**
 * Pick the MangaUpdates result with the best title match.
 *
 * Scoring combines title similarity (dice coefficient) with popularity
 * weighting (rating_votes) and optional AniList cross-validation hints
 * to disambiguate same-name series. Filters out doujinshi and
 * edition/spinoff mismatches.
 */
export function pickBestMUMatch(hits: MUSearchHit[], query: string, hints?: MUSearchHints): MUSearchHit | null {
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

    const finalScore = titleScore + popularityBonus + hintAdjustment;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      best = hit;
    }
  }

  // Require minimum similarity (after adjustments)
  if (bestScore < 0.3) {
    log.warn('MangaUpdates: best match too dissimilar', { query, bestScore: bestScore.toFixed(2) });
    return null;
  }

  if (best) {
    log.info('MangaUpdates: title-matched', {
      title: best.record.title,
      score: bestScore.toFixed(2),
      votes: best.record.rating_votes,
    });
  }

  return best;
}

/**
 * Fetch MangaUpdates series-level metadata directly.
 * Provides publisher, categories, genres, licensing status, and related series.
 * When hints are provided, searches multiple title variants and uses
 * cross-validation scoring for better disambiguation.
 */
export async function fetchMangaUpdatesDirect(
  title: string,
  hints?: MUSearchHints,
): Promise<MangaUpdatesDirectResult | null> {
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
    const hits = await mangaUpdatesService.searchSeries(q, 10);
    for (const hit of hits) {
      if (!seenIds.has(hit.record.series_id)) {
        seenIds.add(hit.record.series_id);
        allHits.push(hit);
      }
    }
  }

  if (allHits.length === 0) {
    log.info('MangaUpdates: no results found', { title, queries: queries.size });
    return null;
  }

  // Pick best match with cross-validation hints
  const bestHit = pickBestMUMatch(allHits, title, hints);
  if (!bestHit) return null;

  const seriesId = bestHit.record.series_id;
  const details = await mangaUpdatesService.getSeriesDetails(seriesId);
  if (!details) return null;

  const englishPublisher = details.publishers.find(p => p.type === 'English');
  const originalPublisher = details.publishers.find(p => p.type === 'Original');

  const hasAnime = details.anime.start || details.anime.end;

  log.info('MangaUpdates: matched', {
    seriesId,
    title: details.title,
    publisher: englishPublisher?.publisher_name ?? originalPublisher?.publisher_name,
    status: details.status,
    licensed: details.licensed,
    categories: details.categories.length,
    related: details.related_series.length,
    recommendations: details.recommendations.length,
  });

  return {
    seriesId,
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

// ============================================================================
// Metadata Merge
// ============================================================================

/**
 * Build the publishers[] array. MU is the canonical multi-publisher source
 * (Original JP + EN licensor often co-listed); ComicVine's single-publisher
 * string sits in slot 0 when present so legacy `/publisher/<name>` URLs still
 * resolve. Returns null when metadata already has publishers or MU has none
 * to contribute.
 */
function buildMangaUpdatesPublishers(
  metadata: Record<string, unknown>,
  mu: MangaUpdatesDirectResult,
  comicvinePublisher: string | undefined,
): string[] | null {
  const existing = metadata['publishers'];
  if (Array.isArray(existing) && existing.length > 0) return null;
  const names: string[] = [];
  if (comicvinePublisher) names.push(comicvinePublisher);
  for (const p of mu.publishers) {
    if (p.name && p.name.length > 0 && !names.includes(p.name)) names.push(p.name);
  }
  if (names.length === 0 && mu.publisher) names.push(mu.publisher);
  return names.length > 0 ? names : null;
}

/**
 * Build a rating JSON record from MU's Bayesian rating + vote count.
 * Returns null when MU has no rating or the metadata record already has one
 * from a higher-priority source. The Phase 1.5 consensus selector will
 * merge per-source candidates once it lands.
 */
function buildMangaUpdatesRatingJson(
  metadata: Record<string, unknown>,
  mu: MangaUpdatesDirectResult,
): { value: number; scoredBy: number | undefined; source: 'mangaupdates' } | null {
  if (metadata['rating']) return null;
  if (typeof mu.bayesianRating !== 'number' || mu.bayesianRating <= 0) return null;
  return {
    value: Math.round(mu.bayesianRating * 10),
    scoredBy: mu.ratingVotes > 0 ? mu.ratingVotes : undefined,
    source: 'mangaupdates' as const,
  };
}

/**
 * Merge MangaUpdates series-level metadata into the metadata record.
 * AniList fields take priority; MU fills gaps (publisher, genres, tags).
 * Returns an object with fields to merge (caller applies to metadata).
 */
export function buildMangaUpdatesMetadataSupplements(
  metadata: Record<string, unknown>,
  mu: MangaUpdatesDirectResult | null,
  comicvinePublisher: string | undefined,
): Record<string, unknown> {
  if (!mu) return {};

  const supplements: Record<string, unknown> = {};

  const muPublishers = buildMangaUpdatesPublishers(metadata, mu, comicvinePublisher);
  if (muPublishers !== null) supplements['publishers'] = muPublishers;

  // Genres: supplement AniList genres with MU genres
  const existingGenres = Array.isArray(metadata['genres']) ? metadata['genres'] as string[] : [];
  if (mu.genres.length > 0) {
    const genreSet = new Set(existingGenres.map(g => g.toLowerCase()));
    const newGenres = mu.genres.filter(g => !genreSet.has(g.toLowerCase()));
    if (newGenres.length > 0) {
      supplements['genres'] = [...existingGenres, ...newGenres];
    }
  }

  // Tags/categories: supplement AniList tags with MU categories
  const existingTags = Array.isArray(metadata['tags']) ? metadata['tags'] as string[] : [];
  if (mu.categories.length > 0) {
    const tagSet = new Set(existingTags.map(t => typeof t === 'string' ? t.toLowerCase() : ''));
    const newTags = mu.categories.filter(c => !tagSet.has(c.toLowerCase()));
    if (newTags.length > 0) {
      supplements['tags'] = [...existingTags, ...newTags];
    }
  }

  // Staff and title supplements (extracted to reduce complexity)
  Object.assign(supplements, buildStaffAndTitleSupplements(metadata, mu));

  // AverageScore: when AniList has no averageScore, fall back to MU's
  // bayesianRating (0-10 → 0-100). MU scores are community-weighted and
  // a reasonable proxy when AL hasn't rated the title yet.
  if (!metadata['averageScore'] && typeof mu.bayesianRating === 'number' && mu.bayesianRating > 0) {
    supplements['averageScore'] = Math.round(mu.bayesianRating * 10);
  }

  const muRating = buildMangaUpdatesRatingJson(metadata, mu);
  if (muRating !== null) supplements['rating'] = muRating;

  // Chapter count fallback: MU's latest_chapter is the highest released
  // chapter number, identical in meaning to AniList's `chapters` for ongoing
  // series. Manual-research agents found this data in MU for several titles
  // the pipeline left null — iter-4 closes that gap by wiring it here.
  //
  // Phase 0: persister now reads `metadata['chapters']` first (with legacy
  // `chapterCount` fallback). Drop the duplicate write — single source of
  // truth simplifies provenance stamping.
  if (metadata['chapters'] === undefined && typeof mu.latestChapter === 'number' && mu.latestChapter > 0) {
    supplements['chapters'] = mu.latestChapter;
  }

  return supplements;
}

/** Fill author, artist, and alternative title gaps from MU data */
function buildStaffAndTitleSupplements(
  metadata: Record<string, unknown>,
  mu: MangaUpdatesDirectResult,
): Record<string, unknown> {
  const supplements: Record<string, unknown> = {};

  const existingAuthors = Array.isArray(metadata['authors']) ? metadata['authors'] as string[] : [];
  if (existingAuthors.length === 0 && mu.authors.length > 0) {
    const muAuthors = mu.authors.filter(a => a.type === 'Author').map(a => a.name);
    if (muAuthors.length > 0) supplements['authors'] = muAuthors;
  }

  const existingArtists = Array.isArray(metadata['artists']) ? metadata['artists'] as string[] : [];
  if (existingArtists.length === 0 && mu.authors.length > 0) {
    const muArtists = mu.authors.filter(a => a.type === 'Artist').map(a => a.name);
    if (muArtists.length > 0) supplements['artists'] = muArtists;
  }

  const existingSynonyms = Array.isArray(metadata['alternativeTitles'])
    ? metadata['alternativeTitles'] as string[]
    : [];
  if (existingSynonyms.length === 0 && mu.alternativeTitles.length > 0) {
    supplements['alternativeTitles'] = mu.alternativeTitles;
  }

  return supplements;
}

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
 */
export async function verifyMUWithAniList(
  title: string,
  alYear: number | undefined,
  alCountry: string | undefined,
  alTitles: string[],
  existing: MangaUpdatesDirectResult | null,
): Promise<MangaUpdatesDirectResult | null> {
  const hints: MUSearchHints = {
    year: alYear,
    countryOfOrigin: alCountry,
    alternativeTitles: alTitles,
  };

  // If no existing match, try with hints + alternative titles
  if (!existing) {
    if (alTitles.length > 0) {
      return fetchMangaUpdatesDirect(title, hints);
    }
    return null;
  }

  // Check if existing match is plausible
  const muYear = parseInt(existing.year, 10);
  const yearGap = alYear && !isNaN(muYear) ? Math.abs(alYear - muYear) : 0;
  const countryMismatch = hasCountryMismatch(alCountry, existing.type);

  // If year gap >5 or country mismatch, re-search with hints
  if (yearGap > 5 || countryMismatch) {
    log.info('MU: re-verifying with AniList hints', {
      title, existingMU: existing.title, yearGap, countryMismatch,
    });
    const better = await fetchMangaUpdatesDirect(title, hints);
    return better ?? existing;
  }

  return existing;
}
