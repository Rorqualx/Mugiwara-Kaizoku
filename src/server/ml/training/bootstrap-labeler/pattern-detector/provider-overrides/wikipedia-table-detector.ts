/**
 * Wikipedia-Specific Table Header Detection
 *
 * Handles Wikipedia's unique table patterns:
 * 1. Nested tables: Uses full xpath path (table[1]/table[2])
 * 2. Multi-word headers: Concatenates tokens ("Original release date")
 * 3. Prefixed columns: Matches "Original ISBN", "English release date"
 */

import type { LinearizedToken, LinearizationResult } from '@/server/ml/features/dom-linearizer';
import { logger } from '@/utils/logger';

import { LABEL_TO_ENTITY } from '../label-mapping';
import { PATTERN_CONFIDENCE_BOOSTS, type PatternSignal } from '../types';

/** Source type alias */
type SourceType = LinearizationResult['sourceType'];

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Check if a token is in a table, using xpath as fallback.
 */
function isTokenInTable(token: LinearizedToken): boolean {
  if (token.isInTable) return true;
  // Fallback: check xpath for table/td/th patterns
  return /table\[\d+\]/.test(token.xpath) && /(?:td|th)\[\d+\]/.test(token.xpath);
}

/**
 * Check if a token is a table header, using xpath as fallback.
 */
function isTokenTableHeader(token: LinearizedToken): boolean {
  if (token.isTableHeader) return true;
  // Fallback: check xpath for th pattern
  return /th\[\d+\]/.test(token.xpath);
}

/**
 * Detect table header patterns with provider-specific overrides.
 * Handles Wikipedia's nested tables and multi-word headers.
 */
export function detectTableHeaderPatternsWithOverrides(
  tokens: LinearizedToken[],
  sourceType: SourceType
): PatternSignal[] {
  logger.info('[wikipedia-table] detectTableHeaderPatternsWithOverrides called', {
    sourceType,
    totalTokens: tokens.length,
  });

  // Debug: Log sample tokens to understand structure
  const sampleTableTokens = tokens.filter(t => t.isInTable).slice(0, 20);
  if (sampleTableTokens.length > 0) {
    logger.info('[wikipedia-table] Sample table tokens', {
      count: sampleTableTokens.length,
      samples: sampleTableTokens.map(t => ({
        text: t.text.substring(0, 30),
        xpath: t.xpath,
        isHeader: t.isTableHeader,
        col: t.tableCol,
        row: t.tableRow,
      })),
    });
  }

  const patterns: PatternSignal[] = [];

  // Use xpath-aware filtering for Wikipedia to handle nested tables better
  const tableTokens = sourceType === 'wikipedia'
    ? tokens.filter(isTokenInTable)
    : tokens.filter((t) => t.isInTable);

  if (tableTokens.length === 0) {
    logger.debug('[wikipedia-table] No table tokens found', { sourceType, totalTokens: tokens.length });
    return patterns;
  }

  // Log sample xpaths to understand the structure
  const sampleTokens = tableTokens.slice(0, 10);
  logger.debug('[wikipedia-table] Found table tokens', {
    count: tableTokens.length,
    sourceType,
    sampleXpaths: sampleTokens.map((t) => ({
      text: t.text.substring(0, 30),
      xpath: t.xpath,
      tableCol: t.tableCol,
      isHeader: t.isTableHeader,
      parsedCol: parseColFromXpath(t.xpath),
    })),
  });

  // Use Wikipedia-specific grouping for nested tables
  const byTable = sourceType === 'wikipedia'
    ? groupTokensByNestedTable(tableTokens)
    : groupTokensByTable(tableTokens);

  logger.debug('[wikipedia-table] Grouped by table', { tableCount: byTable.size });

  for (const [tableId, tableGroup] of byTable.entries()) {
    // Debug: Log column distribution for this table
    const colDistribution = new Map<number | null, number>();
    for (const t of tableGroup) {
      const col = parseColFromXpath(t.xpath);
      colDistribution.set(col, (colDistribution.get(col) ?? 0) + 1);
    }
    logger.debug('[wikipedia-table] Table column distribution', {
      tableId,
      tokenCount: tableGroup.length,
      distribution: Object.fromEntries(colDistribution) as Record<string, number>,
    });

    const groupPatterns = detectColumnBasedPatternsWithOverrides(tableGroup, tokens, sourceType);
    if (groupPatterns.length > 0) {
      logger.debug('[wikipedia-table] Patterns for table', {
        tableId,
        tokenCount: tableGroup.length,
        patternCount: groupPatterns.length,
        patterns: groupPatterns.map((p) => ({
          entityType: p.entityType,
          headerText: p.labelText,
          valueCount: p.valueTokenIndices.length,
        })),
      });
    }
    patterns.push(...groupPatterns);
  }

  // Summary logging
  if (patterns.length > 0) {
    const byEntityType = new Map<string, number>();
    for (const p of patterns) {
      const count = byEntityType.get(p.entityType ?? 'unknown') ?? 0;
      byEntityType.set(p.entityType ?? 'unknown', count + 1);
    }
    logger.info('[wikipedia-table] Pattern summary', {
      totalPatterns: patterns.length,
      byEntityType: Object.fromEntries(byEntityType),
      samplePatterns: patterns.slice(0, 5).map(p => ({
        entityType: p.entityType,
        source: p.source,
        indicesCount: p.valueTokenIndices.length,
        indicesRange: `${Math.min(...p.valueTokenIndices)}-${Math.max(...p.valueTokenIndices)}`,
      })),
    });
  }

  return patterns;
}

