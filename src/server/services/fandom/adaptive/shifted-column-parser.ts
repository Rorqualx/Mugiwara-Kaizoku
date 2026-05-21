/**
 * Shifted Column Table Parser for Fandom Wikis
 *
 * Handles wikis where table headers don't align with actual data columns.
 * Example: Boruto wiki has headers [Chapter|Title|Arc|Volume|Release]
 * but actual data is [Special|Number|Title+Link|Arc|Volume|Date]
 *
 * @module shifted-column-parser
 */

import { load } from 'cheerio';

import { logger } from '@/utils/logger';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

/**
 * Parsed chapter from shifted column table.
 */
export interface ShiftedColumnChapter {
  number: number;
  title?: string;
  url?: string;
  volumeNumber?: number;
  arc?: string;
  isSpecial?: boolean;
}

/**
 * Parsed volume from shifted column table.
 */
export interface ShiftedColumnVolume {
  number: number;
  title?: string;
  url?: string;
  chapters: ShiftedColumnChapter[];
}

/**
 * Result of shifted column table parsing.
 */
export interface ShiftedColumnParseResult {
  volumes: ShiftedColumnVolume[];
  chapters: ShiftedColumnChapter[];
  success: boolean;
}

/**
 * Context for tracking volume state across rows with rowspan.
 */
interface VolumeContext {
  currentVolume: number | null;
  rowspanRemaining: number;
  volumeMap: Map<number, ShiftedColumnVolume>;
}

/**
 * Extracts chapter title and URL from a cell.
 */
function extractTitleAndUrl(
  $cell: Cheerio<Element>
): { title?: string; url?: string } {
  const $link = $cell.find('a').first();

  if ($link.length > 0) {
    const title = $link.attr('title')?.trim() ?? $link.text().trim();
    const href = $link.attr('href') ?? '';
    const result: { title?: string; url?: string } = { title };
    if (href.startsWith('/wiki/')) {
      result.url = href;
    }
    return result;
  }

  const cellText = $cell.text().trim();
  if (cellText.length > 0 && cellText.length < 100) {
    return { title: cellText };
  }

  return {};
}

/**
 * Extracts volume number from a cell, handling various patterns.
 */
