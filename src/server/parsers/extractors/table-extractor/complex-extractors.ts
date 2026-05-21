/**
 * Table Extractor - Complex Extractors
 *
 * Functions for handling complex table formats including
 * multi-column volumes, rowspan handling, and generic extraction.
 *
 * Extracted from: TableExtractor.ts (lines 661-844, 964-997)
 */

import type { PatternLibrary } from '@/server/parsers/patterns/PatternLibrary';

import {
  extractHeaders,
  mapHeaderIndices,
} from './utils';

import type {
  CheerioAPI,
  Element,
  VolumeInfo,
  ChapterInfo,
  TableData,
  ExtractionOptions,
} from './types';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Represents a processed cell with rowspan tracking
 */
interface ProcessedCell {
  text: string;
  element?: Element;
  rowspan?: number;
  isRowspan?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to add a chapter to the current volume
 * Extracted to reduce nesting depth
 */
function addChapterToCurrentVolume(
  cells: ProcessedCell[],
  indices: ReturnType<typeof mapHeaderIndices>,
  patterns: PatternLibrary,
  volumes: VolumeInfo[]
): void {
  const chapterIdx = indices.chapter;
  if (chapterIdx === -1 || volumes.length === 0) return;

  const chapterCell = cells[chapterIdx];
  if (!chapterCell) return;

  const chapterMatch = patterns.match(chapterCell.text, 'chapter');
  if (!chapterMatch) return;

  const currentVolume = volumes[volumes.length - 1];
  if (!currentVolume) return;

  const chapterTitleIdx = indices.chapterTitle;
  const titleCell = chapterTitleIdx !== -1 ? cells[chapterTitleIdx] : undefined;
  const titleText = titleCell?.text;
  const chapter: ChapterInfo = {
    chapterNumber: chapterMatch.value.toString(),
    volumeNumber: currentVolume.volumeNumber
  };
  if (titleText) {
    chapter.title = titleText;
  }
  currentVolume.chapters.push(chapter);
}

// ============================================================================
// Complex Extractors
// ============================================================================

/**
 * Extract multi-column volumes (e.g., Japanese and English releases)
 *
 * Handles tables that have separate columns for different language releases
 * of the same volume, merging them into unified VolumeInfo objects.
 */
export function extractMultiColumnVolumes(
  $: CheerioAPI,
  table: Element,
  _options: ExtractionOptions,
  patterns: PatternLibrary
): TableData | null {
  const headers = extractHeaders($, table, patterns);
  const volumes: VolumeInfo[] = [];

  // Find volume column groups
  const japaneseVolumeIndex = headers.findIndex(h => /japanese.*volume|jp.*vol/i.test(h));
  const englishVolumeIndex = headers.findIndex(h => /english.*volume|en.*vol/i.test(h));

  $(table).find('tr').each((rowIndex, row) => {
    if (rowIndex === 0) return;

    const cells = $(row).find('td, th');

    // Extract Japanese volume
    if (japaneseVolumeIndex >= 0) {
      const jpCell = cells.eq(japaneseVolumeIndex);
      const volumeMatch = patterns.match(jpCell.text(), 'volume');

      if (volumeMatch) {
        const volume: VolumeInfo = {
          volumeNumber: parseInt(volumeMatch.value.toString(), 10),
          japaneseTitle: jpCell.text().trim(),
          chapters: []
        };

        // Extract Japanese ISBN
        const jpIsbnIndex = headers.findIndex(h => /japanese.*isbn|jp.*isbn/i.test(h));
        if (jpIsbnIndex >= 0) {
          const isbnMatch = patterns.match(cells.eq(jpIsbnIndex).text(), 'isbn');
          if (isbnMatch) {
            volume.japaneseIsbn = isbnMatch.value.toString();
          }
        }

        volumes.push(volume);
      }
    }

    // Extract English volume (merge with Japanese if same number)
    if (englishVolumeIndex >= 0) {
      const enCell = cells.eq(englishVolumeIndex);
      const volumeMatch = patterns.match(enCell.text(), 'volume');

      if (volumeMatch) {
        const volumeNum = parseInt(volumeMatch.value.toString(), 10);
        let volume = volumes.find(v => v.volumeNumber === volumeNum);

        if (!volume) {
          volume = {
            volumeNumber: volumeNum,
            chapters: []
          };
          volumes.push(volume);
        }

        volume.title = enCell.text().trim();

        // Extract English ISBN
        const enIsbnIndex = headers.findIndex(h => /english.*isbn|en.*isbn/i.test(h));
        if (enIsbnIndex >= 0) {
          const isbnMatch = patterns.match(cells.eq(enIsbnIndex).text(), 'isbn');
          if (isbnMatch) {
            volume.isbn = isbnMatch.value.toString();
          }
        }
      }
    }
  });

  return volumes.length > 0 ? {
    type: 'volume',
    volumes,
    headers,
    pattern: 'multi-column',
    confidence: 0.85
  } : null;
}

/**
 * Extract rowspan volume chapters
 *
 * Handles volumes spanning multiple chapter rows using rowspan attributes.
 * Tracks rowspan state across rows to correctly associate chapters with volumes.
 */
export function extractRowspanVolumeChapters(
  $: CheerioAPI,
  table: Element,
  _options: ExtractionOptions,
  patterns: PatternLibrary
): TableData | null {
  const headers = extractHeaders($, table, patterns);
  const indices = mapHeaderIndices(headers);
  const volumes: VolumeInfo[] = [];

  // Track rowspan data
  const rowspanTracker: Map<number, { value: string; remainingRows: number }> = new Map();

  $(table).find('tr').each((rowIndex, row) => {
    if (rowIndex === 0) return;

    const cells: ProcessedCell[] = [];
    let cellIndex = 0;

    // Process cells accounting for rowspan
    $(row).find('td, th').each((_, cell) => {
      // Skip columns that have rowspan from previous rows
      while (rowspanTracker.has(cellIndex)) {
        const tracked = rowspanTracker.get(cellIndex);
        if (tracked !== undefined && tracked.remainingRows > 0) {
          cells[cellIndex] = { text: tracked.value, isRowspan: true };
          tracked.remainingRows--;
          if (tracked.remainingRows === 0) {
            rowspanTracker.delete(cellIndex);
          }
          cellIndex++;
        } else {
          break;
        }
      }

      const $cell = $(cell);
      const text = $cell.text().trim();
      const rowspan = parseInt($cell.attr('rowspan') ?? '1', 10);

      cells[cellIndex] = { text, element: cell, rowspan };

      // Track rowspan for future rows
      if (rowspan > 1) {
        rowspanTracker.set(cellIndex, {
          value: text,
          remainingRows: rowspan - 1
        });
      }

      cellIndex++;
    });

    // Process the row data
    const volumeIdx = indices.volume;
    if (volumeIdx !== -1) {
      const volumeCell = cells[volumeIdx];
      if (volumeCell) {
        const volumeMatch = patterns.match(volumeCell.text, 'volume');

        if (volumeMatch && !volumeCell.isRowspan) {
          // New volume
          const titleIdx = indices.title;
          const titleCell = titleIdx !== -1 ? cells[titleIdx] : undefined;
          const titleText = titleCell?.text;
          const volume: VolumeInfo = {
            volumeNumber: parseInt(volumeMatch.value.toString(), 10),
            chapters: []
          };
          if (titleText) {
            volume.title = titleText;
          }
          volumes.push(volume);
        }
      }
    }

    // Add chapter to current volume
    addChapterToCurrentVolume(cells, indices, patterns, volumes);
  });

  return volumes.length > 0 ? {
    type: 'volume',
    volumes,
    headers,
    pattern: 'rowspan',
    confidence: 0.9
  } : null;
}

/**
 * Extract generic table
 *
 * Fallback for tables that don't match specific patterns.
 * Attempts to identify content type based on headers and cell content.
 */
export function extractGenericTable(
  $: CheerioAPI,
  element: Element,
  _options: ExtractionOptions,
  patterns: PatternLibrary
): TableData | null {
  if (!$(element).is('table')) return null;

  const headers = extractHeaders($, element, patterns);
  const rows: string[][] = [];

  $(element).find('tr').each((index, row) => {
    if (index === 0 && headers.length > 0) return;

    const cells = $(row).find('td, th').map((_, cell) =>
      $(cell).text().trim()
    ).get();

    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  // Try to identify content type
  const hasVolumes = headers.some(h => /volume|vol/i.test(h)) ||
                    rows.some(r => r.some(c => patterns.match(c, 'volume') !== null));
  const hasChapters = headers.some(h => /chapter|ch\.|episode/i.test(h)) ||
                     rows.some(r => r.some(c => patterns.match(c, 'chapter') !== null));

  const type = hasVolumes ? 'volume' : hasChapters ? 'chapter' : 'generic';

  return {
    type,
    headers,
    rows,
    pattern: 'generic',
    confidence: 0.5
  };
}
