/**
 * Wikipedia Table Analyzer Overrides
 *
 * Handles Wikipedia-specific table patterns:
 * 1. Nested tables: Uses innermost table from xpath (table[1]/table[2] → table[2])
 * 2. Multi-word headers: Concatenates all tokens in same column ("Original release date")
 * 3. Relaxed column patterns: Matches "Original ISBN", "English ISBN", etc.
 */

import type { EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';

import type { ColumnClassification } from '../column-classifiers';
import type { TableAnalyzerOverrides, ColumnHeaderPatterns } from './types';

// ============================================================================
// Wikipedia Column Header Patterns
// ============================================================================

/**
 * Wikipedia uses more flexible patterns that match at the end of headers.
 * This handles prefixed headers like "Original ISBN", "English release date".
 */
const WIKIPEDIA_COLUMN_PATTERNS: ColumnHeaderPatterns = {
  // ISBN patterns - matches "ISBN", "Original ISBN", "English ISBN"
  isbn: [/isbn$/i, /^isbn$/i],

  // Release date - matches "Release date", "Original release date", "Date"
  releaseDate: [/release.*date$/i, /^release$/i, /^date$/i, /^published$/i],

  // Volume number - matches "#", "No.", "Vol.", "Volume"
  volumeNumber: [/^#$/, /^no\.?$/i, /^vol(?:ume)?\.?$/i],

  // Chapter number - matches "#", "No.", "Ch.", "Chapter"
  chapterNumber: [/^#$/, /^no\.?$/i, /^ch(?:apter)?\.?$/i],

  // Title - matches "Title", "Name"
  title: [/^title$/i, /^name$/i],

  // Cover - matches "Cover"
  cover: [/^cover$/i],

  // Chapters column (in volume tables)
  chapters: [/^chapters?$/i],
};

// ============================================================================
// Wikipedia Table Grouping
// ============================================================================

/**
 * Parse all table references from xpath and return the full nested path.
 * For nested tables, uses ALL table references to create unique ID.
 *
 * Example: "//table[1]/tbody/tr/td/table[2]/tbody/tr[3]/td[1]"
 * Returns: "table[1]/table[2]" (the full nesting path)
 *
 * This ensures nested tables are treated as separate from their parents.
 */
function getNestedTableId(xpath: string): string | null {
  const tableMatches = xpath.match(/table\[\d+\]/g);
  if (!tableMatches || tableMatches.length === 0) return null;

  // Join all table references to form the nested table ID
  // This creates unique IDs like "table[1]/table[2]" for nested tables
  return tableMatches.join('/');
}

/**
 * Wikipedia override for grouping tokens by table.
 * Handles nested tables by using the full xpath path to identify tables.
 */
function wikipediaGroupTokensByTable(
  tokens: LinearizedToken[]
): Map<string, LinearizedToken[]> {
  const tables = new Map<string, LinearizedToken[]>();

  for (const token of tokens) {
    if (!token.isInTable) continue;

    const tableId = getNestedTableId(token.xpath);
    if (!tableId) continue;

    const existing = tables.get(tableId) ?? [];
    existing.push(token);
    tables.set(tableId, existing);
  }

  return tables;
}

// ============================================================================
// Wikipedia Header Extraction
// ============================================================================

/**
 * Wikipedia override for extracting table headers.
 * Concatenates ALL header tokens in the same column to preserve
 * multi-word headers like "Original release date".
 */
function wikipediaExtractTableHeaders(tokens: LinearizedToken[]): string[] {
  // Group header tokens by column index
  const headersByCol = new Map<number, string[]>();

  for (const token of tokens) {
    if (!token.isTableHeader || token.tableCol === null) continue;

    const existing = headersByCol.get(token.tableCol) ?? [];
    existing.push(token.text.trim());
    headersByCol.set(token.tableCol, existing);
  }

  // Find max column index to size the array correctly
  let maxCol = -1;
  for (const col of headersByCol.keys()) {
    if (col > maxCol) maxCol = col;
  }

  // Build header array, concatenating multi-word headers
  const headers: string[] = [];
  for (let col = 0; col <= maxCol; col++) {
    const texts = headersByCol.get(col);
    if (texts && texts.length > 0) {
      // Join all tokens in this column with space
      headers[col] = texts.join(' ').trim();
    }
  }

  return headers.filter(Boolean);
}

// ============================================================================
// Wikipedia Column Classification
// ============================================================================

interface HeaderPattern {
  pattern: RegExp;
  entityType: EntityType;
  confidence: number;
}

/**
 * Build pattern list from Wikipedia patterns for a table type.
 */
function buildWikipediaPatterns(tableType: 'chapter' | 'volume'): HeaderPattern[] {
  const patterns: HeaderPattern[] = [];

  if (tableType === 'volume') {
    // Volume-specific patterns
    for (const p of WIKIPEDIA_COLUMN_PATTERNS.volumeNumber ?? []) {
      patterns.push({ pattern: p, entityType: 'VOLUME_COUNT', confidence: 0.9 });
    }
    for (const p of WIKIPEDIA_COLUMN_PATTERNS.title ?? []) {
      patterns.push({ pattern: p, entityType: 'VOLUME_TITLE', confidence: 0.8 });
    }
    for (const p of WIKIPEDIA_COLUMN_PATTERNS.releaseDate ?? []) {
      patterns.push({ pattern: p, entityType: 'VOLUME_RELEASE_DATE', confidence: 0.9 });
    }
    for (const p of WIKIPEDIA_COLUMN_PATTERNS.isbn ?? []) {
      patterns.push({ pattern: p, entityType: 'ISBN', confidence: 0.95 });
    }
    for (const p of WIKIPEDIA_COLUMN_PATTERNS.chapters ?? []) {
      patterns.push({ pattern: p, entityType: 'CHAPTER_RANGE', confidence: 0.8 });
    }
    for (const p of WIKIPEDIA_COLUMN_PATTERNS.cover ?? []) {
      patterns.push({ pattern: p, entityType: 'VOLUME_COVER', confidence: 0.9 });
    }
  } else {
    // Chapter-specific patterns
    for (const p of WIKIPEDIA_COLUMN_PATTERNS.chapterNumber ?? []) {
      patterns.push({ pattern: p, entityType: 'CHAPTER_COUNT', confidence: 0.9 });
    }
    for (const p of WIKIPEDIA_COLUMN_PATTERNS.title ?? []) {
      patterns.push({ pattern: p, entityType: 'CHAPTER_TITLE', confidence: 0.8 });
    }
    for (const p of WIKIPEDIA_COLUMN_PATTERNS.releaseDate ?? []) {
      patterns.push({ pattern: p, entityType: 'CHAPTER_RELEASE_DATE', confidence: 0.9 });
    }
  }

  return patterns;
}

/**
 * Wikipedia override for classifying columns by header.
 * Uses relaxed patterns that match at the end of headers.
 */
function wikipediaClassifyColumnByHeader(
  headerText: string,
  tableType: 'chapter' | 'volume'
): ColumnClassification {
  const patterns = buildWikipediaPatterns(tableType);
  const normalized = headerText.trim().toLowerCase();

  for (const { pattern, entityType, confidence } of patterns) {
    if (pattern.test(normalized)) {
      return { entityType, confidence };
    }
  }

  return { entityType: null, confidence: 0 };
}

/**
 * Wikipedia override for full column classification with sample values.
 */
function wikipediaClassifyColumn(
  headerText: string,
  sampleValues: string[],
  tableType: 'chapter' | 'volume'
): ColumnClassification {
  const headerClassification = wikipediaClassifyColumnByHeader(headerText, tableType);

  if (!headerClassification.entityType) {
    return { entityType: null, confidence: 0 };
  }

  // Validate with sample values (same logic as global)
  const valueConfidence = validateColumnTypeWithValues(
    headerClassification.entityType,
    sampleValues
  );

  // Combine header and value confidence
  const finalConfidence = headerClassification.confidence * 0.6 + valueConfidence * 0.4;

  return {
    entityType: headerClassification.entityType,
    confidence: finalConfidence,
  };
}

/**
 * Validate column type with sample values.
 * Returns adjusted confidence based on value patterns.
 */
function validateColumnTypeWithValues(
  inferredType: EntityType,
  sampleValues: string[]
): number {
  if (sampleValues.length === 0) return 0.5;

  let matchingValues = 0;

  for (const value of sampleValues) {
    const trimmed = value.trim();
    if (isValueMatchingType(trimmed, inferredType)) {
      matchingValues++;
    }
  }

  const matchRatio = matchingValues / sampleValues.length;
  // Adjust confidence: full match = 1.0, no match = 0.3
  return 0.3 + matchRatio * 0.7;
}

/** Value patterns for validation */
const VALUE_PATTERNS = {
  isNumeric: /^\d+$/,
  isDate: /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
  isChapterNumber: /^(?:Ch\.?\s*)?\d+(?:\.\d+)?$/i,
  isVolumeNumber: /^(?:Vol\.?\s*)?\d+$/i,
  isISBN: /^\d{10}|\d{13}|[\dX-]+$/i,
};

/**
 * Check if a value matches the expected pattern for an entity type.
 */
function isValueMatchingType(value: string, entityType: EntityType): boolean {
  switch (entityType) {
    case 'CHAPTER_COUNT':
    case 'VOLUME_COUNT':
      return VALUE_PATTERNS.isNumeric.test(value) || VALUE_PATTERNS.isChapterNumber.test(value);

    case 'CHAPTER_RELEASE_DATE':
    case 'VOLUME_RELEASE_DATE':
    case 'RELEASE_DATE':
      return VALUE_PATTERNS.isDate.test(value);

    case 'ISBN':
      return VALUE_PATTERNS.isISBN.test(value);

    case 'CHAPTER_TITLE':
    case 'VOLUME_TITLE':
      // Titles are text - check not empty and not purely numeric
      return value.length > 0 && !VALUE_PATTERNS.isNumeric.test(value);

    default:
      return true; // Allow any value for other types
  }
}

// ============================================================================
// Export Wikipedia Overrides
// ============================================================================

/**
 * Wikipedia-specific table analyzer overrides.
 */
export const WIKIPEDIA_TABLE_OVERRIDES: TableAnalyzerOverrides = {
  groupTokensByTable: wikipediaGroupTokensByTable,
  extractTableHeaders: wikipediaExtractTableHeaders,
  classifyColumn: wikipediaClassifyColumn,
  classifyColumnByHeader: wikipediaClassifyColumnByHeader,
  columnHeaderPatterns: WIKIPEDIA_COLUMN_PATTERNS,
  useXpathForRowGrouping: true,
};
