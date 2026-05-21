/**
 * Page Type Detection
 *
 * Detects the type of page based on URL patterns and content.
 */

import type { PageType } from './types';

// ============================================================================
// URL Pattern Definitions
// ============================================================================

interface PageTypePattern {
  pageType: PageType;
  urlPatterns: RegExp[];
  priority: number;
}

const PAGE_TYPE_PATTERNS: PageTypePattern[] = [
  // Individual chapter pages (highest priority for specificity)
  {
    pageType: 'INDIVIDUAL_CHAPTER',
    urlPatterns: [
      /\/chapter[_-]?\d+/i,
      /\/ch[_-]?\d+/i,
      /\/episode[_-]?\d+/i,
      /chapters\/\d+/i,
      /\/chapter\/\d+/i,
    ],
    priority: 100,
  },
  // Individual volume pages
  {
    pageType: 'INDIVIDUAL_VOLUME',
    urlPatterns: [
      /\/volume[_-]?\d+/i,
      /\/vol[_-]?\d+/i,
      /volumes\/\d+/i,
      /\/volume\/\d+/i,
      /\/tankōbon[_-]?\d+/i,
      /\/tankobon[_-]?\d+/i,
    ],
    priority: 90,
  },
  // Chapter overview pages
  {
    pageType: 'CHAPTER_OVERVIEW',
    urlPatterns: [
      /\/chapters\/?$/i,
      /\/chapter[_-]?list/i,
      /\/episode[_-]?list/i,
      /chapters_and_volumes/i,
    ],
    priority: 80,
  },
  // Volume overview pages
  {
    pageType: 'VOLUME_OVERVIEW',
    urlPatterns: [
      /\/volumes\/?$/i,
      /\/volume[_-]?list/i,
      /\/tankōbon\/?$/i,
      /\/tankobon\/?$/i,
    ],
    priority: 80,
  },
  // Manga page format (non-wiki style)
  {
    pageType: 'MANGA_PAGE',
    urlPatterns: [
      /\/manga\//i,
      /\/series\//i,
      /\/title\//i,
      /\/comic\//i,
    ],
    priority: 60,
  },
  // Series page (wiki style - default for wiki URLs)
  {
    pageType: 'SERIES_PAGE',
    urlPatterns: [
      /\/wiki\//i,
      /wikipedia\.org/i,
      /fandom\.com\/wiki\//i,
    ],
    priority: 50,
  },
];

// ============================================================================
// Page Type Detection
// ============================================================================

/**
 * Detect the page type from a URL
 */
export function detectPageType(url: string): PageType {
  // Sort patterns by priority (highest first)
  const sortedPatterns = [...PAGE_TYPE_PATTERNS].sort((a, b) => b.priority - a.priority);

  for (const pattern of sortedPatterns) {
    const matchesUrl = pattern.urlPatterns.some((regex) => regex.test(url));
    if (matchesUrl) {
      return pattern.pageType;
    }
  }

  return 'UNKNOWN';
}

/**
 * Check if URL looks like an individual chapter page
 */
export function isChapterPageUrl(url: string): boolean {
  return detectPageType(url) === 'INDIVIDUAL_CHAPTER';
}

/**
 * Check if URL looks like an individual volume page
 */
export function isVolumePageUrl(url: string): boolean {
  return detectPageType(url) === 'INDIVIDUAL_VOLUME';
}

/**
 * Check if URL looks like a series/manga main page
 */
export function isSeriesPageUrl(url: string): boolean {
  const pageType = detectPageType(url);
  return pageType === 'SERIES_PAGE' || pageType === 'MANGA_PAGE';
}

/**
 * Extract volume number from URL if present
 */
export function extractVolumeNumberFromUrl(url: string): number | null {
  const volumeMatch = url.match(/volume[_-]?(\d+)/i) ?? url.match(/vol[_-]?(\d+)/i);
  if (volumeMatch?.[1]) {
    return parseInt(volumeMatch[1], 10);
  }
  return null;
}

/**
 * Extract chapter number from URL if present
 */
export function extractChapterNumberFromUrl(url: string): number | null {
  const chapterMatch = url.match(/chapter[_-]?(\d+)/i) ?? url.match(/ch[_-]?(\d+)/i);
  if (chapterMatch?.[1]) {
    return parseInt(chapterMatch[1], 10);
  }
  return null;
}

/**
 * Get human-readable page type label
 */
export function getPageTypeLabel(pageType: PageType): string {
  const labels: Record<PageType, string> = {
    SERIES_PAGE: 'Series Page',
    MANGA_PAGE: 'Manga Page',
    VOLUME_OVERVIEW: 'Volume Overview',
    CHAPTER_OVERVIEW: 'Chapter Overview',
    INDIVIDUAL_VOLUME: 'Individual Volume',
    INDIVIDUAL_CHAPTER: 'Individual Chapter',
    UNKNOWN: 'Unknown',
  };
  return labels[pageType];
}
