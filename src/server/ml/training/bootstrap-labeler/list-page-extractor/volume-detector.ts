/**
 * Volume Detector for List Pages
 *
 * Detects volumes from:
 * 1. H2/H3 section headers (e.g., "Volume 1" sections)
 * 2. Volume columns/rows in tables
 *
 * Extracts metadata: number, title, URL, ISBN, release date, cover URL
 * Supports provider-specific overrides for Wikipedia, Fandom, etc.
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import type { TableAnalysis } from '../table-analyzer';
import type { ListPageOverrides } from './provider-overrides/types';
import type { VolumeExtraction } from './types';

// ============================================================================
// Constants
// ============================================================================

/** Pattern to match volume numbers in text */
const VOLUME_NUMBER_PATTERN = /(?:Vol(?:ume)?\.?\s*)?(\d+)/i;

/** Patterns for detecting volume section headers */
const VOLUME_HEADER_PATTERNS = [
  /^Volume\s+(\d+)/i,
  /^Vol\.?\s*(\d+)/i,
  /^Tankōbon\s+(\d+)/i,
  /^Tankoubon\s+(\d+)/i,
];

// ============================================================================
// Types
// ============================================================================

export interface VolumeSection {
  volumeNumber: number;
  headerTokenIndex: number;
  startTokenIndex: number;
  endTokenIndex: number;
}

interface VolumeTableRow {
  volumeNumber: number;
  title?: string;
  url?: string;
  isbn?: string;
  releaseDate?: string;
  coverUrl?: string;
  chapterStart?: number;
  chapterEnd?: number;
  tokenIndices: {
    number?: number;
    titleStart?: number;
    titleEnd?: number;
    url?: number;
  };
  tableId: string;
  tableRow: number;
}

interface ColumnMapping {
  volumeNumber?: number;
  title?: number;
  isbn?: number;
  releaseDate?: number;
  chapters?: number;
  cover?: number;
}

interface ExtractedTextData {
  text: string;
  startIdx: number;
  endIdx: number;
  url?: string;
  urlIdx?: number;
}

// ============================================================================
// Section Header Detection
// ============================================================================

/**
 * Check if token is a header element and extract volume number
 */
function getVolumeNumberFromHeaderToken(token: LinearizedToken): number | null {
  const isHeader = /^h[2-4]$/i.test(token.tagName);
  if (!isHeader) return null;

  return extractVolumeNumberFromText(token.text);
}

/**
 * Detect volume sections from H2/H3 headers
 * Returns sections with their token ranges
 */
export function detectVolumeSections(tokens: LinearizedToken[]): VolumeSection[] {
  const sections: VolumeSection[] = [];
  let currentSection: VolumeSection | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    const volumeNumber = getVolumeNumberFromHeaderToken(token);

    if (volumeNumber !== null) {
      // Close previous section
      if (currentSection) {
        currentSection.endTokenIndex = i - 1;
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        volumeNumber,
        headerTokenIndex: i,
        startTokenIndex: i,
        endTokenIndex: tokens.length - 1, // Will be updated when next section starts
      };
    }
  }

  // Close final section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Extract volume number from text using various patterns
 */
