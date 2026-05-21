/**
 * Image Extractors
 *
 * Functions for extracting cover images and all images from HTML documents.
 * Consolidates source-specific selectors into a unified configuration.
 *
 * Extracted from: UnifiedMetadataParser.ts (lines 594-637, 809-822)
 * Deduplicated: 3 similar methods -> 1 configurable function
 */

import { ExtractionUtilities } from './extraction-utilities';

import type { CheerioAPI } from 'cheerio';


// ============================================================================
// Types
// ============================================================================

/**
 * Supported cover image sources with their specific selectors
 */
export type CoverImageSource = 'fandom' | 'wikipedia' | 'generic';

// ============================================================================
// Configuration
// ============================================================================

/**
 * CSS selectors for extracting cover images from different sources.
 * Each source has its own set of selectors ordered by priority.
 */
export const COVER_IMAGE_SELECTORS: Record<CoverImageSource, readonly string[]> = {
  fandom: [
    '.portable-infobox .pi-image img',
    '.portable-infobox .pi-image-thumbnail img',
    '.infobox-image img',
    '.infobox .image img',
    '#mw-content-text .infobox img',
    '.wikia-gallery-item img',
    '.gallery .thumb img',
  ],
  wikipedia: [
    '.infobox .image img',
    '.infobox-image img',
    '.infobox img',
    '#mw-content-text .thumb img',
  ],
  generic: [
    '.portable-infobox img',
    '.infobox img',
    'img[alt*="cover"]',
    'img[alt*="volume"]',
    '.cover img',
    '.thumb img',
  ],
} as const;

// ============================================================================
// Extraction Functions
// ============================================================================

/**
 * Extract cover image URL based on the source type
 *
 * @param $ - Cheerio API instance
 * @param source - The source type ('fandom', 'wikipedia', or 'generic')
 * @returns Extracted and cleaned image URL, or empty string if not found
 *
 * @example
 * ```typescript
 * const coverUrl = extractCoverImage($, 'fandom');
 * if (coverUrl) {
 *   console.log('Found cover:', coverUrl);
 * }
 * ```
 */
export function extractCoverImage($: CheerioAPI, source: CoverImageSource): string {
  const selectors = COVER_IMAGE_SELECTORS[source];
  return ExtractionUtilities.extractImageUrl($, $('body'), selectors);
}

/**
 * Extract Fandom-specific cover image
 *
 * @param $ - Cheerio API instance
 * @returns Extracted cover image URL
 */
export function extractFandomCoverImage($: CheerioAPI): string {
  return extractCoverImage($, 'fandom');
}

/**
 * Extract Wikipedia-specific cover image
 *
 * @param $ - Cheerio API instance
 * @returns Extracted cover image URL
 */
export function extractWikipediaCoverImage($: CheerioAPI): string {
  return extractCoverImage($, 'wikipedia');
}

/**
 * Extract generic cover image using common selectors
 *
 * @param $ - Cheerio API instance
 * @returns Extracted cover image URL
 */
export function extractGenericCoverImage($: CheerioAPI): string {
  return extractCoverImage($, 'generic');
}

/**
 * Extract all unique images from a page
 *
 * @param $ - Cheerio API instance
 * @returns Array of unique, cleaned image URLs
 *
 * @example
 * ```typescript
 * const images = extractAllImages($);
 * console.log(`Found ${images.length} unique images`);
 * ```
 */
export function extractAllImages($: CheerioAPI): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  $('img').each((_, img) => {
    const url = ExtractionUtilities.cleanImageUrl($(img).attr('src'));
    if (url && !seen.has(url)) {
      seen.add(url);
      images.push(url);
    }
  });

  return images;
}
