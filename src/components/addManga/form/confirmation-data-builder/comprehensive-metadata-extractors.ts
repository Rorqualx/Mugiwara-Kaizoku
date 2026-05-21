/**
 * Comprehensive Metadata Extractors
 *
 * Extracts comprehensive metadata fields including scores, dates, tags,
 * staff, and other detailed information from various sources.
 *
 * @module components/addManga/form/confirmation-data-builder/comprehensive-metadata-extractors
 */

import { removeUndefined } from './utilities';

import type {
  MangaWithDynamicMetadata,
  RawDataObject,
  ProviderSpecificObject,
  MetadataObject,
} from './types';

/**
 * Extracts average score from manga sources
 */
export function extractAverageScore(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): number | undefined {
  const score = manga.averageScore ?? rawData?.averageScore ?? providerSpecific?.averageScore ?? metadata?.['averageScore'];
  return typeof score === 'number' ? score : undefined;
}

/**
 * Extracts popularity from manga sources
 */
export function extractPopularity(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): string | number | undefined {
  const pop = manga.popularity ?? rawData?.popularity ?? providerSpecific?.popularity ?? metadata?.['popularity'];
  return (typeof pop === 'string' || typeof pop === 'number') ? pop : undefined;
}

/**
 * Extracts start and end dates from manga sources
 */
export function extractDates(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): { startDate?: string; endDate?: string } {
  const startDate = manga.startDate ?? rawData?.startDate ?? providerSpecific?.startDate ?? (metadata?.['startDate'] as string | undefined);
  const endDate = manga.endDate ?? rawData?.endDate ?? (metadata?.['endDate'] as string | undefined);

  return {
    ...(startDate !== undefined ? { startDate } : {}),
    ...(endDate !== undefined ? { endDate } : {}),
  };
}

/**
 * Extracts tags from manga sources
 */
export function extractTags(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): string[] | undefined {
  const tags = manga.tags ?? rawData?.tags ?? providerSpecific?.tags ?? metadata?.['tags'];
  return Array.isArray(tags) ? tags : undefined;
}

/**
 * Extracts staff information from manga sources
 */
export function extractStaff(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): unknown[] | undefined {
  const staff = manga.staff ?? rawData?.staff ?? metadata?.['staff'];
  return Array.isArray(staff) ? staff : undefined;
}

/**
 * Extracts comprehensive metadata fields
 *
 * @param manga - Main manga object
 * @param rawData - Raw data from wizard/Fandom
 * @param providerSpecific - Provider-specific data
 * @param metadata - Metadata object
 * @returns Object with comprehensive metadata
 */
export function extractComprehensiveMetadata(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): Record<string, unknown> {
  return removeUndefined({
    idMal: manga.idMal ?? metadata?.['idMal'],
    synonyms: manga.synonyms ?? metadata?.['synonyms'],
    averageScore: extractAverageScore(manga, rawData, providerSpecific, metadata),
    popularity: extractPopularity(manga, rawData, providerSpecific, metadata),
    ...extractDates(manga, rawData, providerSpecific, metadata),
    tags: extractTags(manga, rawData, providerSpecific, metadata),
    staff: extractStaff(manga, rawData, metadata),
    externalLinks: manga.externalLinks ?? metadata?.['externalLinks'],
    countryOfOrigin: manga.countryOfOrigin ?? metadata?.['countryOfOrigin'],
    isAdult: manga.isAdult ?? metadata?.['isAdult'],
  });
}
