/**
 * Table Extractor - Volume Extractors
 *
 * Functions for extracting volume data from standard tables,
 * tankobon lists, and omnibus editions.
 *
 * Extracted from: TableExtractor.ts (lines 411-506, 849-898)
 */

import type { PatternLibrary } from '@/server/parsers/patterns/PatternLibrary';

import {
  extractHeaders,
  mapHeaderIndices,
  extractCellImage,
  type HeaderIndices,
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

/** Parsed cell data from a table row */
interface CellData {
  text: string;
  element: Element;
  rowspan: number;
  colspan: number;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Matches title cells whose entire text is just a localized "Volume N" label
 * (German "Band 1", French/Italian "Tome 3", Spanish "Tomo 5", Japanese
 * "第1巻" / "巻1", Korean "제1권", English "Volume 7" / "Vol. 2"). These are
 * placeholders, not real volume subtitles like "Adolla" — reject them so
 * downstream consumers fall back to a NULL title.
 */
const PLACEHOLDER_VOLUME_TITLE = /^(?:(?:band|volume|vol\.?|tome|tomo|tankoubon|tankobon)\s*\d+(?:\.\d+)?|巻\s*\d+|제\s*\d+\s*권|第\s*\d+\s*巻)$/i;

export function isPlaceholderVolumeTitle(text: string): boolean {
  return PLACEHOLDER_VOLUME_TITLE.test(text.trim());
}

/** Process a volume row and create volume info */
function processVolumeRow(
  cells: CellData[],
  indices: HeaderIndices,
  patterns: PatternLibrary
): VolumeInfo | null {
  const volumeIndex = indices.volume;
  if (volumeIndex === -1) return null;

  const cellText = cells[volumeIndex]?.text ?? '';
  const volumeMatch = patterns.match(cellText, 'volume');

  if (!volumeMatch) return null;

  // Extract title if available
  const titleIndex = indices.title;
  const titleText = titleIndex !== -1 ? cells[titleIndex]?.text : undefined;

  const volume: VolumeInfo = {
    volumeNumber: parseInt(volumeMatch.value.toString(), 10),
    chapters: []
  };

  if (titleText && !isPlaceholderVolumeTitle(titleText)) {
    volume.title = titleText;
  }

  return volume;
}

/** Additional fields extracted from volume row cells */
interface ExtractedVolumeFields {
  isbn?: string;
  releaseDate?: string;
  coverImage?: string;
}

/** Extract additional volume fields (ISBN, date, image) */
function extractVolumeFields(
  $: CheerioAPI,
  cells: CellData[],
  indices: HeaderIndices,
  patterns: PatternLibrary
): ExtractedVolumeFields {
  const fields: ExtractedVolumeFields = {};

  // Extract ISBN
  const isbnIndex = indices.isbn;
  if (isbnIndex !== -1) {
    const isbnMatch = patterns.match(cells[isbnIndex]?.text ?? '', 'isbn');
    if (isbnMatch) {
      fields.isbn = isbnMatch.value.toString();
    }
  }

  // Extract release date
  const releaseDateIndex = indices.releaseDate;
  if (releaseDateIndex !== -1) {
    const dateMatch = patterns.match(cells[releaseDateIndex]?.text ?? '', 'date');
    if (dateMatch) {
      fields.releaseDate = dateMatch.value.toString();
    }
  }

  // Extract cover image
  const coverImageIndex = indices.coverImage;
  if (coverImageIndex !== -1) {
    fields.coverImage = extractCellImage($, cells[coverImageIndex]?.element);
  }

  return fields;
}

/** Process a chapter row and return chapter info */
function processChapterRow(
  cells: CellData[],
  indices: HeaderIndices,
  currentVolume: VolumeInfo,
  patterns: PatternLibrary
): ChapterInfo | null {
  const chapterIndex = indices.chapter;
  if (chapterIndex === -1) return null;

  const chapterMatch = patterns.match(cells[chapterIndex]?.text ?? '', 'chapter');
  if (!chapterMatch) return null;

  const chapterTitleIndex = indices.chapterTitle;
  const titleText = chapterTitleIndex !== -1 ? cells[chapterTitleIndex]?.text : undefined;

  const chapter: ChapterInfo = {
    chapterNumber: chapterMatch.value.toString(),
    volumeNumber: currentVolume.volumeNumber
  };

  if (titleText) {
    chapter.title = titleText;
  }

  return chapter;
}

/** Parse cells from a table row */
function parseCellsFromRow($: CheerioAPI, row: Element): CellData[] {
  return $(row).find('td, th').map((_, cell) => ({
    text: $(cell).text().trim(),
    element: cell,
    rowspan: parseInt($(cell).attr('rowspan') ?? '1', 10),
    colspan: parseInt($(cell).attr('colspan') ?? '1', 10)
  })).get() as CellData[];
}

// ============================================================================
// Volume Extractors
// ============================================================================

/**
 * Extract standard volume table. Handles tables with volume and chapter columns.
 */
export function extractStandardVolumeTable(
  $: CheerioAPI,
  table: Element,
  _options: ExtractionOptions,
  patterns: PatternLibrary
): TableData | null {
  const headers = extractHeaders($, table, patterns);
  const indices = mapHeaderIndices(headers);
  const volumes: VolumeInfo[] = [];
  let currentVolume: VolumeInfo | null = null;

  $(table).find('tr').each((rowIndex, row) => {
    // Skip header row
    if (rowIndex === 0 && headers.length > 0) return;

    const cells = parseCellsFromRow($, row);

    // Check if this is a volume row
    const newVolume = processVolumeRow(cells, indices, patterns);
    if (newVolume) {
      // Save previous volume
      if (currentVolume) {
        volumes.push(currentVolume);
      }

      // Set new volume and extract additional fields
      currentVolume = newVolume;
      const fields = extractVolumeFields($, cells, indices, patterns);
      if (fields.isbn) {
        currentVolume.isbn = fields.isbn;
      }
      if (fields.releaseDate) {
        currentVolume.releaseDate = fields.releaseDate;
      }
      if (fields.coverImage) {
        currentVolume.coverImage = fields.coverImage;
      }
    }

    // Check if this is a chapter row
    if (currentVolume) {
      const chapter = processChapterRow(cells, indices, currentVolume, patterns);
      if (chapter) {
        currentVolume.chapters.push(chapter);
      }
    }
  });

  // Add last volume
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (currentVolume) {
    volumes.push(currentVolume);
  }

  return volumes.length > 0 ? {
    type: 'volume',
    volumes,
    headers,
    confidence: 0.95
  } : null;
}

/**
 * Extract tankobon volumes. Similar to standard volume extraction with tankobon patterns.
 */
export function extractTankobon(
  $: CheerioAPI,
  element: Element,
  options: ExtractionOptions,
  patterns: PatternLibrary
): TableData | null {
  const result = extractStandardVolumeTable($, element, options, patterns);
  if (result) {
    result.pattern = 'tankobon';
    return result;
  }
  return null;
}

/**
 * Extract omnibus editions. Looks for patterns like "Omnibus 1" or "3-in-1 Edition 1".
 */
export function extractOmnibusEditions(
  $: CheerioAPI,
  element: Element,
  _options: ExtractionOptions
): TableData | null {
  const volumes: VolumeInfo[] = [];

  // Look for omnibus patterns
  $(element).find('tr, li, .omnibus-item').each((_, item) => {
    const text = $(item).text();
    const omnibusMatch = text.match(/Omnibus\s+(\d+)|(\d+)-in-1\s+Edition\s+(\d+)/i);

    if (omnibusMatch) {
      const omnibusNumStr = omnibusMatch[1] ?? omnibusMatch[3];
      if (!omnibusNumStr) return;
      const omnibusNum = parseInt(omnibusNumStr, 10);

      // Extract contained volumes
      const volumeRange = text.match(/Volume(?:s)?\s+([\d.-]+)\s*[-\u2013]\s*([\d.-]+)/i);

      const volume: VolumeInfo = {
        volumeNumber: omnibusNum,
        title: text.trim(),
        chapters: [],
        additionalInfo: {
          type: 'omnibus',
          containedVolumes: volumeRange ? `${volumeRange[1]}-${volumeRange[2]}` : undefined
        }
      };

      volumes.push(volume);
    }
  });

  return volumes.length > 0 ? {
    type: 'volume',
    volumes,
    pattern: 'omnibus',
    confidence: 0.8
  } : null;
}
