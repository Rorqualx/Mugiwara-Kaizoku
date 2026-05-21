/**
 * Import Profile Extractors
 *
 * Extracts import profile and provider-specific data from rawData.
 * These fields are specific to the import wizard workflow.
 *
 * @module components/addManga/form/confirmation-data-builder/import-profile-extractors
 */

import type { RawDataObject } from './types';

/**
 * Extracts import profile from rawData
 *
 * @param rawData - Raw data from wizard
 * @returns Import profile identifier
 */
export function extractImportProfile(rawData?: RawDataObject): string | undefined {
  return rawData?.importProfile;
}

/**
 * Extracts selected providers from rawData
 *
 * @param rawData - Raw data from wizard
 * @returns Array of selected provider identifiers
 */
export function extractSelectedProviders(rawData?: RawDataObject): string[] | undefined {
  const providers = rawData?.selectedProviders;
  return Array.isArray(providers) ? providers : undefined;
}

/**
 * Extracts provider metadata from rawData
 *
 * @param rawData - Raw data from wizard
 * @returns Provider metadata object
 */
export function extractProviderMetadata(rawData?: RawDataObject): Record<string, unknown> | undefined {
  const providerMetadata = rawData?.providerMetadata;
  return providerMetadata && typeof providerMetadata === 'object' ? providerMetadata : undefined;
}

/**
 * Extracts chapter metadata cache from rawData
 *
 * @param rawData - Raw data from wizard
 * @returns Chapter metadata cache
 */
export function extractChapterMetadataCache(rawData?: RawDataObject): unknown | undefined {
  return rawData?.chapterMetadataCache;
}
