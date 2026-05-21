/**
 * Metadata Extraction Functions
 *
 * Functions for extracting metadata fields from various provider data structures.
 * Each extractor handles multiple possible locations for the same data field.
 *
 * @module components/addManga/wizard-utils/metadata-extractors
 */

import { hasProperty, isStringArray } from '@/utils/type-guards';
import { isRecord } from '@/utils/type-guards/index';

// ============================================================================
// Types
// ============================================================================

/**
 * Type for initial data that can have metadata
 * Uses unknown for metadata to allow various provider-specific types
 */
export type InitialDataWithMetadata = Record<string, unknown> & {
  metadata?: unknown;
};

// ============================================================================
// Helper Functions (Private)
// ============================================================================

/**
 * Extracts publisher name from a publisher value that may be string or object
 * ComicVine returns { id, name }, other sources return string directly
 */
function extractPublisherName(publisher: unknown): string {
  if (typeof publisher === 'string') {
    return publisher;
  }
  if (isRecord(publisher) && hasProperty(publisher, 'name') && typeof publisher['name'] === 'string') {
    return publisher['name'];
  }
  return '';
}

// ============================================================================
// URL Extractors
// ============================================================================

/**
 * Extracts URL field from initial data
 * @param initialData - Initial wizard data
 * @returns URL string
 */
export function extractUrl(initialData: InitialDataWithMetadata): string {
  // Check direct URL fields first
  if (hasProperty(initialData, 'url') && typeof initialData['url'] === 'string' && initialData['url'].startsWith('http')) {
    return initialData['url'];
  }
  if (hasProperty(initialData, 'wikiUrl') && typeof initialData['wikiUrl'] === 'string' && initialData['wikiUrl'].startsWith('http')) {
    return initialData['wikiUrl'];
  }
  if (hasProperty(initialData, 'providerUrl') && typeof initialData['providerUrl'] === 'string' && initialData['providerUrl'].startsWith('http')) {
    return initialData['providerUrl'];
  }
  // Check metadata nested URL fields
  if (isRecord(initialData.metadata)) {
    if (hasProperty(initialData.metadata, 'url') && typeof initialData.metadata['url'] === 'string') {
      return initialData.metadata['url'];
    }
    if (hasProperty(initialData.metadata, 'wikiUrl') && typeof initialData.metadata['wikiUrl'] === 'string') {
      return initialData.metadata['wikiUrl'];
    }
    // Try to construct Fandom URL from wikiKey and title
    const wikiKey = initialData.metadata['wikiKey'];
    const title = initialData['title'];
    if (typeof wikiKey === 'string' && typeof title === 'string') {
      const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
      return `https://${wikiKey}.fandom.com/wiki/${encodedTitle}`;
    }
  }
  return '';
}

/**
 * Extracts siteDetailUrl from initial data (ComicVine volume detail page URL)
 * Checks direct fields, metadata, and rawData for both camelCase and snake_case variants
 * @param initialData - Initial wizard data
 * @returns Site detail URL string
 */
export function extractSiteDetailUrl(initialData: InitialDataWithMetadata): string {
  // Check direct siteDetailUrl fields first (camelCase)
  if (hasProperty(initialData, 'siteDetailUrl') && typeof initialData['siteDetailUrl'] === 'string') {
    return initialData['siteDetailUrl'];
  }
  // Check snake_case variant
  if (hasProperty(initialData, 'site_detail_url') && typeof initialData['site_detail_url'] === 'string') {
    return initialData['site_detail_url'];
  }
  // Check metadata nested fields
  if (isRecord(initialData.metadata)) {
    if (hasProperty(initialData.metadata, 'siteDetailUrl') && typeof initialData.metadata['siteDetailUrl'] === 'string') {
      return initialData.metadata['siteDetailUrl'];
    }
    if (hasProperty(initialData.metadata, 'site_detail_url') && typeof initialData.metadata['site_detail_url'] === 'string') {
      return initialData.metadata['site_detail_url'];
    }
  }
  // Check rawData for ComicVine API structure
  const rawData = initialData['rawData'];
  if (isRecord(rawData)) {
    if (hasProperty(rawData, 'site_detail_url') && typeof rawData['site_detail_url'] === 'string') {
      return rawData['site_detail_url'];
    }
    if (hasProperty(rawData, 'siteDetailUrl') && typeof rawData['siteDetailUrl'] === 'string') {
      return rawData['siteDetailUrl'];
    }
  }
  return '';
}