// ============================================================================
// Table Grouping Functions
// ============================================================================

/**
 * Group tokens by nested table path (for Wikipedia).
 * Extracts ALL table references to handle nested tables properly.
 */
function groupTokensByNestedTable(tokens: LinearizedToken[]): Map<string, LinearizedToken[]> {
  const groups = new Map<string, LinearizedToken[]>();

  for (const token of tokens) {
    const tableMatches = token.xpath.match(/table\[\d+\]/g);
    if (!tableMatches || tableMatches.length === 0) continue;

    // Join all table references to form the nested table ID
    const tableId = tableMatches.join('/');
    const existing = groups.get(tableId) ?? [];
    existing.push(token);
    groups.set(tableId, existing);
  }

  return groups;
}

/**
 * Standard table grouping (for non-Wikipedia sources).
 */
function groupTokensByTable(tokens: LinearizedToken[]): Map<string, LinearizedToken[]> {
  const groups = new Map<string, LinearizedToken[]>();

  for (const token of tokens) {
    const tableId = token.xpath.match(/\/table\[\d+\]/)?.[0] ?? 'default';
    const existing = groups.get(tableId) ?? [];
    existing.push(token);
    groups.set(tableId, existing);
  }

  return groups;
}

// ============================================================================
// Column Pattern Detection
// ============================================================================

/**
 * Detect column-based patterns with multi-word header support.
 */
function detectColumnBasedPatternsWithOverrides(
  tableGroup: LinearizedToken[],
  allTokens: LinearizedToken[],
  sourceType: SourceType
): PatternSignal[] {
  const patterns: PatternSignal[] = [];

  // Extract concatenated headers by column (use xpath-aware header detection for Wikipedia)
  const headersByCol = extractConcatenatedHeaders(tableGroup, sourceType);

  // Debug: Log all extracted headers
  const headerEntries = Array.from(headersByCol.entries());
  if (headerEntries.length > 0) {
    logger.debug('[wikipedia-table] Extracted headers', {
      headers: headerEntries.map(([col, text]) => ({ col, text, mapped: LABEL_TO_ENTITY[text] ?? 'unmapped' })),
    });
  }

  for (const [colIndex, headerText] of headersByCol) {
    // Create one pattern per cell (not per column) to avoid labeling gaps between cells
    const cellPatterns = createColumnPatternsFromConcatenatedHeader(
      headerText,
      colIndex,
      tableGroup,
      allTokens,
      sourceType
    );
    patterns.push(...cellPatterns);
  }

  return patterns;
}

/**
 * Parse column index from xpath when tableCol is not set.
 * Handles patterns like: /tr[1]/th[2] -> col 2, /tr[1]/td[3] -> col 3
 * Returns the LAST th[N] or td[N] occurrence in the xpath.
 */