function extractVolumeNumberFromText(text: string): number | null {
  const trimmed = text.trim();

  for (const pattern of VOLUME_HEADER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

// ============================================================================
// Table-Based Volume Detection
// ============================================================================

/**
 * Extract volumes from table analysis
 *
 * @param tokens - Linearized tokens from the page
 * @param tableAnalyses - Table structure analyses
 * @param overrides - Optional provider-specific overrides
 * @returns Array of extracted volumes
 */
export function extractVolumesFromTables(
  tokens: LinearizedToken[],
  tableAnalyses: TableAnalysis[],
  overrides?: ListPageOverrides
): VolumeExtraction[] {
  const volumes: VolumeExtraction[] = [];

  for (const analysis of tableAnalyses) {
    // Only process volume tables or combined volume-chapter tables
    if (analysis.tableType !== 'volume_list') continue;

    const tableVolumes = extractVolumesFromSingleTable(tokens, analysis, overrides);
    volumes.push(...tableVolumes);
  }

  return volumes;
}

/**
 * Extract volumes from a single table
 */
function extractVolumesFromSingleTable(
  tokens: LinearizedToken[],
  analysis: TableAnalysis,
  overrides?: ListPageOverrides
): VolumeExtraction[] {
  const volumes: VolumeExtraction[] = [];
  const columnMapping = mapColumnsToFieldsWithOverrides(analysis, overrides);

  // Use override or global row grouping function
  const groupRowsFn = overrides?.groupTokensByRow ?? groupTokensByRow;
  const rowTokens = groupRowsFn(tokens, analysis.tableId);

  for (const [rowNum, rowTokenIndices] of rowTokens) {
    if (rowNum === 0) continue; // Skip header row

    const volumeRow = extractVolumeFromRow(tokens, rowTokenIndices, columnMapping, analysis.tableId, rowNum);
    if (volumeRow) {
      volumes.push(convertToVolumeExtraction(volumeRow, analysis));
    }
  }

  return volumes;
}

/**
 * Map table columns to volume fields based on analysis (global logic)
 */
function mapColumnsToFields(analysis: TableAnalysis): ColumnMapping {
  const mapping: ColumnMapping = {};

  for (const column of analysis.columns) {
    const header = column.headerText.toLowerCase();

    if (/^#$|^no\.?$|^vol/i.test(header)) {
      mapping.volumeNumber = column.index;
    } else if (/^title$|^name$/i.test(header)) {
      mapping.title = column.index;
    } else if (/^isbn$/i.test(header)) {
      mapping.isbn = column.index;
    } else if (/^release|^date|^published$/i.test(header)) {
      mapping.releaseDate = column.index;
    } else if (/^chapter/i.test(header)) {
      mapping.chapters = column.index;
    } else if (/^cover$/i.test(header)) {
      mapping.cover = column.index;
    }
  }

  return mapping;
}

/**
 * Try to map a column using override patterns.
 * Returns the field name if matched, null otherwise.
 */
function tryMapColumnWithOverrides(
  header: string,
  patterns: NonNullable<ListPageOverrides['columnPatterns']>,
  matchFn: (header: string, patterns: RegExp[]) => boolean
): keyof ColumnMapping | null {
  if (patterns.volumeNumber && matchFn(header, patterns.volumeNumber)) return 'volumeNumber';
  if (patterns.title && matchFn(header, patterns.title)) return 'title';
  if (patterns.isbn && matchFn(header, patterns.isbn)) return 'isbn';
  if (patterns.releaseDate && matchFn(header, patterns.releaseDate)) return 'releaseDate';
  if (patterns.chapters && matchFn(header, patterns.chapters)) return 'chapters';
  if (patterns.cover && matchFn(header, patterns.cover)) return 'cover';
  return null;
}

/**
 * Get the field name from a global mapping result.
 */
function getFieldFromGlobalMapping(globalMapping: ColumnMapping): keyof ColumnMapping | null {
  const field = Object.keys(globalMapping).find(
    (key) => globalMapping[key as keyof ColumnMapping] !== undefined
  ) as keyof ColumnMapping | undefined;

  return field ?? null;
}

/**
 * Map table columns to volume fields with provider-specific overrides
 */
function mapColumnsToFieldsWithOverrides(
  analysis: TableAnalysis,
  overrides?: ListPageOverrides
): ColumnMapping {
  // If no custom patterns, use global logic
  if (!overrides?.columnPatterns) {
    return mapColumnsToFields(analysis);
  }

  const patterns = overrides.columnPatterns;
  const matchFn = overrides.matchesColumnPattern ?? defaultMatchPattern;
  const mapping: ColumnMapping = {};

  for (const column of analysis.columns) {
    const field = tryMapColumnWithOverrides(column.headerText, patterns, matchFn);

    if (field) {
      mapping[field] = column.index;
      continue;
    }

    // Fall back to global patterns if no override matched
    const globalMapping = mapColumnsToFields({ ...analysis, columns: [column] });
    const globalField = getFieldFromGlobalMapping(globalMapping);
    if (globalField) {
      mapping[globalField] = column.index;
    }
  }

  return mapping;
}

/**
 * Default pattern matching function
 */
function defaultMatchPattern(header: string, patterns: RegExp[]): boolean {
  const normalized = header.trim().toLowerCase();
  return patterns.some((p) => p.test(normalized));
}

/**
 * Group token indices by table row
 */
function groupTokensByRow(tokens: LinearizedToken[], tableId: string): Map<number, number[]> {
  const rowTokens = new Map<number, number[]>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token?.isInTable) continue;
    if (!token.xpath.includes(tableId)) continue;
    if (token.tableRow === null) continue;

    const existing = rowTokens.get(token.tableRow) ?? [];
    existing.push(i);
    rowTokens.set(token.tableRow, existing);
  }

  return rowTokens;
}

