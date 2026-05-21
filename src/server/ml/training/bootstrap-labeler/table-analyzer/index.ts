/**
 * Table Structure Analyzer
 *
 * Detects chapter/volume tables and classifies columns by type.
 * Supports provider-specific overrides for Wikipedia, Fandom, etc.
 */

import type { EntityType, LinearizedToken, LinearizationResult } from '@/server/ml/features/dom-linearizer';

import { classifyColumn } from './column-classifiers';
import { getTableAnalyzerOverrides } from './provider-overrides';
import { detectTableType, isDataTable } from './table-detector';

import type { TableAnalyzerOverrides } from './provider-overrides/types';
import type { TableType } from './table-detector';
import type { PatternSignal } from '../pattern-detector/types';

/** Source type alias from LinearizationResult */
type SourceType = LinearizationResult['sourceType'];

export interface TableAnalysis {
  tableId: string;
  tableType: TableType;
  confidence: number;
  columns: ColumnAnalysis[];
  rowCount: number;
  xpath: string;
}

export interface ColumnAnalysis {
  index: number;
  headerText: string;
  inferredType: EntityType | null;
  sampleValues: string[];
  confidence: number;
}

/**
 * Group tokens by their table membership
 */
function groupTokensByTable(tokens: LinearizedToken[]): Map<string, LinearizedToken[]> {
  const tables = new Map<string, LinearizedToken[]>();

  for (const token of tokens) {
    if (!token.isInTable) continue;

    const tableMatch = token.xpath.match(/table\[\d+\]/);
    if (!tableMatch) continue;

    const tableId = tableMatch[0];
    const existing = tables.get(tableId) ?? [];
    existing.push(token);
    tables.set(tableId, existing);
  }

  return tables;
}

/**
 * Extract headers from table tokens
 */
function extractTableHeaders(tokens: LinearizedToken[]): string[] {
  const headers: string[] = [];
  const seenCols = new Set<number>();

  for (const token of tokens) {
    if (!token.isTableHeader || token.tableCol === null) continue;
    if (seenCols.has(token.tableCol)) continue;

    seenCols.add(token.tableCol);
    headers[token.tableCol] = token.text;
  }

  return headers.filter(Boolean);
}

/**
 * Get sample values for each column
 */
function getSampleValuesByColumn(
  tokens: LinearizedToken[],
  maxSamples: number = 5
): Map<number, string[]> {
  const samples = new Map<number, string[]>();

  for (const token of tokens) {
    if (token.isTableHeader || token.tableCol === null) continue;

    const existing = samples.get(token.tableCol) ?? [];
    if (existing.length < maxSamples) {
      existing.push(token.text);
      samples.set(token.tableCol, existing);
    }
  }

  return samples;
}

/**
 * Analyze a single table with provider-specific overrides
 */
function analyzeTableWithOverrides(
  tableId: string,
  tokens: LinearizedToken[],
  overrides: TableAnalyzerOverrides | undefined
): TableAnalysis | null {
  // Use override or global header extraction
  const extractHeadersFn = overrides?.extractTableHeaders ?? extractTableHeaders;
  const headers = extractHeadersFn(tokens);

  if (!isDataTable(headers)) {
    return null;
  }

  const xpath = tokens[0]?.xpath ?? '';
  const typeResult = detectTableType(headers, xpath);
  if (typeResult.type === 'unknown') {
    return null;
  }

  const samplesByColumn = getSampleValuesByColumn(tokens);
  const tableTypeForClassification = typeResult.type === 'chapter_list' ? 'chapter' : 'volume';

  // Use override or global column classification
  const columns = classifyTableColumnsWithOverrides(
    headers,
    samplesByColumn,
    tableTypeForClassification,
    overrides
  );

  // Use override-aware row counting
  const rowCount = overrides?.useXpathForRowGrouping
    ? countUniqueRowsFromXpath(tokens)
    : countUniqueRows(tokens);

  return {
    tableId,
    tableType: typeResult.type,
    confidence: typeResult.confidence,
    columns,
    rowCount,
    xpath,
  };
}

/**
 * Classify all columns in a table with provider-specific overrides
 */
