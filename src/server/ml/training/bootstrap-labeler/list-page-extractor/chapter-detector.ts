/**
 * Chapter Detector for List Pages
 *
 * Extracts chapters from tables and determines parent volume relationships.
 * Relationship sources: SAME_TABLE_ROW, VOLUME_SECTION, EXPLICIT_LABEL, INFERRED
 * Supports provider-specific overrides for Wikipedia, Fandom, etc.
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import type { TableAnalysis } from '../table-analyzer';
import type { ListPageOverrides } from './provider-overrides/types';
import type { ChapterExtraction, RelationSourceType, VolumeExtraction } from './types';
import type { VolumeSection } from './volume-detector';

// ============================================================================
// Constants
// ============================================================================

/** Pattern to match chapter numbers */
const CHAPTER_NUMBER_PATTERN = /(?:Ch(?:apter)?\.?\s*)?(\d+(?:\.\d+)?)/i;

/** Pattern to detect explicit volume reference in chapter row */
const VOLUME_REFERENCE_PATTERN = /Vol(?:ume)?\.?\s*(\d+)/i;

// ============================================================================
// Types
// ============================================================================

interface ChapterTableRow {
  chapterNumber: number;
  title?: string;
  url?: string;
  releaseDate?: string;
  volumeNumber?: number;
  relationSource: RelationSourceType;
  tokenIndices: {
    number?: number;
    titleStart?: number;
    titleEnd?: number;
    url?: number;
  };
  tableId: string;
  tableRow: number;
}

interface ChapterColumnMapping {
  chapterNumber?: number;
  title?: number;
  releaseDate?: number;
  volume?: number;
}

// ============================================================================
// Table-Based Chapter Detection
// ============================================================================

/**
 * Extract chapters from table analyses
 *
 * @param tokens - Linearized tokens from the page
 * @param tableAnalyses - Table structure analyses
 * @param volumes - Extracted volumes for relationship inference
 * @param sections - Detected volume sections
 * @param overrides - Optional provider-specific overrides
 * @returns Array of extracted chapters
 */
export function extractChaptersFromTables(
  tokens: LinearizedToken[],
  tableAnalyses: TableAnalysis[],
  volumes: VolumeExtraction[],
  sections: VolumeSection[],
  overrides?: ListPageOverrides
): ChapterExtraction[] {
  const chapters: ChapterExtraction[] = [];

  for (const analysis of tableAnalyses) {
    if (analysis.tableType !== 'chapter_list') continue;

    const tableChapters = extractChaptersFromSingleTable(tokens, analysis, volumes, sections, overrides);
    chapters.push(...tableChapters);
  }

  return chapters;
}

/**
 * Build updated chapter row with volume relationship.
 * Handles the volume relationship determination and creates a new row.
 */
function buildChapterRowWithVolumeRelation(
  chapterRow: ChapterTableRow,
  volumes: VolumeExtraction[],
  sections: VolumeSection[],
  tokens: LinearizedToken[],
  rowTokenIndices: number[]
): ChapterTableRow {
  // If already has volume, return as-is
  if (chapterRow.volumeNumber !== undefined) {
    return chapterRow;
  }

  const volumeInfo = inferVolumeRelationship(chapterRow, volumes, sections, tokens, rowTokenIndices);

  // Create base row without optional volumeNumber
  const baseRow: ChapterTableRow = {
    chapterNumber: chapterRow.chapterNumber,
    relationSource: volumeInfo.source,
    tokenIndices: chapterRow.tokenIndices,
    tableId: chapterRow.tableId,
    tableRow: chapterRow.tableRow,
  };

  // Copy optional fields
  if (chapterRow.title) baseRow.title = chapterRow.title;
  if (chapterRow.url) baseRow.url = chapterRow.url;
  if (chapterRow.releaseDate) baseRow.releaseDate = chapterRow.releaseDate;

  // Only set volumeNumber if defined
  if (volumeInfo.volumeNumber !== undefined) {
    baseRow.volumeNumber = volumeInfo.volumeNumber;
  }

  return baseRow;
}

