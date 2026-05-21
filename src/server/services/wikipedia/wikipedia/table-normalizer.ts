/**
 * Wikipedia/Fandom Volume Table Normalizer
 *
 * Parses HTML volume tables (handling rowspan/colspan) into structured
 * volume data. Works with both Wikipedia and Fandom table formats.
 *
 * Uses cheerio for server-side HTML parsing without DOM dependencies.
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';

const log = logger.child('TableNormalizer');

// ============================================================================
// Types
// ============================================================================

/** Structured volume data extracted from a table */
export interface NormalizedVolumeRow {
  number: number;
  title: string | null;
  chapterRange: string | null;
  chapterStart: number | null;
  chapterEnd: number | null;
  releaseDate: string | null;
  isbn: string | null;
}

/** Result of table normalization with confidence score */
export interface NormalizedVolumeTable {
  volumes: NormalizedVolumeRow[];
  confidence: number;
}

/** Column semantics detected from header text */
interface ColumnMapping {
  volumeCol: number | null;
  chapterCol: number | null;
  titleCol: number | null;
  releaseDateCol: number | null;
  isbnCol: number | null;
}

/** Rowspan tracking entry */
interface SpanEntry {
  text: string;
  remaining: number;
}

// ============================================================================
// Header Keyword Patterns
// ============================================================================