function extractVolumeNumber($cell: Cheerio<Element>): number | null {
  const $link = $cell.find('a');
  const sources = $link.length > 0 ? [$link.text().trim(), $cell.text().trim()] : [$cell.text().trim()];

  for (const text of sources) {
    const match = text.match(/(?:Volume|Vol\.?)\s*(\d+)/i) ?? text.match(/^(\d+)$/);
    if (match?.[1]) return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Updates volume context from a volume cell, handling rowspan.
 */
function updateVolumeContext(
  $cell: Cheerio<Element>,
  ctx: VolumeContext
): void {
  const volumeNumber = extractVolumeNumber($cell);
  if (volumeNumber === null) return;

  // eslint-disable-next-line no-param-reassign -- Context object mutation for state tracking
  ctx.currentVolume = volumeNumber;

  // Extract rowspan for subsequent rows
  const rowspanAttr = $cell.attr('rowspan');
  if (rowspanAttr) {
    // eslint-disable-next-line no-param-reassign -- Context object mutation for state tracking
    ctx.rowspanRemaining = parseInt(rowspanAttr, 10) - 1;
  }

  // Create volume entry if new
  if (!ctx.volumeMap.has(volumeNumber)) {
    const $volumeLink = $cell.find('a');
    const volumeHref = $volumeLink.attr('href') ?? '';
    const volume: ShiftedColumnVolume = { number: volumeNumber, chapters: [] };
    if (volumeHref.startsWith('/wiki/')) {
      volume.url = volumeHref;
    }
    ctx.volumeMap.set(volumeNumber, volume);
  }
}

/**
 * Processes a single data row and returns a chapter if valid.
 * Skips arc summary rows that don't match the chapter pattern.
 */
function processDataRow(
  $: CheerioAPI,
  $row: Cheerio<Element>,
  ctx: VolumeContext
): ShiftedColumnChapter | null {
  const $cells = $row.find('td');
  if ($cells.length < 3) return null;

  // Skip arc summary rows (they have arc name in cell 1, not a number)
  // Check if second cell is numeric or first cell is special type
  const secondCellText = $cells.eq(1).text().trim();
  const isSecondCellNumeric = /^\d+$/.test(secondCellText);
  if (!isSecondCellNumeric) {
    return null;
  }

  let cellIndex = 0;

  // Check if first cell is special type or empty
  const firstCellText = $cells.eq(cellIndex).text().trim();
  const isSpecial = /one-shot|prologue|extra|side/i.test(firstCellText);
  if (firstCellText.length === 0 || isSpecial) {
    cellIndex++;
  }

  // Get chapter number
  const numberText = $cells.eq(cellIndex).text().trim();
  const chapterNumber = parseInt(numberText, 10);
  if (Number.isNaN(chapterNumber)) return null;
  cellIndex++;

  // Get title and URL
  const { title, url } = extractTitleAndUrl($cells.eq(cellIndex));
  cellIndex++;

  // Get arc (optional)
  let arc: string | undefined;
  if ($cells.length > cellIndex) {
    const arcText = $cells.eq(cellIndex).text().trim();
    if (arcText.length > 0 && arcText.length < 50) {
      arc = arcText;
    }
    cellIndex++;
  }

  // Handle volume cell with rowspan
  if (ctx.rowspanRemaining > 0) {
    // eslint-disable-next-line no-param-reassign -- Context object mutation for state tracking
    ctx.rowspanRemaining--;
  } else if ($cells.length > cellIndex) {
    updateVolumeContext($cells.eq(cellIndex), ctx);
  }

  // Build chapter
  const chapter: ShiftedColumnChapter = { number: chapterNumber };
  if (title) chapter.title = title;
  if (url) chapter.url = url;
  if (ctx.currentVolume) chapter.volumeNumber = ctx.currentVolume;
  if (arc) chapter.arc = arc;
  if (isSpecial) chapter.isSpecial = true;

  return chapter;
}

/**
 * Checks if a row matches the shifted column chapter pattern.
 */
function isChapterRow($: CheerioAPI, $row: Cheerio<Element>): boolean {
  const $cells = $row.find('td');
  if ($cells.length < 3) return false;

  const firstCellText = $cells.eq(0).text().trim();
  const isFirstCellEmpty = firstCellText.length === 0;
  const isFirstCellSpecial = /one-shot|prologue|extra|side/i.test(firstCellText);
  const isSecondCellNumeric = /^\d+$/.test($cells.eq(1).text().trim());
  const hasThirdCellLink = $cells.eq(2).find('a').length > 0;

  return (isFirstCellEmpty || isFirstCellSpecial) && isSecondCellNumeric && hasThirdCellLink;
}

/**
 * Detects if a table uses the shifted column pattern.
 * Scans multiple rows to find chapter rows (skipping arc summary rows).
 */
function isShiftedColumnTable($: CheerioAPI, $table: Cheerio<Element>): boolean {
  const headerText = $table.find('tr').first().text().toLowerCase();
  if (!headerText.includes('chapter') || !headerText.includes('title')) {
    return false;
  }

  // Check first 10 data rows for the shifted column pattern
  // (some tables have arc summary rows before actual chapters)
  const $rows = $table.find('tr').slice(1, 11);
  let foundChapterRow = false;

  $rows.each((_, row) => {
    if (isChapterRow($, $(row))) {
      foundChapterRow = true;
      return false; // break
    }
  });

  return foundChapterRow;
}

/**
 * Parses a table with shifted column structure.
 */
function parseShiftedColumnTable(
  $: CheerioAPI,
  $table: Cheerio<Element>
): { volumes: ShiftedColumnVolume[]; chapters: ShiftedColumnChapter[] } {
  const chapters: ShiftedColumnChapter[] = [];
  const ctx: VolumeContext = {
    currentVolume: null,
    rowspanRemaining: 0,
    volumeMap: new Map(),
  };

  $table.find('tr').slice(1).each((_, row) => {
    const chapter = processDataRow($, $(row), ctx);
    if (!chapter) return;

    chapters.push(chapter);
    ctx.volumeMap.get(ctx.currentVolume ?? 0)?.chapters.push(chapter);
  });

  const volumes = Array.from(ctx.volumeMap.values()).sort((a, b) => a.number - b.number);
  return { volumes, chapters };
}

/**
 * Checks if HTML contains shifted column table structure.
 */
export function isShiftedColumnStructure(html: string): boolean {
  const $ = load(html);
  const $tables = $('.mw-parser-output').find('table.wikitable, table.article-table');

  let found = false;
  $tables.each((_, table) => {
    if (isShiftedColumnTable($, $(table))) {
      found = true;
      return false;
    }
  });

  return found;
}

/**
 * Applies offset to a chapter's numbers.
 */
function applyChapterOffset(
  chapter: ShiftedColumnChapter,
  chapterOffset: number,
  volumeOffset: number
): ShiftedColumnChapter {
  const result: ShiftedColumnChapter = { ...chapter, number: chapter.number + chapterOffset };
  if (chapter.volumeNumber !== undefined) {
    result.volumeNumber = chapter.volumeNumber + volumeOffset;
  }
  return result;
}

/**
 * Applies offset to a volume and its chapters.
 */
function applyVolumeOffset(
  volume: ShiftedColumnVolume,
  chapterOffset: number,
  volumeOffset: number
): ShiftedColumnVolume {
  return {
    ...volume,
    number: volume.number + volumeOffset,
    chapters: volume.chapters.map((ch) => applyChapterOffset(ch, chapterOffset, volumeOffset)),
  };
}

/**
 * Checks if a table should be parsed (skips small/arc summary tables).
 */
function shouldParseTable($table: Cheerio<Element>): boolean {
  const tableText = $table.text();
  if (tableText.length < 100) return false;
  if (/arc summary/i.test(tableText) && !/chapter/i.test(tableText.slice(0, 200))) return false;
  return true;
}

/**
 * Parses shifted column table structure from HTML.
 * Handles multi-part series by continuing chapter numbering across tables.
 */
export function parseShiftedColumnStructure(html: string): ShiftedColumnParseResult {
  const $ = load(html);
  const allChapters: ShiftedColumnChapter[] = [];
  const allVolumes: ShiftedColumnVolume[] = [];
  let chapterOffset = 0;
  let volumeOffset = 0;

  const $tables = $('.mw-parser-output').find('table.wikitable, table.article-table');
  logger.debug(`[shifted-column-parser] Found ${$tables.length} potential tables`);

  $tables.each((idx, table) => {
    const $table = $(table);
    if (!shouldParseTable($table) || !isShiftedColumnTable($, $table)) return;

    logger.debug(`[shifted-column-parser] Parsing table ${idx + 1} (offset: ch=${chapterOffset})`);
    const result = parseShiftedColumnTable($, $table);

    // Apply offsets and collect chapters
    let maxChapter = chapterOffset;
    for (const chapter of result.chapters) {
      const adjusted = applyChapterOffset(chapter, chapterOffset, volumeOffset);
      maxChapter = Math.max(maxChapter, adjusted.number);
      allChapters.push(adjusted);
    }

    // Apply offsets and collect volumes
    let maxVolume = volumeOffset;
    for (const volume of result.volumes) {
      const adjusted = applyVolumeOffset(volume, chapterOffset, volumeOffset);
      maxVolume = Math.max(maxVolume, adjusted.number);
      allVolumes.push(adjusted);
    }

    // Update offsets for next table (Part 1 -> Part 2 continuation)
    if (result.chapters.length > 0) {
      chapterOffset = maxChapter;
      volumeOffset = maxVolume;
    }
  });

  allChapters.sort((a, b) => a.number - b.number);
  allVolumes.sort((a, b) => a.number - b.number);

  logger.info(`[shifted-column-parser] Parsed ${allVolumes.length} volumes, ${allChapters.length} chapters`);

  return { volumes: allVolumes, chapters: allChapters, success: allChapters.length > 0 };
}
