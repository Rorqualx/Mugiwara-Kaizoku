/**
 * Metadata Normalization Module
 *
 * Normalizes extracted metadata into domain model structure.
 * Handles title, author, status, dates, and other metadata fields.
 *
 * Extracted from: DataNormalizer.ts (lines 265-377)
 */

import { mapToMangaStatus } from '@/utils/status-mapper';

import type {
  ExtractedMetadata,
  MangaPublicationStatus,
  NormalizedMangaData,
  NormalizationOptions,
} from './types';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse a date string into a Date object
 * Handles standard date formats and year-only strings
 */
function parseDate(dateStr: string): Date | undefined {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // Try alternative parsing - extract year
    const match = dateStr.match(/(\d{4})/);
    if (match?.[1]) {
      return new Date(parseInt(match[1], 10), 0, 1);
    }
    return undefined;
  }
  return date;
}

/**
 * Normalize text by trimming, collapsing whitespace, and capitalizing
 */
export function normalizeText(text: string): string {
  if (!text) return text;

  // Trim and collapse multiple spaces/newlines into single spaces
  const collapsed = text.trim().replace(/\s+/g, ' ');

  // Title case: capitalize first letter of each word
  return collapsed
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// Main Metadata Normalization
// ============================================================================

/**
 * Normalize extracted metadata into domain model
 *
 * Refactored to reduce complexity by splitting into helper functions:
 * - normalizeMetadataBase: Creates base structure
 * - getOptionalMetadataFields: Gets optional fields as partial object
 * - getMetadataDateFields: Gets date fields as partial object
 */
export function normalizeMetadata(metadata: ExtractedMetadata, options: NormalizationOptions = {}): NormalizedMangaData {
  // Create base structure
  const base = normalizeMetadataBase(metadata, options);

  // Get optional fields
  const optionals = getOptionalMetadataFields(metadata, options);

  // Get date fields
  const dates = getMetadataDateFields(metadata);

  return {
    ...base,
    ...optionals,
    ...dates
  };
}

/**
 * Create base metadata structure with required fields
 */
function normalizeMetadataBase(metadata: ExtractedMetadata, options: NormalizationOptions): NormalizedMangaData {
  const title = metadata["title"] ?? 'Unknown';

  return {
    title: options.normalizeText ? normalizeText(title) : title,
    alternativeTitles: normalizeAlternativeTitles(metadata),
    status: normalizeStatus(metadata["status"]),
    volumes: [],
    chapters: [],
    source: {
      type: 'other',
      extractedAt: new Date(),
      confidence: 0.5
    }
  };
}

/**
 * Get optional metadata fields as partial object
 * Returns only fields that have values
 */
function getOptionalMetadataFields(metadata: ExtractedMetadata, options: NormalizationOptions): Partial<NormalizedMangaData> {
  const result: Partial<NormalizedMangaData> = {};

  const description = metadata["description"] ?? metadata.synopsis ?? metadata.plot;
  if (description) {
    result.description = options.normalizeText ? normalizeText(description) : description;
  }

  if (metadata.author) {
    result.author = metadata.author;
  }

  const artist = metadata.artist ?? metadata.illustrator;
  if (artist) {
    result.artist = artist;
  }

  const publisher = metadata.publisher ?? metadata.englishPublisher;
  if (publisher) {
    result.publisher = publisher;
  }

  const magazine = metadata.magazine ?? metadata.serialization;
  if (magazine) {
    result.magazine = magazine;
  }

  if (metadata.demographic) {
    result.demographic = metadata.demographic;
  }

  if (metadata["genres"]) {
    result.genres = metadata["genres"];
  }

  if (metadata.themes) {
    result.themes = metadata.themes;
  }

  if (metadata.volumes) {
    result.totalVolumes = metadata.volumes;
  }

  if (metadata["chapters"]) {
    result.totalChapters = metadata["chapters"];
  }

  return result;
}

/**
 * Get date fields from metadata as partial object
 */
function getMetadataDateFields(metadata: ExtractedMetadata): Partial<NormalizedMangaData> {
  const result: Partial<NormalizedMangaData> = {};

  if (metadata.startDate) {
    const startDate = parseDate(metadata.startDate);
    if (startDate !== undefined) {
      result.startDate = startDate;
    }
  }

  if (metadata.endDate) {
    const endDate = parseDate(metadata.endDate);
    if (endDate !== undefined) {
      result.endDate = endDate;
    }
  }

  return result;
}

// ============================================================================
// Alternative Titles
// ============================================================================

/**
 * Normalize alternative titles from metadata
 * Collects titles from various metadata fields and deduplicates
 */
export function normalizeAlternativeTitles(metadata: ExtractedMetadata): string[] {
  const titles: string[] = [];

  if (metadata["alternativeTitles"]) {
    titles.push(...metadata["alternativeTitles"]);
  }

  if (metadata.japaneseTitle) {
    titles.push(metadata.japaneseTitle);
  }

  if (metadata.romajiTitle) {
    titles.push(metadata.romajiTitle);
  }

  if (metadata.englishTitle && metadata.englishTitle !== metadata["title"]) {
    titles.push(metadata.englishTitle);
  }

  // Remove duplicates and empty values
  // Filter truthy strings that have content after trimming
  return [...new Set(titles.filter(t => Boolean(t) && t.trim().length > 0))];
}

// ============================================================================
// Status Normalization
// ============================================================================

/**
 * Normalize publication status
 * Maps raw status strings to MangaPublicationStatus enum values
 */
export function normalizeStatus(status?: ExtractedMetadata['status']): MangaPublicationStatus {
  if (!status) return 'UNKNOWN' as MangaPublicationStatus;

  return mapToMangaStatus(status);
}
