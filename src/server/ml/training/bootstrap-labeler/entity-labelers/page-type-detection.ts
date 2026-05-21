/**
 * Page Type Detection for Entity Labelers
 *
 * Detects whether a page is a series, chapter, or volume page based on URL patterns.
 */

export type PageType = 'chapter' | 'volume' | 'series' | 'list' | 'unknown';

/**
 * URL patterns that indicate a chapter page
 * Matches: /Chapter_01, /Episode_1, _Chapter_01, etc.
 */
const CHAPTER_URL_PATTERNS = [
  /[/_]chapter[_-]?\d+/i,
  /[/_]episode[_-]?\d+/i,
  /[/_]ch[_-]?\d+/i,
  /[/_]ep[_-]?\d+/i,
  /chapters?\/[^/]+$/i, // e.g., /chapters/chapter-1
  /\/issue\/4000-\d+/i, // ComicVine issue pages (API-style: /issue/4000-{id}/)
  /\/4000-\d+/i,        // ComicVine issue pages (slug-style: /vinland-saga-1/4000-{id}/)
];

/**
 * URL patterns that indicate a volume page
 */
const VOLUME_URL_PATTERNS = [
  /[/_]volume[_-]?\d+/i,
  /[/_]vol[_-]?\d+/i,
  /[/_]tankōbon[_-]?\d+/i,
  /[/_]tankobon[_-]?\d+/i,
  /volumes?\/[^/]+$/i, // e.g., /volumes/volume-1
];

/**
 * URL patterns that indicate a list/index page
 * e.g., "Chapters_and_Volumes", "List_of_Chapters"
 */
const LIST_URL_PATTERNS = [
  /chapters?[_-]and[_-]volumes?/i,
  /volumes?[_-]and[_-]chapters?/i,
  /list[_-]of[_-](chapters?|volumes?|episodes?)/i,
  /[/_](chapters?|volumes?)[/_]?$/i, // e.g., /chapters, /volumes (plural, no number)
];

/**
 * Detect the type of page based on URL patterns
 *
 * @param url - The page URL to analyze
 * @returns The detected page type
 */
export function detectPageType(url: string): PageType {
  const normalizedUrl = url.toLowerCase();

  // Check for list/index page patterns FIRST (before chapter/volume)
  // This prevents "Chapters_and_Volumes" from matching chapter patterns
  for (const pattern of LIST_URL_PATTERNS) {
    if (pattern.test(normalizedUrl)) {
      return 'list';
    }
  }

  // Check for chapter page patterns
  for (const pattern of CHAPTER_URL_PATTERNS) {
    if (pattern.test(normalizedUrl)) {
      return 'chapter';
    }
  }

  // Check for volume page patterns
  for (const pattern of VOLUME_URL_PATTERNS) {
    if (pattern.test(normalizedUrl)) {
      return 'volume';
    }
  }

  // Default to series page (main manga/anime page)
  return 'series';
}
