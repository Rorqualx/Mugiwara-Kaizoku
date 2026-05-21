/**
 * Prose-based Metadata Extractors
 *
 * Extracts metadata from prose text patterns like "written by X" and "illustrated by Y".
 * These patterns are common on wiki chapter pages where author/artist info appears
 * in the opening paragraph rather than structured infobox fields.
 */

import type { CheerioAPI } from 'cheerio';

export interface ProseAuthorArtistResult {
  author?: string;
  artist?: string;
}

/**
 * Extract author and artist names from prose patterns in page content.
 *
 * Looks for patterns like:
 * - "written by Haro Aso"
 * - "illustrated by Takata Koutarou"
 * - "created by X"
 * - "drawn by Y"
 */
export function extractAuthorArtistFromProse($: CheerioAPI): ProseAuthorArtistResult {
  const result: ProseAuthorArtistResult = {};

  // Get first few paragraphs in main content
  const paragraphs = $('.mw-parser-output > p').slice(0, 3);

  paragraphs.each((_, el) => {
    const text = $(el).text();

    // Extract author from "written by X" or "created by X"
    if (!result.author) {
      const authorMatch = text.match(/(?:written|created)\s+by\s+([A-Z][a-zA-Z\s]+?)(?:\s+and\s+|\s*\.|,|\s+It\s)/i);
      if (authorMatch?.[1]) {
        result.author = authorMatch[1].trim();
      }
    }

    // Extract artist from "illustrated by X" or "drawn by X"
    if (!result.artist) {
      const artistMatch = text.match(/(?:illustrated|drawn)\s+by\s+([A-Z][a-zA-Z\s]+?)(?:\s*\.|,|\s+It\s|\s+The\s)/i);
      if (artistMatch?.[1]) {
        result.artist = artistMatch[1].trim();
      }
    }
  });

  return result;
}

/**
 * Navigation text patterns that indicate the text should not be labeled.
 * Used to filter out sidebar navigation, breadcrumbs, and structural elements.
 */
export const NAVIGATION_TEXT_PATTERNS = [
  // Standalone navigation links
  /^characters$/i,
  /^chapters$/i,
  /^volumes$/i,
  /^episodes$/i,
  /^wiki$/i,
  /^category$/i,
  /^browse$/i,
  /^explore$/i,
  /^gallery$/i,
  /^images$/i,
  /^media$/i,
  /^videos$/i,
  // Navigation with "List of" prefix
  /^(?:manga\s+)?list\s+of\s+(?:chapters|volumes|characters|episodes)/i,
  // Volume/Chapter navigation in chapter guides
  /^volume\s+\d+$/i,
  /^chapter\s+\d+$/i,
  // Category navigation links
  /^manga\s+chapters$/i,
  /^anime\s+episodes$/i,
  /^chapters\s+and\s+volumes$/i,
  // Next/Previous navigation
  /^next$/i,
  /^previous$/i,
  /^prev$/i,
  /^back$/i,
  /^home$/i,
];

/**
 * Check if text matches a navigation pattern that should not be labeled.
 */
export function isNavigationPattern(text: string): boolean {
  const normalized = text.trim();
  return NAVIGATION_TEXT_PATTERNS.some(pattern => pattern.test(normalized));
}
