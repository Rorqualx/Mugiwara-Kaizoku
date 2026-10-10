/**
 * MangaUpdates metadata supplements — the gap-filling merge of MangaUpdates
 * series data into the metadata record. Split out of `mangaupdates-fetch.ts`
 * to keep that file within the size limit; re-exported from there.
 */

import type { MangaUpdatesDirectResult } from './mangaupdates-fetch';

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