/**
 * Extract chapters from a single table
 */
function extractChaptersFromSingleTable(
  tokens: LinearizedToken[],
  analysis: TableAnalysis,
  volumes: VolumeExtraction[],
  sections: VolumeSection[],
  overrides?: ListPageOverrides
): ChapterExtraction[] {
  const chapters: ChapterExtraction[] = [];
  const columnMapping = mapChapterColumnsWithOverrides(analysis, overrides);

  // Use override or global row grouping function
  const groupRowsFn = overrides?.groupTokensByRow ?? groupTokensByRow;
  const rowTokens = groupRowsFn(tokens, analysis.tableId);

  for (const [rowNum, rowTokenIndices] of rowTokens) {
    if (rowNum === 0) continue; // Skip header row

    const chapterRow = extractChapterFromRow(tokens, rowTokenIndices, columnMapping, analysis.tableId, rowNum);
    if (!chapterRow) continue;

    // Build chapter row with volume relationship
    const updatedRow = buildChapterRowWithVolumeRelation(chapterRow, volumes, sections, tokens, rowTokenIndices);

    chapters.push(convertToChapterExtraction(updatedRow, analysis));
  }

  return chapters;
}

/**
 * Map table columns to chapter fields (global logic)
 */
function mapChapterColumns(analysis: TableAnalysis): ChapterColumnMapping {
  const mapping: ChapterColumnMapping = {};

  for (const column of analysis.columns) {
    const header = column.headerText.toLowerCase();

    if (/^#$|^no\.?$|^ch/i.test(header)) {
      mapping.chapterNumber = column.index;
    } else if (/^title$|^name$/i.test(header)) {
      mapping.title = column.index;
    } else if (/^release|^date|^published$/i.test(header)) {
      mapping.releaseDate = column.index;
    } else if (/^vol/i.test(header)) {
      mapping.volume = column.index;
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
 * Map a single column to chapter fields using override patterns
 */
function mapColumnWithOverridePatterns(
  column: TableAnalysis['columns'][0],
  patterns: NonNullable<ListPageOverrides['columnPatterns']>,
  matchFn: (header: string, patterns: RegExp[]) => boolean
): Partial<ChapterColumnMapping> {
  const header = column.headerText;

  if (patterns.chapterNumber && matchFn(header, patterns.chapterNumber)) {
    return { chapterNumber: column.index };
  }
  if (patterns.title && matchFn(header, patterns.title)) {
    return { title: column.index };
  }
  if (patterns.releaseDate && matchFn(header, patterns.releaseDate)) {
    return { releaseDate: column.index };
  }
  if (patterns.volumeNumber && matchFn(header, patterns.volumeNumber)) {
    return { volume: column.index };
  }

  return {};
}

/**
 * Map table columns to chapter fields with provider-specific overrides
 */
function mapChapterColumnsWithOverrides(
  analysis: TableAnalysis,
  overrides?: ListPageOverrides
): ChapterColumnMapping {
  // If no custom patterns, use global logic
  if (!overrides?.columnPatterns) {
    return mapChapterColumns(analysis);
  }

  const patterns = overrides.columnPatterns;
  const matchFn = overrides.matchesColumnPattern ?? defaultMatchPattern;
  const mapping: ChapterColumnMapping = {};

  for (const column of analysis.columns) {
    const overrideMapping = mapColumnWithOverridePatterns(column, patterns, matchFn);

    // Apply override mapping
    if (overrideMapping.chapterNumber !== undefined) {
      mapping.chapterNumber = overrideMapping.chapterNumber;
    } else if (overrideMapping.title !== undefined) {
      mapping.title = overrideMapping.title;
    } else if (overrideMapping.releaseDate !== undefined) {
      mapping.releaseDate = overrideMapping.releaseDate;
    } else if (overrideMapping.volume !== undefined) {
      mapping.volume = overrideMapping.volume;
    } else {
      // Fall back to global patterns
      const globalMapping = mapChapterColumns({ ...analysis, columns: [column] });
      Object.assign(mapping, globalMapping);
    }
  }

  return mapping;
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
 * Extract chapter data from a single table row
 */
function extractChapterFromRow(
  tokens: LinearizedToken[],
  rowTokenIndices: number[],
  columnMapping: ChapterColumnMapping,
  tableId: string,
  tableRow: number
): ChapterTableRow | null {
  const chapterNumber = findChapterNumber(tokens, rowTokenIndices, columnMapping.chapterNumber);
  if (chapterNumber === null) return null;

  const tokenIndices: ChapterTableRow['tokenIndices'] = {};
  const numberTokenIdx = findTokenInColumn(tokens, rowTokenIndices, columnMapping.chapterNumber);
  if (numberTokenIdx !== null) {
    tokenIndices.number = numberTokenIdx;
  }

  const result: ChapterTableRow = {
    chapterNumber,
    relationSource: 'INFERRED',
    tokenIndices,
    tableId,
    tableRow,
  };

  // Extract title
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

  // Extract release date
  if (columnMapping.releaseDate !== undefined) {
    const releaseDate = extractTextValue(tokens, rowTokenIndices, columnMapping.releaseDate);
    if (releaseDate) result.releaseDate = releaseDate;
  }

  // Check for explicit volume column (SAME_TABLE_ROW source)
  if (columnMapping.volume !== undefined) {
    const volumeText = extractTextValue(tokens, rowTokenIndices, columnMapping.volume);
    if (volumeText) {
      const match = volumeText.match(VOLUME_REFERENCE_PATTERN);
      if (match?.[1]) {
        result.volumeNumber = parseInt(match[1], 10);
        result.relationSource = 'SAME_TABLE_ROW';
      }
    }
  }

  return result;
}

/**
 * Find chapter number from tokens
 */
function findChapterNumber(tokens: LinearizedToken[], rowTokenIndices: number[], columnIndex?: number): number | null {
  if (columnIndex !== undefined) {
    const text = extractTextValue(tokens, rowTokenIndices, columnIndex);
    if (text) {
      const match = text.match(CHAPTER_NUMBER_PATTERN);
      if (match?.[1]) return parseFloat(match[1]);
    }
  }

  for (const idx of rowTokenIndices) {
    const token = tokens[idx];
    if (!token) continue;
    const match = token.text.match(CHAPTER_NUMBER_PATTERN);
    if (match?.[1]) return parseFloat(match[1]);
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

interface ExtractedTextData {
  text: string;
  startIdx: number;
  endIdx: number;
  url?: string;
  urlIdx?: number;
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

  // Find first link
  const result: ExtractedTextData = { text, startIdx, endIdx };
  for (const { idx, token } of columnTokens) {
    if (token.isLink && token.linkHref) {
      result.url = token.linkHref;
      result.urlIdx = idx;
      break;
    }
  }

  return result;
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

// ============================================================================
// Volume Relationship Inference
// ============================================================================

interface VolumeRelationshipResult {
  volumeNumber?: number;
  source: RelationSourceType;
}

/**
 * Infer which volume a chapter belongs to
 */
function inferVolumeRelationship(
  chapter: ChapterTableRow,
  volumes: VolumeExtraction[],
  sections: VolumeSection[],
  tokens: LinearizedToken[],
  rowTokenIndices: number[]
): VolumeRelationshipResult {
  // 1. Check for explicit volume label in row text
  const explicitVolume = findExplicitVolumeLabel(tokens, rowTokenIndices);
  if (explicitVolume !== null) {
    return { volumeNumber: explicitVolume, source: 'EXPLICIT_LABEL' };
  }

  // 2. Check if chapter is within a volume section
  const sectionVolume = findVolumeFromSection(chapter, sections, tokens, rowTokenIndices);
  if (sectionVolume !== null) {
    return { volumeNumber: sectionVolume, source: 'VOLUME_SECTION' };
  }

  // 3. Infer from volume chapter ranges
  const rangeVolume = findVolumeFromChapterRange(chapter.chapterNumber, volumes);
  if (rangeVolume !== null) {
    return { volumeNumber: rangeVolume, source: 'INFERRED' };
  }

  return { source: 'INFERRED' };
}

/**
 * Find explicit volume label in row tokens
 */
function findExplicitVolumeLabel(tokens: LinearizedToken[], rowTokenIndices: number[]): number | null {
  for (const idx of rowTokenIndices) {
    const token = tokens[idx];
    if (!token) continue;

    const match = token.text.match(VOLUME_REFERENCE_PATTERN);
    if (match?.[1]) return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Find volume based on section headers
 */
function findVolumeFromSection(
  chapter: ChapterTableRow,
  sections: VolumeSection[],
  tokens: LinearizedToken[],
  rowTokenIndices: number[]
): number | null {
  if (sections.length === 0 || rowTokenIndices.length === 0) return null;

  // Get the first token index in the chapter row
  const firstTokenIdx = rowTokenIndices[0];
  if (firstTokenIdx === undefined) return null;

  // Find which section this chapter is in
  for (const section of sections) {
    if (firstTokenIdx >= section.startTokenIndex && firstTokenIdx <= section.endTokenIndex) {
      return section.volumeNumber;
    }
  }

  return null;
}

/**
 * Find volume based on chapter ranges defined in volumes
 */
function findVolumeFromChapterRange(chapterNumber: number, volumes: VolumeExtraction[]): number | null {
  for (const volume of volumes) {
    if (volume.chapterStart !== undefined && volume.chapterEnd !== undefined) {
      if (chapterNumber >= volume.chapterStart && chapterNumber <= volume.chapterEnd) {
        return volume.volumeNumber;
      }
    }
  }
  return null;
}

/**
 * Convert ChapterTableRow to ChapterExtraction
 */
function convertToChapterExtraction(row: ChapterTableRow, analysis: TableAnalysis): ChapterExtraction {
  const tokenSpans: ChapterExtraction['tokenSpans'] = {};

  if (row.tokenIndices.number !== undefined) {
    tokenSpans.number = { start: row.tokenIndices.number, end: row.tokenIndices.number };
  }
  if (row.tokenIndices.titleStart !== undefined && row.tokenIndices.titleEnd !== undefined) {
    tokenSpans.title = { start: row.tokenIndices.titleStart, end: row.tokenIndices.titleEnd };
  }
  if (row.tokenIndices.url !== undefined) {
    tokenSpans.url = { start: row.tokenIndices.url, end: row.tokenIndices.url };
  }

  const result: ChapterExtraction = {
    chapterNumber: row.chapterNumber,
    relationSource: row.relationSource,
    tokenSpans,
    tableId: row.tableId,
    tableRow: row.tableRow,
    confidence: analysis.confidence,
  };

  if (row.title) result.title = row.title;
  if (row.url) result.url = row.url;
  if (row.releaseDate) result.releaseDate = row.releaseDate;
  if (row.volumeNumber !== undefined) result.belongsToVolume = row.volumeNumber;

  return result;
}

// ============================================================================
// Combined Detection
// ============================================================================

/**
 * Detect all chapters from tokens and table analyses
 *
 * @param tokens - Linearized tokens from the page
 * @param tableAnalyses - Table structure analyses
 * @param volumes - Extracted volumes for relationship inference
 * @param sections - Detected volume sections
 * @param overrides - Optional provider-specific overrides
 * @returns Array of extracted chapters sorted by chapter number
 */
export function detectChapters(
  tokens: LinearizedToken[],
  tableAnalyses: TableAnalysis[],
  volumes: VolumeExtraction[],
  sections: VolumeSection[],
  overrides?: ListPageOverrides
): ChapterExtraction[] {
  const chapters = extractChaptersFromTables(tokens, tableAnalyses, volumes, sections, overrides);

  // Sort by chapter number
  return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
}
