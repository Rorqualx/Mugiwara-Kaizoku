/**
 * Provider Fetcher Conversion Utilities
 *
 * Helper functions for converting provider-specific data formats
 * to unified metadata format.
 *
 * Extracted from: provider-fetcher.ts (lines 286-517)
 */


import { MangaPublicationStatus, MangaFormat } from '@prisma/client';

import type { SearchResult } from '@/server/services/search/types';
import type { PartialUnifiedMetadata } from '@/types/search.types';


/**
 * Convert SearchResult to PartialUnifiedMetadata format
 *
 * Maps provider-specific fields to the unified metadata structure expected by UnifiedMetadataMerger
 *
 * @param searchResult - Search result from provider
 * @param provider - Provider name
 * @returns Unified metadata in partial format
 */
export function convertToUnifiedMetadata(
  searchResult: SearchResult,
  provider: string
): PartialUnifiedMetadata {
  // Map status string to MangaPublicationStatus enum
  const status = mapStatus(searchResult.status);

  // Map format string to MangaFormat enum
  const format = mapFormat(searchResult.format);

  // Extract cover image URL
  const coverImage = searchResult.coverImage ?? searchResult.cover;

  // Build externalIds only with defined values (exactOptionalPropertyTypes compliance)
  const externalIds: Partial<{ anilistId?: number; malId?: number }> = {};
  // Type guard: Check if searchResult has a numeric id field using bracket notation
  const searchResultRecord = searchResult as unknown as Record<string, unknown>;
  const searchResultId = searchResultRecord['id'];
  if (!searchResult.idMal && typeof searchResultId === 'number') {
    externalIds.anilistId = searchResultId;
  }
  if (searchResult.idMal !== undefined) {
    externalIds.malId = searchResult.idMal;
  }

  // Build unified metadata (conditionally add optional fields to satisfy exactOptionalPropertyTypes)
  // Cast as PartialUnifiedMetadata to bypass exactOptionalPropertyTypes for undefined values

  // Type guard: Extract synonyms if present (some providers use this instead of alternativeTitles)
  const synonyms = 'synonyms' in searchResultRecord && Array.isArray(searchResultRecord['synonyms'])
    ? searchResultRecord['synonyms'] as string[]
    : undefined;

  const unified = {
    title: searchResult.title,
    description: searchResult.description,
    coverImage,
    bannerImage: searchResult.bannerImage,
    alternativeTitles: searchResult.alternativeTitles ?? synonyms,
    genres: searchResult.genres,
    tags: convertTags(searchResult.tags),
    authors: extractAuthors(searchResult),
    artists: extractArtists(searchResult),
    publisher: extractPublisher(searchResult.publisher),
    year: searchResult.year,
    startDate: searchResult.startDate,
    endDate: searchResult.endDate,
    chapterCount: searchResult.chapters,
    volumeCount: searchResult.volumes,
    primarySource: provider,
  } as PartialUnifiedMetadata;

  // Only add optional enum fields if they have values (exactOptionalPropertyTypes compliance)
  if (status !== undefined) {
    unified['status'] = status;
  }
  if (format !== undefined) {
    unified.format = format;
  }

  // Only add externalIds if we have any
  if (Object.keys(externalIds).length > 0) {
    unified.externalIds = externalIds;
  }

  // Add provider-specific metadata
  unified.providerMetadata = [{
    provider,
    data: searchResult.metadata ?? searchResult,
    lastUpdated: new Date()
  }];

  // Remove undefined values to keep the object clean
  return removeUndefinedFields(unified);
}

/**
 * Map status string to MangaPublicationStatus enum
 *
 * @param status - Status string from provider
 * @returns Mapped MangaPublicationStatus or undefined
 */
export function mapStatus(status?: string): MangaPublicationStatus | undefined {
  if (!status) return undefined;

  const statusUpper = status.toUpperCase();

  switch (statusUpper) {
    case 'ONGOING':
    case 'RELEASING':
    case 'PUBLISHING':
      return MangaPublicationStatus.ONGOING;
    case 'COMPLETED':
    case 'FINISHED':
      return MangaPublicationStatus.COMPLETED;
    case 'CANCELLED':
    case 'CANCELED':
      return MangaPublicationStatus.CANCELLED;
    case 'HIATUS':
    case 'ON_HIATUS':
      return MangaPublicationStatus.HIATUS;
    case 'NOT_YET_RELEASED':
    case 'NOT_YET_PUBLISHED':
      return MangaPublicationStatus.NOT_YET_RELEASED;
    default:
      return MangaPublicationStatus.UNKNOWN;
  }
}

