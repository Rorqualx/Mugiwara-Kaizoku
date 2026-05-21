/**
 * Basic Metadata Extractors
 *
 * Extracts basic metadata fields like title, description, status, format, and type.
 * Each function follows a consistent fallback chain across data sources.
 *
 * @module components/addManga/form/confirmation-data-builder/basic-metadata-extractors
 */

import type {
  MangaWithDynamicMetadata,
  RawDataObject,
  MetadataObject,
  ProviderSpecificObject,
} from './types';

/**
 * Extracts title from manga sources
 */
export function extractTitle(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): string | undefined {
  return (manga['title'] as string | undefined) ?? (rawData?.['title'] as string | undefined) ?? (metadata?.['title'] as string | undefined);
}

/**
 * Extracts description from manga sources
 */
export function extractDescription(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): string | undefined {
  return (manga['description'] as string | undefined) ?? (rawData?.['description'] as string | undefined) ?? (metadata?.['description'] as string | undefined);
}

/**
 * Extracts status from manga sources
 */
export function extractStatus(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): string | undefined {
  return (manga['status'] as string | undefined) ?? (rawData?.['status'] as string | undefined) ?? (metadata?.['status'] as string | undefined);
}

/**
 * Extracts format from manga sources with provider-specific fallbacks
 */
export function extractFormat(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): string | undefined {
  return manga.format ?? rawData?.format ?? providerSpecific?.format ?? (metadata?.['format'] as string | undefined);
}

/**
 * Extracts type from manga sources
 */
export function extractType(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): string | undefined {
  return (manga['type'] as string | undefined) ?? (rawData?.['type'] as string | undefined) ?? (metadata?.['type'] as string | undefined);
}