/**
 * Extracts volumes list URL from initial data
 * @param initialData - Initial wizard data
 * @returns Volumes list URL string
 */
export function extractVolumesListUrl(initialData: InitialDataWithMetadata): string {
  if (isRecord(initialData) && hasProperty(initialData, 'volumesListUrl') && typeof initialData['volumesListUrl'] === 'string') {
    return initialData['volumesListUrl'];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'volumesListUrl') && typeof initialData.metadata['volumesListUrl'] === 'string') {
    return initialData.metadata['volumesListUrl'];
  }
  return '';
}

// ============================================================================
// Image Extractors
// ============================================================================

/**
 * Extracts cover image URL from initial data
 * @param initialData - Initial wizard data
 * @returns Cover image URL string
 */
export function extractCoverImage(initialData: InitialDataWithMetadata): string {
  if (hasProperty(initialData, 'coverImage') && typeof initialData['coverImage'] === 'string') {
    return initialData['coverImage'];
  }
  if (hasProperty(initialData, 'coverUrl') && typeof initialData['coverUrl'] === 'string') {
    return initialData['coverUrl'];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'coverImage') && typeof initialData.metadata['coverImage'] === 'string') {
    return initialData.metadata['coverImage'];
  }
  return '';
}

/**
 * Extracts banner image URL from initial data
 * @param initialData - Initial wizard data
 * @returns Banner image URL string
 */
export function extractBannerImage(initialData: InitialDataWithMetadata): string {
  if (hasProperty(initialData, 'bannerImage') && typeof initialData['bannerImage'] === 'string') {
    return initialData['bannerImage'];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'bannerImage') && typeof initialData.metadata['bannerImage'] === 'string') {
    return initialData.metadata['bannerImage'];
  }
  return '';
}

/**
 * Extracts gallery images from initial data
 * @param initialData - Initial wizard data
 * @returns Array of gallery image URLs
 */
export function extractGallery(initialData: InitialDataWithMetadata): string[] {
  if (hasProperty(initialData, 'gallery') && isStringArray(initialData['gallery'])) {
    return initialData['gallery'] as string[];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'gallery') && isStringArray(initialData.metadata['gallery'])) {
    return initialData.metadata['gallery'] as string[];
  }
  if (hasProperty(initialData, 'images') && isStringArray(initialData['images'])) {
    return initialData['images'] as string[];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'images') && isStringArray(initialData.metadata['images'])) {
    return initialData.metadata['images'] as string[];
  }
  return [];
}

// ============================================================================
// List Extractors
// ============================================================================

/**
 * Extracts authors list from initial data
 * @param initialData - Initial wizard data
 * @returns Array of author names
 */
export function extractAuthors(initialData: InitialDataWithMetadata): string[] {
  if (hasProperty(initialData, 'authors') && isStringArray(initialData['authors'])) {
    return initialData['authors'] as string[];
  }
  if (isRecord(initialData) && hasProperty(initialData, 'author') && typeof initialData['author'] === 'string') {
    return [initialData['author']];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'authors') && isStringArray(initialData.metadata['authors'])) {
    return initialData.metadata['authors'] as string[];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'author') && typeof initialData.metadata['author'] === 'string') {
    return [initialData.metadata['author']];
  }
  return [];
}

/**
 * Extracts artists list from initial data
 * @param initialData - Initial wizard data
 * @returns Array of artist names
 */
export function extractArtists(initialData: InitialDataWithMetadata): string[] {
  if (hasProperty(initialData, 'artists') && isStringArray(initialData['artists'])) {
    return initialData['artists'] as string[];
  }
  if (isRecord(initialData) && hasProperty(initialData, 'artist') && typeof initialData['artist'] === 'string') {
    return [initialData['artist']];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'artists') && isStringArray(initialData.metadata['artists'])) {
    return initialData.metadata['artists'] as string[];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'artist') && typeof initialData.metadata['artist'] === 'string') {
    return [initialData.metadata['artist']];
  }
  return [];
}