/**
 * Extract core volume data (number, title, URL)
 */
function extractCoreVolumeData(
  tokens: LinearizedToken[],
  rowTokenIndices: number[],
  columnMapping: ColumnMapping
): { volumeNumber: number; title?: string; url?: string; tokenIndices: VolumeTableRow['tokenIndices'] } | null {
  const volumeNumber = findVolumeNumber(tokens, rowTokenIndices, columnMapping.volumeNumber);
  if (volumeNumber === null) return null;

  const tokenIndices: VolumeTableRow['tokenIndices'] = {};
  const numberTokenIdx = findTokenInColumn(tokens, rowTokenIndices, columnMapping.volumeNumber);
  if (numberTokenIdx !== null) {
    tokenIndices.number = numberTokenIdx;
  }

  const result: { volumeNumber: number; title?: string; url?: string; tokenIndices: VolumeTableRow['tokenIndices'] } = {
    volumeNumber,
    tokenIndices,
  };

  if (columnMapping.title !== undefined) {
    const titleData = extractTextFromColumn(tokens, rowTokenIndices, columnMapping.title);
    if (titleData) {
      result.title = titleData.text;
      tokenIndices.titleStart = titleData.startIdx;
      tokenIndices.titleEnd = titleData.endIdx;
      if (titleData.url && titleData.urlIdx !== undefined) {
        result.url = titleData.url;
        tokenIndices.url = titleData.urlIdx;
      }
    }
  }

  return result;
}

/**
 * Extract additional volume metadata
 */
function extractVolumeMetadata(
  tokens: LinearizedToken[],
  rowTokenIndices: number[],
  columnMapping: ColumnMapping
): { isbn?: string; releaseDate?: string; chapterStart?: number; chapterEnd?: number; coverUrl?: string } {
  const result: { isbn?: string; releaseDate?: string; chapterStart?: number; chapterEnd?: number; coverUrl?: string } = {};

  if (columnMapping.isbn !== undefined) {
    const isbn = extractTextValue(tokens, rowTokenIndices, columnMapping.isbn);
    if (isbn) result.isbn = isbn;
  }
  if (columnMapping.releaseDate !== undefined) {
    const releaseDate = extractTextValue(tokens, rowTokenIndices, columnMapping.releaseDate);
    if (releaseDate) result.releaseDate = releaseDate;
  }
  if (columnMapping.chapters !== undefined) {
    const chaptersText = extractTextValue(tokens, rowTokenIndices, columnMapping.chapters);
    if (chaptersText) {
      const range = parseChapterRange(chaptersText);
      if (range.start !== undefined) result.chapterStart = range.start;
      if (range.end !== undefined) result.chapterEnd = range.end;
    }
  }
  if (columnMapping.cover !== undefined) {
    const coverUrl = extractCoverUrl(tokens, rowTokenIndices, columnMapping.cover);
    if (coverUrl) result.coverUrl = coverUrl;
  }

  return result;
}

/**
 * Extract cover URL from cover column
 */
