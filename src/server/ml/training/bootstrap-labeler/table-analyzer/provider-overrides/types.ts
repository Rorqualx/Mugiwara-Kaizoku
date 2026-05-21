/**
 * Table Analyzer Provider Override Types
 *
 * Defines the interface for provider-specific table analysis overrides.
 * These allow customization of table detection logic for different sources
 * (Wikipedia, Fandom, ComicVine) without modifying global rules.
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import type { ColumnClassification } from '../column-classifiers';

// ============================================================================
// Override Function Types
// ============================================================================

/**
 * Groups tokens by table, returning a Map of tableId → tokens.
 * Used to handle nested tables (Wikipedia) differently from flat tables.
 */
export type GroupTokensByTableFn = (tokens: LinearizedToken[]) => Map<string, LinearizedToken[]>;

/**
 * Extracts headers from table tokens.
 * Wikipedia needs to concatenate multi-word headers like "Original release date".
 */
export type ExtractTableHeadersFn = (tokens: LinearizedToken[]) => string[];

/**
 * Classifies a column based on header text and sample values.
 * Wikipedia uses relaxed patterns for "Original ISBN", "English ISBN", etc.
 */
export type ClassifyColumnFn = (
  headerText: string,
  sampleValues: string[],
  tableType: 'chapter' | 'volume'
) => ColumnClassification;

/**
 * Classifies a column by header text only (no sample values).
 * Used for quick header-based classification.
 */
export type ClassifyColumnByHeaderFn = (
  headerText: string,
  tableType: 'chapter' | 'volume'
) => ColumnClassification;

// ============================================================================
// Column Header Patterns
// ============================================================================

/**
 * Patterns for matching column headers to entity types.
 * Each entity type can have multiple regex patterns.
 */
export interface ColumnHeaderPatterns {
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
 * Provider-specific overrides for table analysis.
 * All methods are optional - when undefined, the global logic is used.
 */
export interface TableAnalyzerOverrides {
  /**
   * Override for grouping tokens by table.
   * Wikipedia uses innermost table from xpath for nested tables.
   */
  groupTokensByTable?: GroupTokensByTableFn;

  /**
   * Override for extracting table headers.
   * Wikipedia concatenates all header tokens in the same column.
   */
  extractTableHeaders?: ExtractTableHeadersFn;

  /**
   * Override for column classification with samples.
   */
  classifyColumn?: ClassifyColumnFn;

  /**
   * Override for header-only column classification.
   */
  classifyColumnByHeader?: ClassifyColumnByHeaderFn;

  /**
   * Custom column header patterns for this provider.
   * Merged with global patterns (provider patterns take precedence).
   */
  columnHeaderPatterns?: ColumnHeaderPatterns;

  /**
   * Minimum number of data rows to consider a table as valid.
   * Default is 2.
   */
  minDataRows?: number;

  /**
   * Whether to use xpath for row grouping instead of tableRow property.
   * Useful for Wikipedia nested tables where tableRow is unreliable.
   */
  useXpathForRowGrouping?: boolean;
}
