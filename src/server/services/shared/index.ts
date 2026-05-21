/**
 * Shared Services Module
 *
 * Common utilities shared across multiple services.
 *
 * @module shared
 */

export {
  protectedFetch,
  isFlareSolverrAvailable,
  getFlareSolverrStatus,
  getCachedCookies,
} from './protectedFetch';

export {
  extractISBN,
  extractAllISBNs,
  normalizeISBN,
  parseDate,
  extractDateString,
  isValidTextLength,
  isChapterListText,
  containsWikipediaArtifacts,
  extractChapterNumber,
  CHAPTER_NUMBER_PATTERN,
  CHAPTER_WITH_TITLE_PATTERN,
} from './parsing-utils';

export type { ISBNResult, DateResult } from './parsing-utils';