function extractCoverUrl(tokens: LinearizedToken[], rowTokenIndices: number[], columnIndex: number): string | undefined {
  const coverToken = findTokenInColumn(tokens, rowTokenIndices, columnIndex);
  if (coverToken === null) return undefined;
  return tokens[coverToken]?.linkHref ?? undefined;
}

/**
 * Extract volume data from a single table row
 */
function extractVolumeFromRow(
  tokens: LinearizedToken[],
  rowTokenIndices: number[],
  columnMapping: ColumnMapping,
  tableId: string,
  tableRow: number
): VolumeTableRow | null {
  const coreData = extractCoreVolumeData(tokens, rowTokenIndices, columnMapping);
  if (!coreData) return null;

  const metadata = extractVolumeMetadata(tokens, rowTokenIndices, columnMapping);

  const result: VolumeTableRow = {
    volumeNumber: coreData.volumeNumber,
    tokenIndices: coreData.tokenIndices,
    tableId,
    tableRow,
  };

  if (coreData.title) result.title = coreData.title;
  if (coreData.url) result.url = coreData.url;
  if (metadata.isbn) result.isbn = metadata.isbn;
  if (metadata.releaseDate) result.releaseDate = metadata.releaseDate;
  if (metadata.chapterStart !== undefined) result.chapterStart = metadata.chapterStart;
  if (metadata.chapterEnd !== undefined) result.chapterEnd = metadata.chapterEnd;
  if (metadata.coverUrl) result.coverUrl = metadata.coverUrl;

  return result;
}

/**
 * Find volume number from tokens in a column
 */
function findVolumeNumber(tokens: LinearizedToken[], rowTokenIndices: number[], columnIndex?: number): number | null {
  if (columnIndex !== undefined) {
    const text = extractTextValue(tokens, rowTokenIndices, columnIndex);
    if (text) {
      const match = text.match(VOLUME_NUMBER_PATTERN);
      if (match?.[1]) return parseInt(match[1], 10);
    }
  }

  for (const idx of rowTokenIndices) {
    const token = tokens[idx];
    if (!token) continue;
    const match = token.text.match(VOLUME_NUMBER_PATTERN);
    if (match?.[1]) return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Find a single token in a specific column
 */
function findTokenInColumn(tokens: LinearizedToken[], rowTokenIndices: number[], columnIndex?: number): number | null {
  if (columnIndex === undefined) return null;

  for (const idx of rowTokenIndices) {
    if (tokens[idx]?.tableCol === columnIndex) return idx;
  }
  return null;
}

/**
 * Extract text and URL from tokens in a column
 */
function extractTextFromColumn(tokens: LinearizedToken[], rowTokenIndices: number[], columnIndex: number): ExtractedTextData | null {
  const columnTokens: { idx: number; token: LinearizedToken }[] = [];

  for (const idx of rowTokenIndices) {
    const token = tokens[idx];
    if (token?.tableCol === columnIndex) {
      columnTokens.push({ idx, token });
    }
  }

  if (columnTokens.length === 0) return null;

  const text = columnTokens.map((t) => t.token.text).join(' ').trim();
  const firstToken = columnTokens[0];
  const lastToken = columnTokens[columnTokens.length - 1];
  const startIdx = firstToken?.idx ?? 0;
  const endIdx = lastToken?.idx ?? startIdx;

  const linkInfo = findFirstLink(columnTokens);
  const result: ExtractedTextData = { text, startIdx, endIdx };
  if (linkInfo) {
    result.url = linkInfo.url;
    result.urlIdx = linkInfo.idx;
  }
  return result;
}

/**
 * Find the first link in column tokens
 */
function findFirstLink(columnTokens: Array<{ idx: number; token: LinearizedToken }>): { url: string; idx: number } | null {
  for (const { idx, token } of columnTokens) {
    if (token.isLink && token.linkHref) return { url: token.linkHref, idx };
  }
  return null;
}

/**
 * Extract simple text value from a column
 */
function extractTextValue(tokens: LinearizedToken[], rowTokenIndices: number[], columnIndex: number): string | null {
  const texts: string[] = [];
  for (const idx of rowTokenIndices) {
    const token = tokens[idx];
    if (token?.tableCol === columnIndex) texts.push(token.text);
  }
  const combined = texts.join(' ').trim();
  return combined ? combined : null;
}

/**
 * Parse chapter range from text like "1-5" or "Chapters 1-5"
 */
function parseChapterRange(text: string): { start?: number; end?: number } {
  const result: { start?: number; end?: number } = {};

  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const startStr = rangeMatch[1];
    const endStr = rangeMatch[2];
    if (startStr) result.start = parseFloat(startStr);
    if (endStr) result.end = parseFloat(endStr);
    return result;
  }

  const singleMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const numStr = singleMatch[1];
    if (numStr) {
      const num = parseFloat(numStr);
      result.start = num;
      result.end = num;
    }
  }

  return result;
}

