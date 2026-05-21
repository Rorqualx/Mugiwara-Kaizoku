/**
 * Provider Matcher - Type Conversion Helpers
 *
 * Functions for converting provider match results to search result format.
 *
 * @module components/addManga/services/quickAddService/provider-matcher/type-conversion
 */

import type { ProviderMatchResult } from '@/server/services/metadata/provider-matching/types-and-utils';
import type { ExtendedMangaSearchResult, MangaMetadata } from '@/types/search.types';

// ============================================================================
// Date Conversion
// ============================================================================

/**
 * Convert a date value to string format for search result
 */
function convertDateToString(date: Date | string | undefined): string | null {
  if (date === undefined) return null;
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString();
  return null;
}

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Extract metadata fields into a partial search result object
 */
// eslint-disable-next-line complexity -- Field mapping function with many fields; each check is O(1), complexity from field count not logic depth
function extractMetadataFields(
  metadata: MangaMetadata,
  providerId: string
): Partial<ExtendedMangaSearchResult> {
  const fields: Partial<ExtendedMangaSearchResult> = {};

  // Basic fields
  if (metadata.alternativeTitles) fields.alternativeTitles = metadata.alternativeTitles;
  if (metadata.status) fields.status = metadata.status;
  if (metadata.genres) fields.genres = metadata.genres;
  if (metadata.tags) fields.tags = metadata.tags;
  if (metadata.authors) fields.authors = metadata.authors;
  if (metadata.artists) fields.artists = metadata.artists;
  if (metadata.chapters) fields.chapters = metadata.chapters;
  if (metadata.volumes) fields.volumes = metadata.volumes;
  if (metadata.publisher) fields.publisher = metadata.publisher;
  if (metadata.format) fields.format = metadata.format;
  if (metadata.popularity) fields.popularity = metadata.popularity;
  if (metadata.countryOfOrigin) fields.countryOfOrigin = metadata.countryOfOrigin;
  if (metadata.isAdult !== undefined) fields.isAdult = metadata.isAdult;
  if (metadata.bannerImage) fields.bannerImage = metadata.bannerImage;

  // Fallback fields
  const description = metadata.description ?? metadata.summary;
  if (description) fields.description = description;

  const coverImage = metadata.coverImage ?? metadata.coverUrl ?? metadata.cover;
  if (coverImage) fields.coverImage = coverImage;

  const year = metadata.year ?? metadata.releaseYear;
  if (year) fields.year = year;

  const averageScore = metadata.averageScore ?? metadata.score;
  if (averageScore) fields.averageScore = averageScore;

  // Date fields
  if (metadata.startDate !== undefined) {
    fields.startDate = convertDateToString(metadata.startDate);
  }
  if (metadata.endDate !== undefined) {
    fields.endDate = convertDateToString(metadata.endDate);
  }

  // ID fields
  fields.sourceId = providerId;
  fields.externalId = providerId;

  // URL fields - critical for volume fetching from providers like Fandom
  // Extract from multiple possible locations in metadata
  const metadataRecord = metadata as unknown as Record<string, unknown>;
  const directUrl = metadataRecord['url'] ?? metadataRecord['wikiUrl'] ?? metadataRecord['providerUrl'];
  if (typeof directUrl === 'string' && directUrl.length > 0) {
    fields.url = directUrl;
  }

  // Also check urls array as fallback
  if (!fields.url && metadata.urls && Array.isArray(metadata.urls) && metadata.urls.length > 0) {
    fields.url = String(metadata.urls[0]);
  }

  // Explicitly preserve wikiUrl for Fandom
  const wikiUrl = metadataRecord['wikiUrl'];
  if (typeof wikiUrl === 'string' && wikiUrl.length > 0) {
    fields.wikiUrl = wikiUrl;
  }

  // Preserve siteDetailUrl for ComicVine
  const siteDetailUrl = metadataRecord['siteDetailUrl'];
  if (typeof siteDetailUrl === 'string' && siteDetailUrl.length > 0) {
    fields.siteDetailUrl = siteDetailUrl;
  }

  return fields;
}

// ============================================================================
// Main Conversion
// ============================================================================

/**
 * Convert a ProviderMatchResult to ExtendedMangaSearchResult format
 *
 * Maps provider match data to the search result format used by field selection.
 * Preserves all metadata fields for proper field value extraction.
 *
 * @param match - Provider match result from matching service
 * @returns ExtendedMangaSearchResult compatible with field selection
 */
export function convertMatchToSearchResult(match: ProviderMatchResult): ExtendedMangaSearchResult {
  // Build base result with required fields
  const baseResult: ExtendedMangaSearchResult = {
    id: match.providerId,
    title: match.title,
    provider: match.provider,
    matchConfidence: match.confidence,
  };

  // If no metadata, return base result
  if (!match.metadata) {
    return baseResult;
  }

  // Extract and merge metadata fields
  const metadataFields = extractMetadataFields(match.metadata, match.providerId);

  return { ...baseResult, ...metadataFields };
}
