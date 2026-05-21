/**
 * Table Extractor - Type Definitions
 *
 * Shared interfaces and types used across all table extraction modules.
 * These types define the structure for volume, chapter, and arc data
 * extracted from HTML tables.
 *
 * Extracted from: TableExtractor.ts (lines 1-88)
 */

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';

// Re-export cheerio types for convenience
export type { CheerioAPI, Cheerio };

/**
 * Element type alias for DOM nodes
 */
export type Element = AnyNode;

// ============================================================================
// Volume and Chapter Types
// ============================================================================

/**
 * Information about a manga volume including metadata and chapters
 */
export interface VolumeInfo {
  /** The volume number */
  volumeNumber: number;
  /** English title of the volume */
  title?: string;
  /** Japanese title of the volume */
  japaneseTitle?: string;
  /** URL to the cover image */
  coverImage?: string;
  /** English ISBN */
  isbn?: string;
  /** Japanese ISBN */
  japaneseIsbn?: string;
  /** English release date */
  releaseDate?: string;
  /** Japanese release date */
  japaneseReleaseDate?: string;
  /** Total page count */
  pageCount?: number;
  /** Chapters contained in this volume */
  chapters: ChapterInfo[];
  /** Volume price */
  price?: string;
  /** Range of chapters (e.g., "1-10") */
  chapterRange?: string;
  /** Additional metadata */
  additionalInfo?: Record<string, unknown>;
}

/**
 * Information about a single chapter
 */
export interface ChapterInfo {
  /** The chapter number (string to handle special chapters like "0.5") */
  chapterNumber: string;
  /** English title */
  title?: string;
  /** Japanese title */
  japaneseTitle?: string;
  /** Volume containing this chapter */
  volumeNumber?: number;
  /** Release date */
  releaseDate?: string;
  /** Page count */
  pageCount?: number;
  /** URL to chapter page */
  url?: string;
  /** Name of the story arc */
  arcName?: string;
}

/**
 * Information about a story arc containing multiple chapters
 */
export interface StoryArc {
  /** Arc name */
  name: string;
  /** Japanese arc name */
  japaneseName?: string;
  /** First chapter in the arc */
  startChapter?: string;
  /** Last chapter in the arc */
  endChapter?: string;
  /** Volume range (e.g., "1-5") */
  volumeRange?: string;
  /** Chapters in this arc */
  chapters: ChapterInfo[];
  /** Arc description */
  description?: string;
}

// ============================================================================
// Table Data Types
// ============================================================================

/**
 * Extracted table data with type information and parsed content
 */
export interface TableData {
  /** Type of table content */
  type: 'volume' | 'chapter' | 'arc' | 'mixed' | 'gallery' | 'generic';
  /** Extracted volume information */
  volumes?: VolumeInfo[];
  /** Extracted chapter information */
  chapters?: ChapterInfo[];
  /** Extracted story arc information */
  arcs?: StoryArc[];
  /** Pattern used for extraction */
  pattern?: string;
  /** Confidence score of extraction (0-1) */
  confidence?: number;
  /** Table headers */
  headers?: string[];
  /** Raw table rows */
  rows?: string[][];
  /** Generic extracted data for test compatibility */
  extractedData?: unknown;
  /** Information about merged cells */
  mergedCells?: Array<{ row: number; col: number; rowspan: number; colspan: number }>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Pattern definition for table type detection and extraction
 */
export interface TablePattern {
  /** Pattern identifier name */
  name: string;
  /** Function to detect if table matches this pattern */
  detect: ($: CheerioAPI, element: Element) => boolean;
  /** Function to extract data from table */
  extract: ($: CheerioAPI, element: Element, options: ExtractionOptions) => TableData | null;
  /** Priority for pattern matching (higher = checked first) */
  priority?: number;
}

/**
 * Options for table extraction behavior
 */
export interface ExtractionOptions {
  /** Handle rowspan attributes in tables */
  handleRowspan?: boolean;
  /** Follow links to get additional data */
  followLinks?: boolean;
  /** Maximum depth for nested extraction */
  maxDepth?: number;
  /** Include raw table data in output */
  includeRawData?: boolean;
  /** Merge related tables */
  mergeRelated?: boolean;

  // Extended options for tests
  /** Extract content from tabbed containers */
  extractTabbedContent?: boolean;
  /** Extract nested tables */
  extractNestedTables?: boolean;
  /** Maximum nesting depth for nested tables */
  maxNestingDepth?: number;
  /** Language preference for extraction */
  language?: string;
  /** Extract URLs from links */
  extractLinks?: boolean;
  /** Minimum rows required for valid table */
  minRows?: number;
  /** Base URL for resolving relative links */
  baseUrl?: string;
  /** Include image URLs in extraction */
  includeImages?: boolean;
  /** Clean extracted text (trim, normalize whitespace) */
  cleanText?: boolean;
}