/**
 * Convert VolumeTableRow to VolumeExtraction
 */
function convertToVolumeExtraction(row: VolumeTableRow, analysis: TableAnalysis): VolumeExtraction {
  const tokenSpans: VolumeExtraction['tokenSpans'] = {};

  if (row.tokenIndices.number !== undefined) {
    tokenSpans.number = { start: row.tokenIndices.number, end: row.tokenIndices.number };
  }
  if (row.tokenIndices.titleStart !== undefined && row.tokenIndices.titleEnd !== undefined) {
    tokenSpans.title = { start: row.tokenIndices.titleStart, end: row.tokenIndices.titleEnd };
  }
  if (row.tokenIndices.url !== undefined) {
    tokenSpans.url = { start: row.tokenIndices.url, end: row.tokenIndices.url };
  }

  const result: VolumeExtraction = {
    volumeNumber: row.volumeNumber,
    tokenSpans,
    tableId: row.tableId,
    tableRow: row.tableRow,
    confidence: analysis.confidence,
  };

  if (row.title) result.title = row.title;
  if (row.url) result.url = row.url;
  if (row.isbn) result.isbn = row.isbn;
  if (row.releaseDate) result.releaseDate = row.releaseDate;
  if (row.coverUrl) result.coverUrl = row.coverUrl;
  if (row.chapterStart !== undefined) result.chapterStart = row.chapterStart;
  if (row.chapterEnd !== undefined) result.chapterEnd = row.chapterEnd;

  return result;
}

// ============================================================================
// Combined Detection
// ============================================================================

/**
 * Create a minimal volume extraction from section header
 */
function createSectionBasedVolume(section: VolumeSection): VolumeExtraction {
  return {
    volumeNumber: section.volumeNumber,
    tokenSpans: { number: { start: section.headerTokenIndex, end: section.headerTokenIndex } },
    tableId: 'section',
    tableRow: 0,
    confidence: 0.7,
  };
}

/**
 * Detect all volumes from tokens and table analyses
 *
 * @param tokens - Linearized tokens from the page
 * @param tableAnalyses - Table structure analyses
 * @param overrides - Optional provider-specific overrides
 * @returns Object containing extracted volumes and detected sections
 */
export function detectVolumes(
  tokens: LinearizedToken[],
  tableAnalyses: TableAnalysis[],
  overrides?: ListPageOverrides
): { volumes: VolumeExtraction[]; sections: VolumeSection[] } {
  const sections = detectVolumeSections(tokens);
  const tableVolumes = extractVolumesFromTables(tokens, tableAnalyses, overrides);

  // Deduplicate by volume number (prefer table data as more structured)
  const volumeMap = new Map<number, VolumeExtraction>();

  for (const vol of tableVolumes) {
    volumeMap.set(vol.volumeNumber, vol);
  }

  for (const section of sections) {
    if (!volumeMap.has(section.volumeNumber)) {
      volumeMap.set(section.volumeNumber, createSectionBasedVolume(section));
    }
  }

  const volumes = Array.from(volumeMap.values()).sort((a, b) => a.volumeNumber - b.volumeNumber);
  return { volumes, sections };
}