const VOLUME_KEYWORDS = /^(no\.?|vol\.?|volume|#)\s*$/i;
const CHAPTER_KEYWORDS = /chapter|chapters/i;
const TITLE_KEYWORDS = /^title$/i;
const DATE_KEYWORDS = /release|date|published/i;
const ISBN_KEYWORDS = /isbn/i;

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Extract structured volume data from HTML containing volume tables.
 *
 * Finds tables with volume/chapter headers, normalizes rowspan/colspan,
 * detects column semantics, and parses chapter ranges.
 */
export function normalizeVolumeTable(html: string): NormalizedVolumeTable {
  const $ = cheerio.load(html);
  const tables = $('table');
  if (tables.length === 0) return { volumes: [], confidence: 0 };

  // Find the best volume table
  let bestResult: NormalizedVolumeTable = { volumes: [], confidence: 0 };

  tables.each((_, table) => {
    const result = processTable($, $(table));
    if (result.volumes.length > bestResult.volumes.length) {
      bestResult = result;
    }
  });

  if (bestResult.volumes.length > 0) {
    log.info('Normalized volume table', {
      volumeCount: bestResult.volumes.length,
      confidence: bestResult.confidence,
    });
  }

  return bestResult;
}

// ============================================================================
// Table Processing
// ============================================================================

/** Process a single table element into normalized volume data */
function processTable(
  $: CheerioAPI,
  table: Cheerio<AnyNode>,
): NormalizedVolumeTable {
  const rows = table.find('tr');
  if (rows.length < 2) return { volumes: [], confidence: 0 };

  // Build normalized matrix (handles rowspan/colspan)
  const matrix = buildNormalizedMatrix($, rows);
  if (matrix.length < 2) return { volumes: [], confidence: 0 };

  const headerRow = matrix[0];
  if (!headerRow) return { volumes: [], confidence: 0 };
  const mapping = detectColumnMapping(headerRow);
  if (mapping.volumeCol === null && mapping.chapterCol === null) {
    return { volumes: [], confidence: 0 };
  }

  const volumes = extractVolumes(matrix.slice(1), mapping);
  const confidence = computeConfidence(mapping, volumes.length, matrix.length - 1);

  return { volumes, confidence };
}

/** Build a normalized cell matrix handling rowspan and colspan */
function buildNormalizedMatrix(
  $: CheerioAPI,
  rows: Cheerio<AnyNode>,
): string[][] {
  const matrix: string[][] = [];
  const spanTracker: SpanEntry[][] = [];

  rows.each((rowIdx, row) => {
    const cells: string[] = [];
    let colIdx = 0;

    // Ensure row exists in tracker
    spanTracker[rowIdx] ??= [];

    // Fill cells from previous rowspans
    colIdx = fillFromRowspans(spanTracker, rowIdx, colIdx, cells);

    // Process actual cells in this row
    $(row).find('th, td').each((_, cell) => {
      colIdx = fillFromRowspans(spanTracker, rowIdx, colIdx, cells);
      colIdx = processCellElement($, cell, spanTracker, rowIdx, colIdx, cells);
    });

    matrix.push(cells);
  });

  return matrix;
}

/** Fill cells from rowspan tracker at current position, return updated colIdx */
function fillFromRowspans(
  tracker: SpanEntry[][],
  rowIdx: number,
  startColIdx: number,
  cells: string[],
): number {
  const row = tracker[rowIdx];
  if (!row) return startColIdx;

  let idx = startColIdx;
  while (row[idx] !== undefined) {
    const span = row[idx];
    if (!span || span.remaining <= 0) break;
    cells.push(span.text);
    span.remaining--;
    propagateRowspan(tracker, rowIdx, idx, span);
    idx++;
  }
  return idx;
}

/** Process a single th/td cell element into the matrix */
// eslint-disable-next-line max-params -- params are all needed for rowspan tracking
function processCellElement(
  $: CheerioAPI,
  cell: AnyNode,
  tracker: SpanEntry[][],
  rowIdx: number,
  startColIdx: number,
  cells: string[],
): number {
  const text = $(cell).text().trim();
  const colspan = parseInt($(cell).attr('colspan') ?? '1', 10);
  const rowspan = parseInt($(cell).attr('rowspan') ?? '1', 10);

  let idx = startColIdx;
  for (let c = 0; c < colspan; c++) {
    cells.push(text);
    if (rowspan > 1) {
      setupRowspan(tracker, rowIdx, idx, text, rowspan);
    }
    idx++;
  }
  return idx;
}

/** Set up rowspan tracking for future rows */
function setupRowspan(
  tracker: SpanEntry[][],
  rowIdx: number,
  colIdx: number,
  text: string,
  rowspan: number,
): void {
  for (let r = 1; r < rowspan; r++) {
    const futureRow = rowIdx + r;
    tracker[futureRow] ??= []; // eslint-disable-line no-param-reassign
    tracker[futureRow][colIdx] = { text, remaining: 1 }; // eslint-disable-line no-param-reassign
  }
}

/** Propagate rowspan info to next row if remaining */
function propagateRowspan(
  tracker: SpanEntry[][],
  rowIdx: number,
  colIdx: number,
  span: SpanEntry,
): void {
  if (span.remaining > 0) {
    const nextRow = rowIdx + 1;
    tracker[nextRow] ??= []; // eslint-disable-line no-param-reassign
    tracker[nextRow][colIdx] = { text: span.text, remaining: span.remaining }; // eslint-disable-line no-param-reassign
  }
}

// ============================================================================
// Column Detection
// ============================================================================

/** Detect which columns contain volume, chapter, title, date, isbn data */
function detectColumnMapping(headerRow: string[]): ColumnMapping {
  let volumeCol: number | null = null;
  let chapterCol: number | null = null;
  let titleCol: number | null = null;
  let releaseDateCol: number | null = null;
  let isbnCol: number | null = null;

  for (let i = 0; i < headerRow.length; i++) {
    const header = (headerRow[i] ?? '').trim();
    if (!header) continue;

    if (volumeCol === null && VOLUME_KEYWORDS.test(header)) {
      volumeCol = i;
    } else if (chapterCol === null && CHAPTER_KEYWORDS.test(header)) {
      chapterCol = i;
    } else if (titleCol === null && TITLE_KEYWORDS.test(header)) {
      titleCol = i;
    } else if (releaseDateCol === null && DATE_KEYWORDS.test(header)) {
      releaseDateCol = i;
    } else if (isbnCol === null && ISBN_KEYWORDS.test(header)) {
      isbnCol = i;
    }
  }

  return { volumeCol, chapterCol, titleCol, releaseDateCol, isbnCol };
}

// ============================================================================
// Volume Extraction
// ============================================================================

/** Extract volume rows from the data matrix using column mapping */
function extractVolumes(
  dataRows: string[][],
  mapping: ColumnMapping,
): NormalizedVolumeRow[] {
  const volumes: NormalizedVolumeRow[] = [];

  for (const row of dataRows) {
    const vol = extractSingleVolume(row, mapping);
    if (vol) volumes.push(vol);
  }

  return volumes;
}

/** Extract a single volume from a row using column mapping */
function extractSingleVolume(
  row: string[],
  mapping: ColumnMapping,
): NormalizedVolumeRow | null {
  const volText = mapping.volumeCol !== null ? row[mapping.volumeCol] : null;
  const volNum = parseVolumeNumber(volText ?? '');
  if (volNum === null || volNum <= 0) return null;

  const chapterText = mapping.chapterCol !== null ? (row[mapping.chapterCol] ?? null) : null;
  const chapterRange = parseChapterRange(chapterText);

  return {
    number: volNum,
    title: mapping.titleCol !== null ? (row[mapping.titleCol] ?? null) : null,
    chapterRange: chapterText,
    chapterStart: chapterRange?.start ?? null,
    chapterEnd: chapterRange?.end ?? null,
    releaseDate: mapping.releaseDateCol !== null ? (row[mapping.releaseDateCol] ?? null) : null,
    isbn: mapping.isbnCol !== null ? (row[mapping.isbnCol] ?? null) : null,
  };
}

/** Parse a volume number from text like "1", "Vol. 1", "#5" */
function parseVolumeNumber(text: string): number | null {
  const cleaned = text.replace(/^(vol\.?|volume|#|no\.?)\s*/i, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/** Parse a chapter range string like "1-7", "8 - 16", "Chapters 1-7" */
function parseChapterRange(
  text: string | null,
): { start: number; end: number } | null {
  if (!text) return null;

  // Strip "Chapters" prefix
  const cleaned = text.replace(/^chapters?\s*/i, '').trim();
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*[-\u2013\u2014]\s*(\d+(?:\.\d+)?)/);
  if (!match?.[1] || !match[2]) return null;

  const start = parseFloat(match[1]);
  const end = parseFloat(match[2]);
  if (isNaN(start) || isNaN(end) || start <= 0 || end < start) return null;

  return { start, end };
}

// ============================================================================
// Confidence Scoring
// ============================================================================

/** Compute confidence based on how well-structured the table was */
function computeConfidence(
  mapping: ColumnMapping,
  volumeCount: number,
  totalDataRows: number,
): number {
  let score = 0.5;

  // Both volume and chapter columns detected
  if (mapping.volumeCol !== null && mapping.chapterCol !== null) score += 0.2;

  // Good extraction rate (most rows yielded volumes)
  if (totalDataRows > 0 && volumeCount / totalDataRows > 0.5) score += 0.15;

  // Additional columns detected (title, date, isbn)
  if (mapping.titleCol !== null) score += 0.05;
  if (mapping.releaseDateCol !== null) score += 0.05;
  if (mapping.isbnCol !== null) score += 0.05;

  return Math.min(1.0, score);
}
