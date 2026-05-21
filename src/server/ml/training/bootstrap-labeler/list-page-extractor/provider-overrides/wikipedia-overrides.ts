/**
 * Wikipedia List Page Extractor Overrides
 *
 * Handles Wikipedia-specific extraction patterns:
 * 1. Row grouping: Parses xpath for tr[N] instead of using tableRow property
 * 2. Column patterns: Uses relaxed patterns for "Original ISBN", "English release date"
 * 3. Nested tables: Handles Wikipedia's nested table structures
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import type { ListPageOverrides, ListPageColumnPatterns } from './types';

// ============================================================================
// Wikipedia Column Patterns
// ============================================================================

/**
 * Wikipedia uses more flexible patterns that match at the end of headers.
 * This handles prefixed headers like "Original ISBN", "English release date".
 */
const WIKIPEDIA_COLUMN_PATTERNS: ListPageColumnPatterns = {
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
// Wikipedia Row Parsing
// ============================================================================

/**
 * Parse row number from xpath.
 * Extracts the LAST tr[N] value, which is the actual row in nested tables.
 *
 * Example: "//table[1]/tbody/tr[1]/td/table[2]/tbody/tr[3]/td[1]"
 * Returns: 3 (the innermost tr)
 */
function wikipediaParseRowFromXpath(xpath: string): number | null {
  // Find all tr[N] matches
  const rowMatches = xpath.match(/tr\[(\d+)\]/g);
  if (!rowMatches || rowMatches.length === 0) return null;

  // Get the LAST tr match (innermost in nested tables)
  const lastMatch = rowMatches[rowMatches.length - 1];
  if (!lastMatch) return null;

  const numMatch = lastMatch.match(/\d+/);
  if (!numMatch) return null;

  return parseInt(numMatch[0], 10);
}

/**
 * Get the nested table identifier from xpath.
 * Used to ensure we're grouping tokens from the same nested table.
 */
function getNestedTableId(xpath: string): string | null {
  const tableMatches = xpath.match(/table\[\d+\]/g);
  if (!tableMatches || tableMatches.length === 0) return null;

  // Join all table references to form the nested table ID
  return tableMatches.join('/');
}

/**
 * Wikipedia override for grouping tokens by table row.
 * Uses xpath parsing instead of tableRow property, which is unreliable
 * for nested tables.
 */
function wikipediaGroupTokensByRow(
  tokens: LinearizedToken[],
  tableId: string
): Map<number, number[]> {
  const rowTokens = new Map<number, number[]>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token?.isInTable) continue;

    // Check if token belongs to this table
    // For nested tables, tableId is like "table[1]/table[2]"
    const tokenTableId = getNestedTableId(token.xpath);
    if (tokenTableId !== tableId) continue;

    // Parse row from xpath instead of using tableRow property
    const rowNum = wikipediaParseRowFromXpath(token.xpath);
    if (rowNum === null) continue;

    const existing = rowTokens.get(rowNum) ?? [];
    existing.push(i);
    rowTokens.set(rowNum, existing);
  }

  return rowTokens;
}

// ============================================================================
// Wikipedia Column Matching
// ============================================================================

/**
 * Custom pattern matching for Wikipedia headers.
 * Checks if any pattern matches the header.
 */
function wikipediaMatchesColumnPattern(header: string, patterns: RegExp[]): boolean {
  const normalized = header.trim().toLowerCase();

  for (const pattern of patterns) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Export Wikipedia Overrides
// ============================================================================

/**
 * Wikipedia-specific list page extraction overrides.
 */
export const WIKIPEDIA_LIST_PAGE_OVERRIDES: ListPageOverrides = {
  groupTokensByRow: wikipediaGroupTokensByRow,
  parseRowFromXpath: wikipediaParseRowFromXpath,
  columnPatterns: WIKIPEDIA_COLUMN_PATTERNS,
  useXpathForRowGrouping: true,
  matchesColumnPattern: wikipediaMatchesColumnPattern,
};
