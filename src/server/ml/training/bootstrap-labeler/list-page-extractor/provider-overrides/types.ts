/**
 * List Page Extractor Provider Override Types
 *
 * Defines the interface for provider-specific list page extraction overrides.
 * These allow customization of volume/chapter detection logic for different
 * sources (Wikipedia, Fandom, ComicVine) without modifying global rules.
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

// ============================================================================
// Override Function Types
// ============================================================================

/**
 * Groups token indices by table row.
 * Used to handle nested tables (Wikipedia) where tableRow property is unreliable.
 *
 * @param tokens - All linearized tokens
 * @param tableId - The table identifier to filter tokens
 * @returns Map of row number → array of token indices
 */
export type GroupTokensByRowFn = (
  tokens: LinearizedToken[],
  tableId: string
) => Map<number, number[]>;

/**
 * Extracts the row number from a token's xpath.
 * Used when tableRow property is unreliable (e.g., Wikipedia nested tables).
 *
 * @param xpath - The token's xpath
 * @returns Row number or null if not parseable
 */
export type ParseRowFromXpathFn = (xpath: string) => number | null;

// ============================================================================
// Column Header Patterns
// ============================================================================

/**
 * Patterns for matching column headers to fields.
 * Each field can have multiple regex patterns.
 */
export interface ListPageColumnPatterns {
  /** ISBN column patterns (e.g., /isbn$/i for "Original ISBN") */
  isbn?: RegExp[];
  /** Release date patterns (e.g., /release.*date$/i) */
  releaseDate?: RegExp[];
  /** Volume number patterns (e.g., /^#$/, /^vol/i) */
  volumeNumber?: RegExp[];
  /** Chapter number patterns */
  chapterNumber?: RegExp[];
  /** Title patterns */
  title?: RegExp[];
  /** Cover patterns */
  cover?: RegExp[];
  /** Chapters column (for volume tables showing chapter ranges) */
  chapters?: RegExp[];
}

// ============================================================================
// Main Override Interface
// ============================================================================

/**
 * Provider-specific overrides for list page extraction.
 * All methods are optional - when undefined, the global logic is used.
 */
export interface ListPageOverrides {
  /**
   * Override for grouping tokens by table row.
   * Wikipedia uses xpath parsing instead of tableRow property.
   */
  groupTokensByRow?: GroupTokensByRowFn;

  /**
   * Override for parsing row number from xpath.
   * Used when tableRow property is unreliable.
   */
  parseRowFromXpath?: ParseRowFromXpathFn;

  /**
   * Custom column header patterns for this provider.
   * Used for mapping columns to volume/chapter fields.
   */
  columnPatterns?: ListPageColumnPatterns;

  /**
   * Whether to use xpath for row grouping instead of tableRow property.
   * Useful for Wikipedia nested tables where tableRow is unreliable.
   */
  useXpathForRowGrouping?: boolean;

  /**
   * Custom function to check if a header matches a pattern.
   * Allows provider-specific matching logic (e.g., end-of-string matching).
   */
  matchesColumnPattern?: (header: string, patterns: RegExp[]) => boolean;
}
