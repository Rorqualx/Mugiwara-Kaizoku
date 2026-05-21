/**
 * Publisher and Identifier Extractors
 *
 * Extracts publisher data and identifier fields (anilistId, myAnimeListId, etc.)
 * from various manga data sources.
 *
 * @module components/addManga/form/confirmation-data-builder/publisher-identifier-extractors
 */

import { removeUndefined } from './utilities';

import type {
  MangaWithDynamicMetadata,
  RawDataObject,
  MetadataObject,
  ProviderSpecificObject,
} from './types';

/**
 * Extracts publisher value from various sources, handling both string and object formats
 *
 * @param manga - Main manga object
 * @param providerSpecific - Provider-specific data
 * @param metadata - Metadata object
 * @returns Publisher name as string, or undefined
 */
export function extractPublisher(
  manga: MangaWithDynamicMetadata,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): string | undefined {
  const pub = manga.publisher ?? providerSpecific?.publisher ?? metadata?.['publisher'];
  if (typeof pub === 'string') return pub;
  if (pub && typeof pub === 'object' && 'name' in pub && typeof pub.name === 'string') {
    return pub.name;
  }
  return undefined;
}

/**
 * Extracts description fields from various sources
 *
 * @param manga - Main manga object
 * @param rawData - Raw data from wizard/Fandom
 * @param metadata - Metadata object
 * @returns Object with description fields
 */
// eslint-disable-next-line complexity -- Complex description extraction from multiple data sources
export function extractDescriptions(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): Record<string, string | undefined> {
  return removeUndefined({
    synopsis: manga.synopsis ?? rawData?.synopsis ?? metadata?.descriptions?.synopsis,
    plot: manga.plot ?? rawData?.plot ?? metadata?.descriptions?.plot,
    background: manga.background ?? rawData?.background ?? metadata?.descriptions?.background,
    history: manga.history ?? rawData?.history ?? metadata?.descriptions?.history,
  });
}

/**
 * Extracts identifier fields (anilistId, myAnimeListId, etc.)
 *
 * @param manga - Main manga object
 * @param rawData - Raw data from wizard/Fandom
 * @param metadata - Metadata object
 * @returns Object with identifier fields
 */
export function extractIdentifiers(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): Record<string, unknown> {
  return removeUndefined({
    anilistId: manga.anilistId ?? rawData?.anilistId ?? metadata?.anilistId,
    myAnimeListId: manga.myAnimeListId ?? rawData?.myAnimeListId ?? metadata?.myAnimeListId,
    releaseYear: manga.releaseYear ?? rawData?.releaseYear ?? metadata?.releaseYear,
    artists: manga.artists ?? rawData?.artists ?? metadata?.artists,
  });
}
