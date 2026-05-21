/**
 * ComicVine Scraping Types
 *
 * Type definitions for ComicVine web scraping operations.
 * Extracted from: scrapingService.ts (lines 13-32)
 *
 * @module types
 */

/**
 * Chapter prefix types for different manga formats
 */
export type ChapterPrefix = 'Chapter' | 'Spell' | 'Episode' | 'Story' | 'Part' | 'Extra' | 'Special';

/**
 * Represents a single chapter from ComicVine
 */
export interface ComicVineChapter {
  /** Chapter number (e.g., "1", "0", "final", "epilogue-1") */
  number: string;

  /** Chapter title */
  title: string;

  /** Chapter prefix (e.g., "Spell" for Dorohedoro, "Chapter" for most manga) */
  prefix?: ChapterPrefix;

  /** Roman numeral representation (if applicable) */
  romanNumeral?: string;

  /** Chapter description (ComicVine typically doesn't provide this) */
  description?: string;

  /** Whether this is the final chapter */
  isFinalChapter?: boolean;

  /** Whether this is an epilogue chapter */
  isEpilogue?: boolean;

  /** Epilogue sequence number (for multiple epilogues) */
  epilogueNumber?: number;

  /** Whether this is a special/bonus chapter */
  isSpecial?: boolean;
}

/**
 * Represents all chapters for a ComicVine volume
 */
export interface ComicVineVolumeChapters {
  /** ComicVine volume ID (extracted from URL) */
  volumeId: string;

  /** Volume number in the series */
  volumeNumber: number;

  /** Full volume title (includes subtitle if available) */
  volumeTitle: string;

  /** Volume description/summary */
  volumeSummary?: string;

  /** Cover image URL */
  coverImage?: string;

  /** Array of chapters in this volume */
  chapters: ComicVineChapter[];

  /** Total number of chapters */
  totalChapters: number;

  /** Themes/concepts extracted from the page (e.g., Action, Adventure, Supernatural) */
  themes?: string[];

  /** Genres extracted from the page */
  genres?: string[];
}

/**
 * Represents volume URL information for series scraping
 */
export interface VolumeUrlInfo {
  /** Volume number in the series */
  volumeNumber: number;

  /** Full ComicVine URL for the volume */
  url: string;

  /** Cover image URL for this volume/issue */
  coverUrl?: string;
}

/**
 * Represents an issue with its cover image from the series page
 */
export interface IssueWithCoverInfo {
  /** Issue number (1-based) */
  issueNumber: number;

  /** Issue title from the page */
  title?: string;

  /** Full ComicVine URL for the issue */
  url: string;

  /** Cover image URL for this issue */
  coverUrl?: string;
}

/**
 * Type for cheerio-compatible data (HTML string or Buffer)
 */
export interface CheerioData {
  /** HTML content as string or Buffer */
  data: string | Buffer;
}

/**
 * Pagination information extracted from HTML
 */
export interface PaginationInfo {
  /** Current page number (1-based) */
  currentPage: number;

  /** Total number of pages */
  totalPages: number;

  /** URL for the next page (null if on last page) */
  nextPageUrl: string | null;

  /** All page URLs found */
  pageUrls: string[];
}
