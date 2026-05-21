/**
 * Search Result Validator - Foundation Utilities
 *
 * Shared helper functions for extracting and validating fields
 * from raw search results across all metadata providers.
 *
 * Extracted from: SearchResultValidator.ts (lines 1-206)
 */


import { MetadataProvider, MangaPublicationStatus } from '@prisma/client';

import type { SearchResult } from '@/types/search.types';
import { toStringId } from '@/utils/id-converters';


// ============================================================================
// HTML Cleaning
// ============================================================================

/**
 * Clean HTML content from descriptions
 * Removes HTML tags, entities, and other artifacts
 *
 * @param html - HTML string to clean
 * @returns Clean text without HTML
 */
export function cleanHtmlDescription(html: string): string {
  // First remove figure tags and their content completely (images)
  let cleaned = html.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '');

  // Remove all HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));

  // Remove extra whitespace and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// ============================================================================
// Field Extractors
// ============================================================================

/**
 * Extract cover image URL from various field names
 *
 * @param obj - Raw data object
 * @returns Cover URL or undefined
 */
export function extractCoverField(obj: Record<string, unknown>): string | undefined {
  if (typeof obj["cover"] === 'string') return obj["cover"];
  if (typeof obj["coverImage"] === 'string') return obj["coverImage"];
  if (typeof obj["image"] === 'string') return obj["image"];
  return undefined;
}

/**
 * Extract description from various field names
 *
 * @param obj - Raw data object
 * @returns Description or undefined
 */
export function extractDescriptionField(obj: Record<string, unknown>): string | undefined {
  if (typeof obj["description"] === 'string') return obj["description"];
  if (typeof obj["summary"] === 'string') return obj["summary"];
  if (typeof obj["deck"] === 'string') return obj["deck"];
  return undefined;
}

/**
 * Extract alternative titles from various field names
 *
 * @param obj - Raw data object
 * @returns Array of alternative titles or undefined
 */
export function extractAlternativeTitles(obj: Record<string, unknown>): string[] | undefined {
  if (Array.isArray(obj["alternativeTitles"])) {
    return obj["alternativeTitles"].filter((t): t is string => typeof t === 'string');
  }
  if (Array.isArray(obj["aliases"])) {
    return obj["aliases"].filter((t): t is string => typeof t === 'string');
  }
  return undefined;
}

/**
 * Extract score from various field names
 *
 * @param obj - Raw data object
 * @returns Score or undefined
 */
export function extractScore(obj: Record<string, unknown>): number | undefined {
  if (typeof obj["score"] === 'number') return obj["score"];
  if (typeof obj["averageScore"] === 'number') return obj["averageScore"];
  if (typeof obj["meanScore"] === 'number') return obj["meanScore"];
  return undefined;
}

/**
 * Extract and validate chapters count
 *
 * @param obj - Raw data object
 * @returns Chapters count or undefined
 */
export function extractChapters(obj: Record<string, unknown>): number | undefined {
  const chaptersValue = obj["chapters"];
  if (typeof chaptersValue === 'number' && chaptersValue > 0 && chaptersValue < 10000) {
    return chaptersValue;
  }
  const chapterCount = obj["chapterCount"];
  if (typeof chapterCount === 'number' && chapterCount > 0 && chapterCount < 10000) {
    return chapterCount;
  }
  return undefined;
}

/**
 * Extract and validate volumes count
 *
 * @param obj - Raw data object
 * @returns Volumes count or undefined
 */
export function extractVolumes(obj: Record<string, unknown>): number | undefined {
  const volumesValue = obj["volumes"];
  if (typeof volumesValue === 'number' && volumesValue > 0 && volumesValue < 1000) {
    return volumesValue;
  }
  const volumeCount = obj["volumeCount"];
  if (typeof volumeCount === 'number' && volumeCount > 0 && volumeCount < 1000) {
    return volumeCount;
  }
  const volumeNumber = obj["volume_number"];
  if (typeof volumeNumber === 'number' && volumeNumber > 0 && volumeNumber < 1000) {
    return volumeNumber;
  }
  return undefined;
}

/**
 * Extract title from string or object
 *
 * @param obj - Raw data object
 * @returns Title string
 */
export function extractTitle(obj: Record<string, unknown>): string {
  if (typeof obj["title"] === 'string') return obj["title"];
  if (typeof obj["name"] === 'string') return obj["name"];
  if (obj["title"] && typeof obj["title"] === 'object') {
    const titleObj = obj["title"] as Record<string, unknown>;
    return (typeof titleObj['english'] === 'string' ? titleObj['english'] : '') ||
           (typeof titleObj['romaji'] === 'string' ? titleObj['romaji'] : '') ||
           (typeof titleObj['native'] === 'string' ? titleObj['native'] : '');
  }
  return 'Unknown';
}

/**
 * Extract ID as string
 *
 * @param obj - Raw data object
 * @returns ID string
 */
export function extractId(obj: Record<string, unknown>): string {
  if (typeof obj["id"] === 'string') return obj["id"];
  if (obj["id"] !== null) return toStringId(obj["id"]);
  return `unknown-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid search result
 *
 * @param value - Value to check
 * @returns Boolean indicating if the value is a valid search result
 */
export function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  // Check required fields
  if (!obj["id"] || typeof obj["id"] !== 'string') {
    return false;
  }
  if (!obj["title"] || typeof obj["title"] !== 'string') {
    return false;
  }
  if (!obj["provider"] || !Object.values(MetadataProvider).includes(obj["provider"] as MetadataProvider)) {
    return false;
  }
  return true;
}

// ============================================================================
// Base Result Builder
// ============================================================================

/**
 * Create base search result from raw data
 * Extracts common fields and builds a standardized SearchResult object
 *
 * @param obj - Raw data object from provider
 * @param providerType - Metadata provider type
 * @returns Standardized search result with all available fields
 */
export function createBaseResult(
  obj: Record<string, unknown>,
  providerType: MetadataProvider
): SearchResult {
  const cover = extractCoverField(obj);
  const description = extractDescriptionField(obj);
  const status = typeof obj["status"] === 'string'
    ? obj["status"] as MangaPublicationStatus
    : undefined;
  const alternativeTitles = extractAlternativeTitles(obj);
  const score = extractScore(obj);
  const genres = Array.isArray(obj["genres"])
    ? obj["genres"].filter((g): g is string => typeof g === 'string')
    : undefined;
  const chapters = extractChapters(obj);
  const volumes = extractVolumes(obj);

  return {
    id: extractId(obj),
    title: extractTitle(obj),
    type: 'manga',
    ...(cover ? { cover, coverImage: cover } : {}),
    ...(description ? { description } : {}),
    ...(status ? { status } : {}),
    ...(alternativeTitles ? { alternativeTitles } : {}),
    ...(score !== undefined ? { score } : {}),
    ...(genres ? { genres } : {}),
    ...(chapters !== undefined ? { chapters } : {}),
    ...(volumes !== undefined ? { volumes } : {}),
    provider: providerType.toString()
  };
}