/**
 * Map format string to MangaFormat enum
 *
 * @param format - Format string from provider
 * @returns Mapped MangaFormat or undefined
 */
export function mapFormat(format?: string): MangaFormat | undefined {
  if (!format) return undefined;

  const formatUpper = format.toUpperCase();

  switch (formatUpper) {
    case 'MANGA':
      return MangaFormat.MANGA;
    case 'MANHWA':
      return MangaFormat.MANHWA;
    case 'MANHUA':
      return MangaFormat.MANHUA;
    case 'NOVEL':
    case 'LIGHT_NOVEL':
      return MangaFormat.NOVEL;
    case 'ONE_SHOT':
    case 'ONESHOT':
      return MangaFormat.ONE_SHOT;
    default:
      return undefined;
  }
}

/**
 * Convert tags to unified format
 *
 * @param tags - Tags from provider (can be strings or objects)
 * @returns Array of tag objects with name and optional rank
 */
export function convertTags(tags?: string[] | unknown[]): Array<{ name: string; rank?: number }> | undefined {
  if (!tags || tags.length === 0) return undefined;

  return tags.map(tag => {
    if (typeof tag === 'string') {
      return { name: tag };
    }
    if (typeof tag === 'object' && tag !== null && 'name' in tag) {
      const tagObj = tag as { name: string; rank?: number };
      // Only include rank if it's actually defined (exactOptionalPropertyTypes compliance)
      const result: { name: string; rank?: number } = { name: tagObj.name };
      if (tagObj.rank !== undefined) {
        result.rank = tagObj.rank;
      }
      return result;
    }
    return { name: String(tag) };
  });
}

/**
 * Extract authors from search result
 *
 * @param searchResult - Search result from provider
 * @returns Array of author names or undefined
 */
export function extractAuthors(searchResult: SearchResult): string[] | undefined {
  const authors: string[] = [];

  // Check various author field formats
  if (searchResult.author && typeof searchResult.author === 'string') {
    authors.push(searchResult.author);
  }

  // Type guard: Check if searchResult has an authors array field using bracket notation
  const searchResultRecord = searchResult as unknown as Record<string, unknown>;
  const authorsField = searchResultRecord['authors'];
  if (Array.isArray(authorsField) && authorsField.every((a): a is string => typeof a === 'string')) {
    authors.push(...authorsField);
  }

  return authors.length > 0 ? authors : undefined;
}

/**
 * Extract artists from search result
 *
 * @param searchResult - Search result from provider
 * @returns Array of artist names or undefined
 */
export function extractArtists(searchResult: SearchResult): string[] | undefined {
  const artists: string[] = [];

  // Type guard: Check if searchResult has an artists array field using bracket notation
  const searchResultRecord = searchResult as unknown as Record<string, unknown>;
  const artistsField = searchResultRecord['artists'];
  if (Array.isArray(artistsField) && artistsField.every((a): a is string => typeof a === 'string')) {
    artists.push(...artistsField);
  }

  return artists.length > 0 ? artists : undefined;
}

/**
 * Extract publisher from various formats
 *
 * @param publisher - Publisher data (can be string or object)
 * @returns Publisher name or undefined
 */
export function extractPublisher(publisher?: string | { id: number; name: string }): string | undefined {
  if (!publisher) return undefined;

  if (typeof publisher === 'string') {
    return publisher;
  }

  if (typeof publisher === 'object' && 'name' in publisher) {
    return publisher.name;
  }

  return undefined;
}

/**
 * Remove undefined fields from object
 *
 * Cleans up the metadata object by removing all undefined values
 * to ensure clean serialization and exactOptionalPropertyTypes compliance
 *
 * @param obj - Object to clean
 * @returns Cleaned object without undefined fields
 */
export function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): T {
  const cleaned = { ...obj };

  for (const key in cleaned) {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  }

  return cleaned;
}
