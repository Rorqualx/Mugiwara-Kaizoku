/**
 * MangaUpdates Adapter
 *
 * Adapts MangaUpdates API responses to the application's SearchResult
 * and MangaMetadata types for use in the provider strategy system.
 */

import type { SearchResult, MangaMetadata } from '@/types/search.types';

import type { MUSearchHit, MUSeriesDetails } from './types';

// ============================================================================
// Search Result Adapter
// ============================================================================

/**
 * Adapt a MangaUpdates search hit to a SearchResult.
 */
export function adaptMUSearchResult(hit: MUSearchHit): SearchResult {
  const { record } = hit;
  const result: SearchResult = {
    type: 'manga',
    id: String(record.series_id),
    title: record.title,
    description: record.description,
    coverImage: record.image?.url?.original ?? '',
    provider: 'mangaupdates',
    genres: Array.isArray(record.genres) ? record.genres.map(g => g.genre) : [],
    score: record.bayesian_rating,
    url: record.url,
  };
  if (record.year) result.year = parseInt(record.year, 10);
  if (record.latest_chapter > 0) result.chapters = record.latest_chapter;
  return result;
}

// ============================================================================
// Metadata Adapter
// ============================================================================

/**
 * Adapt MangaUpdates series details to MangaMetadata.
 * MU provides rich series-level metadata (publisher, categories, licensing, related series)
 * but NOT per-chapter/per-volume data.
 */
export function adaptMUToMangaMetadata(details: MUSeriesDetails): MangaMetadata {
  const englishPublisher = details.publishers
    .find(p => p.type === 'English');
  const originalPublisher = details.publishers
    .find(p => p.type === 'Original');

  const authors = details.authors
    .filter(a => a.type === 'Author')
    .map(a => a.name);
  const artists = details.authors
    .filter(a => a.type === 'Artist')
    .map(a => a.name);

  const alternativeTitles = details.associated.map(a => a.title);

  const metadata: MangaMetadata = {
    id: String(details.series_id),
    title: details.title,
    description: details.description,
    coverImage: details.image.url.original,
    genres: details.genres.map(g => g.genre),
    tags: details.categories
      .filter(c => c.votes_plus > c.votes_minus)
      .map(c => c.category),
    status: mapMUStatus(details.status, details.completed),
    url: details.url,
    provider: 'mangaupdates',
    sourceId: String(details.series_id),
  };
  if (authors.length > 0) metadata.authors = authors;
  if (artists.length > 0) metadata.artists = artists;
  const publisher = englishPublisher?.publisher_name ?? originalPublisher?.publisher_name;
  if (publisher) metadata.publisher = publisher;
  if (details.year) metadata.year = parseInt(details.year, 10);
  if (alternativeTitles.length > 0) metadata.alternativeTitles = alternativeTitles;
  if (details.latest_chapter > 0) metadata.chapters = details.latest_chapter;
  return metadata;
}

/**
 * Map MangaUpdates status string to normalized status.
 */
function mapMUStatus(status: string, completed: boolean): string {
  if (completed) return 'COMPLETED';

  const normalized = status.toLowerCase();
  if (normalized.includes('ongoing') || normalized.includes('year')) return 'ONGOING';
  if (normalized.includes('complete')) return 'COMPLETED';
  if (normalized.includes('hiatus')) return 'HIATUS';
  if (normalized.includes('cancelled') || normalized.includes('discontinued')) return 'CANCELLED';

  return 'UNKNOWN';
}