/**
 * Extracts alternative titles from initial data
 * @param initialData - Initial wizard data
 * @returns Array of alternative titles
 */
export function extractAlternativeTitles(initialData: InitialDataWithMetadata): string[] {
  if (isRecord(initialData) && hasProperty(initialData, 'alternativeTitles') && isStringArray(initialData['alternativeTitles'])) {
    return initialData['alternativeTitles'] as string[];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'alternativeTitles') && isStringArray(initialData.metadata['alternativeTitles'])) {
    return initialData.metadata['alternativeTitles'] as string[];
  }
  return [];
}

// ============================================================================
// Text Extractors
// ============================================================================

/**
 * Extracts format field from initial data
 * @param initialData - Initial wizard data
 * @param provider - Provider name
 * @returns Format string
 */
export function extractFormat(initialData: InitialDataWithMetadata, provider: string): string {
  if (hasProperty(initialData, 'format') && typeof initialData['format'] === 'string') {
    return initialData['format'];
  }
  if (isRecord(initialData) && hasProperty(initialData, 'type') && typeof initialData['type'] === 'string') {
    return initialData['type'];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'format') && typeof initialData.metadata['format'] === 'string') {
    return initialData.metadata['format'];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'type') && typeof initialData.metadata['type'] === 'string') {
    return initialData.metadata['type'];
  }
  return provider === 'fandom' ? 'MANGA' : '';
}

/**
 * Extracts publisher from initial data
 * @param initialData - Initial wizard data
 * @returns Publisher string
 */
export function extractPublisher(initialData: InitialDataWithMetadata): string {
  // Check direct publisher property (handles both string and object like { id, name })
  if (hasProperty(initialData, 'publisher')) {
    const result = extractPublisherName(initialData['publisher']);
    if (result) return result;
  }
  // Check metadata.publisher (handles both string and object)
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'publisher')) {
    const result = extractPublisherName(initialData.metadata['publisher']);
    if (result) return result;
  }
  return '';
}

/**
 * Extracts demographic from initial data
 * @param initialData - Initial wizard data
 * @returns Demographic string
 */
export function extractDemographic(initialData: InitialDataWithMetadata): string {
  if (hasProperty(initialData, 'demographic') && typeof initialData['demographic'] === 'string') {
    return initialData['demographic'];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'demographic') && typeof initialData.metadata['demographic'] === 'string') {
    return String(initialData.metadata['demographic']);
  }
  return '';
}

/**
 * Extracts start date from initial data
 * @param initialData - Initial wizard data
 * @returns Start date string
 */
export function extractStartDate(initialData: InitialDataWithMetadata): string {
  if (hasProperty(initialData, 'startDate') && typeof initialData['startDate'] === 'string') {
    return initialData['startDate'];
  }
  if (isRecord(initialData) && hasProperty(initialData, 'releaseDate') && typeof initialData['releaseDate'] === 'string') {
    return initialData['releaseDate'];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'startDate') && typeof initialData.metadata['startDate'] === 'string') {
    return initialData.metadata['startDate'];
  }
  return '';
}

/**
 * Extracts end date from initial data
 * @param initialData - Initial wizard data
 * @returns End date string
 */
export function extractEndDate(initialData: InitialDataWithMetadata): string {
  if (hasProperty(initialData, 'endDate') && typeof initialData['endDate'] === 'string') {
    return initialData['endDate'];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'endDate') && typeof initialData.metadata['endDate'] === 'string') {
    return initialData.metadata['endDate'];
  }
  return '';
}

/**
 * Extracts synopsis from initial data
 * @param initialData - Initial wizard data
 * @returns Synopsis string
 */
export function extractSynopsis(initialData: InitialDataWithMetadata): string {
  if (hasProperty(initialData, 'synopsis') && typeof initialData['synopsis'] === 'string') {
    return initialData['synopsis'];
  }
  if (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'synopsis') && typeof initialData.metadata['synopsis'] === 'string') {
    return String(initialData.metadata['synopsis']);
  }
  if (hasProperty(initialData, 'description') && typeof initialData['description'] === 'string') {
    return initialData['description'];
  }
  return '';
}
