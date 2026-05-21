/**
 * MangaSearchResult Adapter
 *
 * Converts ExtendedMangaSearchResult to UnifiedSearchResult.
 * Handles results with metadata field structure.
 *
 * Extracted from: type-adapters.ts (lines 70-180)
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { toStringId } from '@/utils/id-converters';
import { getStringProperty, getNumberProperty, getStringArrayProperty } from '@/utils/type-guards/safe-access';

import {
  type UnifiedSearchResult,
  type PartialUnifiedMetadata,
  extractCoverUrl,
  extractDescription,
  extractAlternativeTitles,
  extractStatus,
  extractFormat,
  extractNumber,
  extractAuthors,
  extractArtists,
  extractGenres,
  extractTags,
  extractDate,
  extractString,
} from './utils';

import type { MangaPublicationStatus } from '@prisma/client';

/**
 * Build covers object from result
 * @param result - Search result with cover fields
 * @returns Covers object with available sizes
 */
function buildCoversObject(result: Record<string, unknown>): PartialUnifiedMetadata['covers'] {
  const metadata = result['metadata'] as Record<string, unknown> | undefined;

  const largeCover = result['coverLarge'] ?? metadata?.['coverLarge'];
  const mediumCover = result['coverMedium'] ?? metadata?.['coverMedium'];
  const smallCover = result['coverSmall'] ?? metadata?.['coverSmall'];

  return {
    original: extractCoverUrl(result),
    ...(largeCover ? { large: largeCover as string } : {}),
    ...(mediumCover ? { medium: mediumCover as string } : {}),
    ...(smallCover ? { small: smallCover as string } : {}),
  };
}

/**
 * Extract numeric and date fields from result
 * @param result - Search result
 * @returns Object with numeric and date fields
 */
function extractNumericFields(result: ExtendedMangaSearchResult & Record<string, unknown>): Partial<PartialUnifiedMetadata> {
  const chaptersValue = extractNumber(result, 'chapters');
  const volumesValue = extractNumber(result, 'volumes');
  const startDateValue = extractDate(result, 'startDate');
  const endDateValue = extractDate(result, 'endDate');
  const releaseYearValue = extractNumber(result, 'releaseYear');
  const averageScoreValue = extractNumber(result, 'averageScore', 'score');
  const popularityValue = extractNumber(result, 'popularity');

  return {
    ...(chaptersValue !== undefined ? { chapters: chaptersValue } : {}),
    ...(volumesValue !== undefined ? { volumes: volumesValue } : {}),
    ...(startDateValue !== undefined ? { startDate: startDateValue } : {}),
    ...(endDateValue !== undefined ? { endDate: endDateValue } : {}),
    ...(releaseYearValue !== undefined ? { releaseYear: releaseYearValue } : {}),
    ...(averageScoreValue !== undefined ? { averageScore: averageScoreValue } : {}),
    ...(popularityValue !== undefined ? { popularity: popularityValue } : {}),
  };
}

/**
 * Extract people and category fields from result
 * @param result - Search result
 * @returns Object with authors, artists, genres, and tags
 */
function extractPeopleAndCategories(
  result: ExtendedMangaSearchResult & Record<string, unknown>
): Partial<PartialUnifiedMetadata> {
  const authors = extractAuthors(result);
  const artists = extractArtists(result);
  const genres = extractGenres(result);
  const tags = extractTags(result);

  return {
    ...(authors.length > 0 ? { authors } : {}),
    ...(artists.length > 0 ? { artists } : {}),
    ...(genres.length > 0 ? { genres } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };
}

/**
 * Build metadata object from result
 * @param result - Extended manga search result
 * @param provider - Provider source string
 * @returns Partial unified metadata
 */
function buildMetadata(
  result: ExtendedMangaSearchResult & Record<string, unknown>,
  provider: string
): PartialUnifiedMetadata {
  const extractedDescription = extractDescription(result);
  const extractedAlternativeTitles = extractAlternativeTitles(result);
  const summaryValue = result['deck'] ?? result['summary'];
  const bannerValue = result.bannerImage ?? result['banner'] ?? (result['metadata'] as Record<string, unknown> | undefined)?.[
    'bannerImage'
  ];
  const statusValue = extractStatus(result);
  const formatValue = extractFormat(result);
  const publisherValue = extractString(result, 'publisher');
  const covers = buildCoversObject(result);

  return {
    id: toStringId(result['id']),
    title: result['title'],
    ...(extractedAlternativeTitles.length > 0 ? { alternativeTitles: extractedAlternativeTitles } : {}),
    ...(extractedDescription ? { description: extractedDescription } : {}),
    ...(summaryValue ? { summary: summaryValue as string } : {}),
    ...(covers ? { covers } : {}),
    ...(statusValue !== undefined ? { status: statusValue } : {}),
    ...(formatValue !== undefined ? { format: formatValue } : {}),
    ...extractNumericFields(result),
    ...extractPeopleAndCategories(result),
    ...(publisherValue !== undefined ? { publisher: publisherValue } : {}),
    ...(bannerValue ? { bannerImage: bannerValue as string } : {}),
    ...(provider ? { primarySource: provider } : {}),
  };
}

/**
 * Map tags from metadata object to string array
 * @param metadataObj - Metadata object with tags
 * @returns Array of tag name strings or undefined
 */
function mapTagsToStrings(metadataObj: Record<string, unknown>): string[] | undefined {
  const metadataTags = metadataObj['tags'];

  if (!Array.isArray(metadataTags)) {
    return undefined;
  }

  return metadataTags.map((t: unknown) => {
    if (typeof t === 'string') {
      return t;
    }
    if (t && typeof t === 'object') {
      const tagObj = t as Record<string, unknown>;
      return getStringProperty(tagObj, 'name') ?? '';
    }
    return '';
  });
}

/**
 * Convert ExtendedMangaSearchResult to UnifiedSearchResult
 *
 * Handles search results that use the metadata field structure.
 * Extracts data from both direct properties and nested metadata.
 *
 * @param result - The manga search result to adapt
 * @param source - Optional provider source override
 * @returns Unified search result
 */
export function adaptMangaSearchResult(
  result: ExtendedMangaSearchResult & Record<string, unknown>,
  source?: string
): UnifiedSearchResult {
  const provider = source ?? result.provider;

  // Build metadata using helper function
  const metadata = buildMetadata(result, provider);

  // Convert metadata to record for field extraction
  const metadataObj = metadata as Record<string, unknown>;

  // Extract fields from metadata using safe accessors
  const description = getStringProperty(metadataObj, 'description');
  const status = metadataObj['status'] as MangaPublicationStatus | undefined;
  const genres = getStringArrayProperty(metadataObj, 'genres');
  const alternativeTitles = getStringArrayProperty(metadataObj, 'alternativeTitles');
  const year = getNumberProperty(metadataObj, 'releaseYear');
  const mappedTags = mapTagsToStrings(metadataObj);

  const unified: UnifiedSearchResult = {
    id: toStringId(result['id']),
    title: result['title'],
    provider: provider,
    sourceId: toStringId(result.sourceId),
    externalId: toStringId(result.sourceId),
    ...(description ? { description } : {}),
    coverImage: extractCoverUrl(result),
    ...(status ? { status } : {}),
    ...(genres ? { genres } : {}),
    ...(mappedTags ? { tags: mappedTags } : {}),
    ...(alternativeTitles ? { alternativeTitles } : {}),
    ...(year ? { year } : {}),
  };

  return unified;
}
