/**
 * Source Detection
 *
 * Unified source type detection from URLs.
 * Single location for all URL-to-source mapping logic.
 *
 * @module shared/source-knowledge/source-detection
 */

import type { SourceType } from './types';

/**
 * URL patterns for detecting source type.
 * Order matters: more specific patterns should come first.
 */
const SOURCE_PATTERNS: ReadonlyArray<{ pattern: RegExp; type: SourceType }> = [
  { pattern: /fandom\.com|wikia\.com/i, type: 'fandom' },
  { pattern: /wikipedia\.org|mediawiki\.org/i, type: 'wikipedia' },
  { pattern: /anilist\.co/i, type: 'anilist' },
  { pattern: /comicvine\.gamespot\.com|comicvine\.com/i, type: 'comicvine' },
  { pattern: /mangadex\.org/i, type: 'mangadex' },
  { pattern: /myanimelist\.net/i, type: 'myanimelist' },
];

/**
 * Detect the source type from a URL.
 *
 * @param url - The URL to analyze
 * @returns The detected source type, or 'unknown' if unrecognized
 */
export function detectSourceType(url: string): SourceType {
  for (const { pattern, type } of SOURCE_PATTERNS) {
    if (pattern.test(url)) {
      return type;
    }
  }
  return 'unknown';
}

/**
 * Check if a URL is from Wikipedia.
 */
export function isWikipediaUrl(url: string): boolean {
  return detectSourceType(url) === 'wikipedia';
}

/**
 * Check if a URL is from ComicVine.
 */
export function isComicVineUrl(url: string): boolean {
  return detectSourceType(url) === 'comicvine';
}

/**
 * Check if a URL is from Fandom.
 */
export function isFandomUrl(url: string): boolean {
  return detectSourceType(url) === 'fandom';
}
