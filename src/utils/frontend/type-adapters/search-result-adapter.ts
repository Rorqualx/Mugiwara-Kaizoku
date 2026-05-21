/**
 * SearchResult Adapter
 *
 * Converts SearchResult to UnifiedSearchResult.
 * Handles results with direct property structure (no metadata field).
 *
 * Extracted from: type-adapters.ts (lines 185-265)
 */

import type { SearchResult } from '@/types/search.types';
import { toStringId } from '@/utils/id-converters';
import { getStringProperty, getStringArrayProperty } from '@/utils/type-guards/safe-access';

import {
  type UnifiedSearchResult,
  type PartialUnifiedMetadata,
  parseDate,
  mapStatus,
  mapFormat,
} from './utils';

import type { MangaPublicationStatus } from '@prisma/client';

/**
 * Convert tag from unknown format to name-only object
 * @param tag - Tag in various formats (string or object)
 * @returns Normalized tag object with name property
 */
function normalizeTag(tag: unknown): { name: string } {
  if (typeof tag === 'string') {
    return { name: tag };
  }
  if (tag && typeof tag === 'object') {
    const tagObj = tag as Record<string, unknown>;
    const name = tagObj['name'];
    return { name: typeof name === 'string' ? name : '' };
  }
  return { name: '' };
}

/**
 * Convert tag object to string name
 * @param tag - Tag object to extract name from
 * @returns Tag name as string
 */
function tagToString(tag: unknown): string {
  if (typeof tag === 'string') return tag;
  if (tag && typeof tag === 'object') {
    const tagObj = tag as Record<string, unknown>;
    return getStringProperty(tagObj, 'name') ?? '';
  }
  return '';
}

/**
 * Convert author from unknown format to name-only object
 * @param author - Author in various formats (string or object)
 * @returns Normalized author object with name property
 */
function normalizeAuthor(author: unknown): { name: string } {
  if (typeof author === 'string') {
    return { name: author };
  }
  const authorObj = author as Record<string, unknown>;
  const name = authorObj['name'];
  return { name: typeof name === 'string' ? name : 'Unknown' };
}

/**
 * Build metadata object from search result properties
 * @param result - Search result with direct properties
 * @param provider - Provider identifier
 * @returns Partial unified metadata
 */
function buildMetadata(
  result: SearchResult & Record<string, unknown>,
  provider: string
): PartialUnifiedMetadata {
  // Extract simple fields
  const altTitles = result['alternativeTitles'] as string[] | undefined;
  const description = result['description'] as string | undefined;
  const chapters = result['chapters'] as number | undefined;
  const volumes = result.volumes as number | undefined;
  const genres = result['genres'] as string[] | undefined;

  // Parse dates
  const startDate = parseDate(result.startDate);
  const endDate = parseDate(result.endDate);

  // Extract numeric metrics
  const averageScore = (result.score ?? result.averageScore) as number | undefined;
  const popularity = result.popularity as number | undefined;

  // Normalize complex arrays
  const rawTags = result['tags'];
  const tags = Array.isArray(rawTags) ? rawTags.map(normalizeTag) : [];

  const rawAuthors = result['authors'];
  const authors = Array.isArray(rawAuthors) ? rawAuthors.map(normalizeAuthor) : undefined;

  // Build metadata with conditional fields
  return {
    id: toStringId(result['id']),
    title: result['title'],
    ...(altTitles && altTitles.length > 0 ? { alternativeTitles: altTitles } : {}),
    ...(description ? { description } : {}),
    covers: {
      original: result.cover ?? result.coverImage ?? '/cover-not-found.jpg'
    },
    status: mapStatus(result['status']),
    format: mapFormat(result.format),
    ...(chapters ? { chapters } : {}),
    ...(volumes ? { volumes } : {}),
    ...(authors && authors.length > 0 ? { authors } : {}),
    ...(genres && genres.length > 0 ? { genres } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(averageScore ? { averageScore } : {}),
    ...(popularity ? { popularity } : {}),
    primarySource: provider
  };
}

/**
 * Convert SearchResult to UnifiedSearchResult
 *
 * Handles search results with direct properties (no metadata field).
 * Used for results that already have a flat structure.
 *
 * @param result - The search result to adapt
 * @param source - Optional provider source override
 * @returns Unified search result
 */
export function adaptSearchResult(
  result: SearchResult & Record<string, unknown>,
  source?: string
): UnifiedSearchResult {
  // SearchResult has properties directly, not in metadata
  const provider = (source ?? result.provider) as string;

  // Build metadata structure
  const metadata = buildMetadata(result, provider);
  const metadataResultObj = metadata as Record<string, unknown>;

  // Extract final values from metadata
  const metadataTags = metadataResultObj['tags'];
  const finalTags = Array.isArray(metadataTags)
    ? metadataTags.map(tagToString)
    : undefined;

  const metadataDescription = getStringProperty(metadataResultObj, 'description');
  const metadataStatus = metadataResultObj['status'] as MangaPublicationStatus | undefined;
  const metadataGenres = getStringArrayProperty(metadataResultObj, 'genres');
  const metadataAltTitles = getStringArrayProperty(metadataResultObj, 'alternativeTitles');

  // Return unified result
  return {
    id: toStringId(result['id']),
    title: result['title'] as string,
    provider: provider,
    sourceId: toStringId(result['id']),
    externalId: toStringId(result['id']),
    ...(metadataDescription ? { description: metadataDescription } : {}),
    coverImage: result.cover ?? result.coverImage ?? '/cover-not-found.jpg',
    ...(metadataStatus ? { status: metadataStatus } : {}),
    ...(metadataGenres ? { genres: metadataGenres } : {}),
    ...(finalTags ? { tags: finalTags } : {}),
    ...(metadataAltTitles ? { alternativeTitles: metadataAltTitles } : {})
  };
}