function parseColFromXpath(xpath: string): number | null {
  // Find all th[N] or td[N] occurrences
  const matches = xpath.match(/(?:th|td)\[(\d+)\]/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  // Get the last match (innermost cell in nested tables)
  const lastMatch = matches[matches.length - 1];
  const numMatch = lastMatch?.match(/\[(\d+)\]/);
  if (numMatch?.[1]) {
    return parseInt(numMatch[1], 10);
  }
  return null;
}

/**
 * Get column index from token.
 * For Wikipedia, ALWAYS use xpath parsing as tableCol may be incorrect for nested tables.
 */
function getColumnIndex(token: LinearizedToken, forceXpath: boolean = false): number | null {
  // For Wikipedia nested tables, always parse from xpath
  if (forceXpath) {
    return parseColFromXpath(token.xpath);
  }
  // Use tableCol if available
  if (token.tableCol !== null) {
    return token.tableCol;
  }
  // Fallback: parse from xpath
  return parseColFromXpath(token.xpath);
}

/**
 * Extract headers concatenating all tokens in the same column.
 * This handles multi-word headers like "Original release date".
 * Uses xpath-based column detection as fallback for nested tables.
 */
function extractConcatenatedHeaders(tableGroup: LinearizedToken[], sourceType: SourceType): Map<number, string> {
  const headersByCol = new Map<number, string[]>();
  const forceXpath = sourceType === 'wikipedia';

  for (const token of tableGroup) {
    // Use xpath-aware header detection for Wikipedia
    const isHeader = sourceType === 'wikipedia' ? isTokenTableHeader(token) : token.isTableHeader;
    if (!isHeader) continue;

    const colIndex = getColumnIndex(token, forceXpath);
    if (colIndex === null) {
      logger.debug('[wikipedia-table] Header token has no column index', {
        text: token.text,
        xpath: token.xpath,
        tableCol: token.tableCol,
      });
      continue;
    }

    const existing = headersByCol.get(colIndex) ?? [];
    existing.push(token.text.trim());
    headersByCol.set(colIndex, existing);
  }

  // Concatenate header tokens per column
  const result = new Map<number, string>();
  for (const [col, texts] of headersByCol) {
    result.set(col, texts.join(' ').trim().toLowerCase());
  }

  return result;
}

/**
 * Parse row index from xpath.
 * Returns the LAST tr[N] occurrence in the xpath.
 */
function parseRowFromXpath(xpath: string): number | null {
  const matches = xpath.match(/tr\[(\d+)\]/g);
  if (!matches || matches.length === 0) {
    return null;
  }
  const lastMatch = matches[matches.length - 1];
  const numMatch = lastMatch?.match(/\[(\d+)\]/);
  if (numMatch?.[1]) {
    return parseInt(numMatch[1], 10);
  }
  return null;
}

/**
 * Create pattern signals from a concatenated header - ONE PATTERN PER CELL.
 * This is crucial because the propagation creates one span from min to max indices,
 * so we need separate patterns to avoid labeling everything between cells.
 */
function createColumnPatternsFromConcatenatedHeader(
  headerText: string,
  colIndex: number,
  tableGroup: LinearizedToken[],
  allTokens: LinearizedToken[],
  sourceType: SourceType
): PatternSignal[] {
  const entityType = LABEL_TO_ENTITY[headerText] ?? null;
  if (!entityType) return [];

  const forceXpath = sourceType === 'wikipedia';
  const patterns: PatternSignal[] = [];

  // Find value cells in this column using the same column detection logic
  const valueCells = tableGroup.filter((t) => {
    // Use xpath-aware header detection for Wikipedia to exclude headers
    const isHeader = sourceType === 'wikipedia' ? isTokenTableHeader(t) : t.isTableHeader;
    if (isHeader) return false;
    const tokenCol = getColumnIndex(t, forceXpath);
    return tokenCol === colIndex;
  });

  if (valueCells.length === 0) {
    logger.debug('[wikipedia-table] No value cells found for column', {
      headerText,
      colIndex,
      entityType,
      tableGroupSize: tableGroup.length,
    });
    return [];
  }

  // Group value cells by row - each row gets its own pattern
  const cellsByRow = new Map<number, LinearizedToken[]>();
  for (const cell of valueCells) {
    const rowIndex = forceXpath ? parseRowFromXpath(cell.xpath) : cell.tableRow;
    if (rowIndex === null) continue;

    const existing = cellsByRow.get(rowIndex) ?? [];
    existing.push(cell);
    cellsByRow.set(rowIndex, existing);
  }

  // Create one pattern per row (cell)
  for (const [rowIndex, rowCells] of cellsByRow.entries()) {
    const valueIndices = rowCells.map((t) => allTokens.indexOf(t)).filter((idx) => idx >= 0);
    if (valueIndices.length === 0) continue;

    // Debug: Log each pattern creation
    logger.debug('[wikipedia-table] Creating cell pattern', {
      headerText,
      entityType,
      colIndex,
      rowIndex,
      valueIndicesCount: valueIndices.length,
      valueIndicesRange: valueIndices.length > 0 ? `${Math.min(...valueIndices)}-${Math.max(...valueIndices)}` : 'none',
    });

    patterns.push({
      type: 'table_header_value',
      labelText: headerText,
      entityType,
      valueTokenIndices: valueIndices,
      confidence: PATTERN_CONFIDENCE_BOOSTS.table_header_value,
      source: `table_header_concat:${headerText}:col${colIndex}:row${rowIndex}`,
    });
  }

  logger.debug('[wikipedia-table] Created cell patterns', {
    headerText,
    colIndex,
    entityType,
    cellCount: patterns.length,
  });

  return patterns;
}