function classifyTableColumnsWithOverrides(
  headers: string[],
  samplesByColumn: Map<number, string[]>,
  tableType: 'chapter' | 'volume',
  overrides: TableAnalyzerOverrides | undefined
): ColumnAnalysis[] {
  const columns: ColumnAnalysis[] = [];

  // Use override or global classification function
  const classifyFn = overrides?.classifyColumn ?? classifyColumn;

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!header) continue;

    const samples = samplesByColumn.get(i) ?? [];
    const classification = classifyFn(header, samples, tableType);

    columns.push({
      index: i,
      headerText: header,
      inferredType: classification.entityType,
      sampleValues: samples,
      confidence: classification.confidence,
    });
  }

  return columns;
}

/**
 * Count unique rows using xpath parsing (for nested tables)
 */
function countUniqueRowsFromXpath(tokens: LinearizedToken[]): number {
  const rowNumbers = new Set<number>();

  for (const token of tokens) {
    // Parse row from xpath
    const rowMatch = token.xpath.match(/tr\[(\d+)\]/g);
    if (rowMatch && rowMatch.length > 0) {
      // Use last match for nested tables
      const lastMatch = rowMatch[rowMatch.length - 1];
      const numMatch = lastMatch?.match(/\d+/);
      if (numMatch) {
        rowNumbers.add(parseInt(numMatch[0], 10));
      }
    }
  }

  return rowNumbers.size;
}

/**
 * Count unique rows in table tokens
 */
function countUniqueRows(tokens: LinearizedToken[]): number {
  const rowNumbers = new Set<number>();
  for (const token of tokens) {
    if (token.tableRow !== null) {
      rowNumbers.add(token.tableRow);
    }
  }
  return rowNumbers.size;
}

/**
 * Analyze all tables in a token stream
 *
 * @param tokens - Linearized tokens from the page
 * @param sourceType - Source type for provider-specific overrides (optional, defaults to 'unknown')
 * @returns Array of table analyses
 */
export function analyzeTablesInTokens(
  tokens: LinearizedToken[],
  sourceType: SourceType = 'unknown'
): TableAnalysis[] {
  const overrides = getTableAnalyzerOverrides(sourceType);

  // Use override or fallback to global grouping function
  const groupFn = overrides?.groupTokensByTable ?? groupTokensByTable;
  const tableGroups = groupFn(tokens);

  const analyses: TableAnalysis[] = [];

  for (const [tableId, tableTokens] of tableGroups) {
    const analysis = analyzeTableWithOverrides(tableId, tableTokens, overrides);
    if (analysis) {
      analyses.push(analysis);
    }
  }

  return analyses;
}

/**
 * Find token indices for a specific column in a table
 */
function findColumnValueIndices(
  tokens: LinearizedToken[],
  tableId: string,
  columnIndex: number
): number[] {
  const indices: number[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    if (!token.isInTable || token.isTableHeader) continue;
    if (token.tableCol !== columnIndex) continue;
    if (!token.xpath.includes(tableId)) continue;

    indices.push(i);
  }

  return indices;
}

/**
 * Convert table analyses to pattern signals for the labeler
 */
export function tableAnalysesToPatterns(
  analyses: TableAnalysis[],
  tokens: LinearizedToken[]
): PatternSignal[] {
  const patterns: PatternSignal[] = [];

  for (const analysis of analyses) {
    const columnPatterns = convertColumnsToPatterns(analysis, tokens);
    patterns.push(...columnPatterns);
  }

  return patterns;
}

/**
 * Convert columns of a single table analysis to pattern signals
 */
function convertColumnsToPatterns(
  analysis: TableAnalysis,
  tokens: LinearizedToken[]
): PatternSignal[] {
  const patterns: PatternSignal[] = [];

  for (const column of analysis.columns) {
    if (!column.inferredType) continue;

    const valueIndices = findColumnValueIndices(tokens, analysis.tableId, column.index);

    if (valueIndices.length > 0) {
      patterns.push({
        type: 'table_header_value',
        labelText: column.headerText.toLowerCase(),
        entityType: column.inferredType,
        valueTokenIndices: valueIndices,
        confidence: column.confidence * 0.15,
        source: `table_column:${analysis.tableId}:${column.index}`,
      });
    }
  }

  return patterns;
}

export { detectTableType, isDataTable } from './table-detector';
export { classifyColumn, classifyColumnByHeader } from './column-classifiers';
