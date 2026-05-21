/**
 * Manga Router Data Normalizers
 *
 * Functions for normalizing volume and chapter data from various
 * providers (ComicVine, Fandom, AniList, Wikipedia) into common structures.
 *
 * Extracted from: helpers.ts (lines 345-452)
 */

import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Normalized volume data interface
 * Provides a common structure regardless of provider
 */
export interface NormalizedVolume {
  volumeNumber: number;
  title?: string;
  coverImage?: string;
  downloadUrl?: string;
  releaseDate?: string;
  description?: string;
  chapters?: unknown[];
}

// ============================================================================
// Type Guards (internal)
// ============================================================================

/**
 * Type guard for objects
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Extract volume number from various provider field names
 * Tries multiple field names from different providers (ComicVine, Fandom, AniList, Wikipedia)
 */
function extractVolumeNumber(volume: Record<string, unknown>, index: number): number {
  // Try volumeNumber (common)
  if (typeof volume['volumeNumber'] === 'number') {
    return volume['volumeNumber'];
  }
  // Try volume (alternative)
  if (typeof volume['volume'] === 'number') {
    return volume['volume'];
  }
  // Try number (generic)
  if (typeof volume['number'] === 'number') {
    return volume['number'];
  }
  // Try issue_number (ComicVine snake_case)
  if (typeof volume['issue_number'] === 'number') {
    return volume['issue_number'];
  }
  // Try issueNumber (ComicVine camelCase)
  if (typeof volume['issueNumber'] === 'number') {
    return volume['issueNumber'];
  }
  // Fallback to index-based numbering
  return index + 1;
}

/**
 * Extract title from various provider field names
 */
function extractTitle(volume: Record<string, unknown>): string | undefined {
  // Try title (common)
  if (typeof volume['title'] === 'string') {
    return volume['title'];
  }
  // Try name (alternative)
  if (typeof volume['name'] === 'string') {
    return volume['name'];
  }
  // Try volumeTitle (specific)
  if (typeof volume['volumeTitle'] === 'string') {
    return volume['volumeTitle'];
  }
  return undefined;
}

/**
 * Extract cover image URL from ComicVine image structure
 * ComicVine uses: image.medium_url, image.small_url, image.original_url
 */
function extractComicVineCover(image: Record<string, unknown>): string | undefined {
  if (typeof image['medium_url'] === 'string') {
    return image['medium_url'];
  }
  if (typeof image['small_url'] === 'string') {
    return image['small_url'];
  }
  if (typeof image['original_url'] === 'string') {
    return image['original_url'];
  }
  return undefined;
}

/**
 * Extract cover image URL from AniList cover structure
 * AniList uses: coverImage.large, coverImage.medium, coverImage.small
 */
function extractAniListCover(cover: Record<string, unknown>): string | undefined {
  if (typeof cover['large'] === 'string') {
    return cover['large'];
  }
  if (typeof cover['medium'] === 'string') {
    return cover['medium'];
  }
  if (typeof cover['small'] === 'string') {
    return cover['small'];
  }
  return undefined;
}

/**
 * Extract cover image from various provider structures
 * Handles different provider formats (direct string, ComicVine, AniList)
 */
function extractCoverImage(volume: Record<string, unknown>): string | undefined {
  // Direct string value
  if (typeof volume['coverImage'] === 'string') {
    return volume['coverImage'];
  }

  // ComicVine structure: image.medium_url, image.small_url
  if (isRecord(volume['image'])) {
    return extractComicVineCover(volume['image']);
  }

  // AniList structure: coverImage.large, coverImage.medium
  if (isRecord(volume['coverImage'])) {
    return extractAniListCover(volume['coverImage']);
  }

  return undefined;
}

/**
 * Extract download URL from various provider field names
 */
function extractDownloadUrl(volume: Record<string, unknown>): string | undefined {
  // Try url (common)
  if (typeof volume['url'] === 'string') {
    return volume['url'];
  }
  // Try site_detail_url (ComicVine snake_case)
  if (typeof volume['site_detail_url'] === 'string') {
    return volume['site_detail_url'];
  }
  // Try api_detail_url (ComicVine API)
  if (typeof volume['api_detail_url'] === 'string') {
    return volume['api_detail_url'];
  }
  // Try siteUrl (AniList camelCase)
  if (typeof volume['siteUrl'] === 'string') {
    return volume['siteUrl'];
  }
  return undefined;
}

/**
 * Extract release date from various provider field names
 */
function extractReleaseDateField(volume: Record<string, unknown>): string | undefined {
  // Try releaseDate (common)
  if (typeof volume['releaseDate'] === 'string') {
    return volume['releaseDate'];
  }
  // Try cover_date (ComicVine)
  if (typeof volume['cover_date'] === 'string') {
    return volume['cover_date'];
  }
  // Try store_date (ComicVine)
  if (typeof volume['store_date'] === 'string') {
    return volume['store_date'];
  }
  // Try startDate (AniList)
  if (typeof volume['startDate'] === 'string') {
    return volume['startDate'];
  }
  // Try date (generic)
  if (typeof volume['date'] === 'string') {
    return volume['date'];
  }
  return undefined;
}

/**
 * Extract description from various provider field names
 */
function extractDescription(volume: Record<string, unknown>): string | undefined {
  // Try description (common)
  if (typeof volume['description'] === 'string') {
    return volume['description'];
  }
  // Try deck (ComicVine short description)
  if (typeof volume['deck'] === 'string') {
    return volume['deck'];
  }
  // Try summary (alternative)
  if (typeof volume['summary'] === 'string') {
    return volume['summary'];
  }
  return undefined;
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Normalize volume/issue data from any provider into a common structure
 * Supports: ComicVine, Fandom, AniList, Wikipedia, and other providers
 *
 * Uses decomposed helper functions for each field extraction to maintain
 * low complexity while handling multiple provider formats.
 */
export function normalizeVolumeData(volume: Record<string, unknown>, index: number): NormalizedVolume {
  // Extract all fields using dedicated helper functions
  const volumeNumber = extractVolumeNumber(volume, index);
  const title = extractTitle(volume);
  const coverImage = extractCoverImage(volume);
  const downloadUrl = extractDownloadUrl(volume);
  const releaseDate = extractReleaseDateField(volume);
  const description = extractDescription(volume);

  // Chapters - try to extract pre-parsed chapters
  const chapters = Array.isArray(volume['chapters']) ? volume['chapters'] : undefined;

  // Build result with only defined fields
  return {
    volumeNumber,
    ...(title !== undefined ? { title } : {}),
    ...(coverImage !== undefined ? { coverImage } : {}),
    ...(downloadUrl !== undefined ? { downloadUrl } : {}),
    ...(releaseDate !== undefined ? { releaseDate } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(chapters !== undefined ? { chapters } : {})
  };
}

/**
 * Helper function to parse release date strings into Date objects
 * Handles various date formats including ordinal suffixes (1st, 2nd, 3rd, 21st)
 * Returns null for invalid dates
 */
export function parseReleaseDate(dateString: string | undefined | null): Date | null {
  if (!dateString) return null;

  try {
    // Strip ordinal suffixes (1st, 2nd, 3rd, 21st, etc.) before parsing
    const cleanedDate = dateString.replace(/(\d+)(st|nd|rd|th)/gi, '$1');

    const parsed = new Date(cleanedDate);
    if (isNaN(parsed.getTime())) {
      logger.warn(`Invalid release date format: "${dateString}" (cleaned: "${cleanedDate}")`);
      return null;
    }
    return parsed;
  } catch (error) {
    logger.error(`Failed to parse release date: "${dateString}"`, error);
    return null;
  }
}
