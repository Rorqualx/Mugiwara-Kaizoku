/**
 * Numbered Row Parser for Fandom Wikis
 *
 * Handles wikis that use a numbered row format where each table represents one volume,
 * with the volume number in the first column (not as "Volume X" but as a plain number).
 * Examples: Bleach
 *
 * Structure pattern:
 * <table>
 *   <tr><td>#</td><td>Japanese</td><td>English</td>...</tr>
 *   <tr><td>1</td><td>Jan 5, 2002</td>...</tr>
 *   <tr><td colspan="5">Chapters list: 001. Title 002. Title</td></tr>
 * </table>
 *
 * @module numbered-row-parser
 */

import { load } from 'cheerio';

import { logger } from '@/utils/logger';

import { isIsbnPrefix } from './utils/isbn-filter';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

/**
 * Builds an absolute URL from a relative href.
 */
function buildAbsoluteUrl(href: string, baseUrl?: string): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/') && baseUrl) return `${baseUrl}${href}`;
  return undefined;
}

/**
 * Parsed volume from numbered row structure.
 */
export interface NumberedRowVolume {
  number: number;
  title?: string;
  description?: string;
  releaseDate?: string;
  releaseDateEn?: string;
  isbn?: string;
  isbnEn?: string;
  coverImage?: string;
  /** URL to the individual volume page (e.g., /wiki/THE_DEATH_AND_THE_STRAWBERRY_(Volume_1)) */
  url?: string;
  pages?: number;
  chapters: NumberedRowChapter[];
}

/**
 * Parsed chapter from numbered row.
 */
export interface NumberedRowChapter {
  number: number;
  title?: string;
  url?: string;
  volumeNumber: number;
}

/**
 * Result of numbered row parsing.
 */
export interface NumberedRowParseResult {
  volumes: NumberedRowVolume[];
  chapters: NumberedRowChapter[];
  success: boolean;
}

/**
 * Extracts chapters from "Chapters list: 001. Title 002. Title" format.
 * Now also extracts URLs from links in the row.
 */
function extractChaptersFromList(
  rawText: string,
  volumeNumber: number,
  urlMap: Map<number, string>
): NumberedRowChapter[] {
  const chapters: NumberedRowChapter[] = [];
  const seenChapters = new Set<number>();

  // Trim trailing volume title text (ALL CAPS block after the last chapter)
  // e.g., "\n007. Title\n\n\nTHE DEATH AND THE STRAWBERRY" → "\n007. Title"
  const text = rawText.replace(/\n[A-Z][A-Z\s&'.,!?:*-]{3,}$/, '').trimEnd();

  // Match patterns like "001. Title", "-108. Title", "088.5. Title", "001. 25:00 gathering"
  // Require space after dot (prevents matching decimals like "88.5" as chapter+title)
  // Allow ANY characters in title including digits (handles "25:00 gathering", "Lesson2-2")
  // Lookahead: next chapter boundary is space + number + dot + space, or end of string
  const chapterPattern = /(-?\d{1,4}(?:\.\d)?)\.\s+(.+?)(?=\s+-?\d{1,4}(?:\.\d)?\.\s|\s*$)/g;

  let match;
  while ((match = chapterPattern.exec(text)) !== null) {
    const numStr = match[1];
    if (!numStr) continue;
    const chapterNum = parseFloat(numStr);
    if (isIsbnPrefix(chapterNum)) continue;
    if (seenChapters.has(chapterNum)) continue;

    // URL is optional — chapters without wiki page links are still valid
    const url = urlMap.get(chapterNum);

    seenChapters.add(chapterNum);
    const title = match[2]?.trim();

    const chapter: NumberedRowChapter = {
      number: chapterNum,
      volumeNumber,
    };

    if (url) chapter.url = url;

    if (title && title.length > 0 && title.length < 200) {
      chapter.title = title;
    }

    chapters.push(chapter);
  }

  return chapters;
}

/**
 * Extracts chapter URLs from links in a row.
 * Looks for links with chapter numbers in href or text.
 */
function extractChapterUrlsFromRow(
  $: CheerioAPI,
  $row: Cheerio<Element>,
  baseUrl?: string
): Map<number, string> {
  const urlMap = new Map<number, string>();

  $row.find('a[href*="/wiki/"]').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();

    // Try to extract chapter number from link text (e.g., "001. Title", "-108. Title", "088.5. Title")
    const textMatch = text.match(/^(-?\d{1,4}(?:\.\d)?)\./);
    if (textMatch?.[1]) {
      const chapterNum = parseFloat(textMatch[1]);
      const url = buildAbsoluteUrl(href, baseUrl);
      if (url) urlMap.set(chapterNum, url);
      return;
    }

    // Try to extract chapter number from URL anchor (e.g., #001._Title, #-108._Title, #088.5._Title)
    const anchorMatch = href.match(/#(-?\d{1,4}(?:\.\d)?)\./);
    if (anchorMatch?.[1]) {
      const chapterNum = parseFloat(anchorMatch[1]);
      const url = buildAbsoluteUrl(href, baseUrl);
      if (url) urlMap.set(chapterNum, url);
    }
  });

  return urlMap;
}

/** Mutable state tracked between rows while parsing a table */
interface RowParserState {
  currentVolumeNumber: number | null;
  currentReleaseDateJp: string | undefined;
  currentIsbnJp: string | undefined;
  currentReleaseDateEn: string | undefined;
  currentIsbnEn: string | undefined;
}

/**
 * Extracts JP/EN release dates and ISBNs from a volume number row's cells.
 * Bleach table structure: [#] [JP Release Date] [JP ISBN] [EN Release Date] [EN ISBN]
 */
function extractReleaseDatesAndIsbns(
  $cells: Cheerio<Element>,
  state: RowParserState
): void {
  state.currentReleaseDateJp = undefined;
  state.currentIsbnJp = undefined;
  state.currentReleaseDateEn = undefined;
  state.currentIsbnEn = undefined;

  if ($cells.length >= 3) {
    const jpDate = $cells.eq(1).text().trim();
    if (jpDate && jpDate.length > 0) state.currentReleaseDateJp = jpDate;
    const jpIsbn = $cells.eq(2).text().trim();
    if (jpIsbn && /[\d-]{10,}/.test(jpIsbn)) state.currentIsbnJp = jpIsbn;
  }
  if ($cells.length >= 5) {
    const enDate = $cells.eq(3).text().trim();
    if (enDate && enDate.length > 0) state.currentReleaseDateEn = enDate;
    const enIsbn = $cells.eq(4).text().trim();
    if (enIsbn && /[\d-]{10,}/.test(enIsbn)) state.currentIsbnEn = enIsbn;
  }
}

/**
 * Builds a NumberedRowVolume from a "Chapters list:" row.
 */
function buildVolumeFromChaptersRow(
  $: CheerioAPI,
  $row: Cheerio<Element>,
  rowText: string,
  state: RowParserState,
  baseUrl?: string
): NumberedRowVolume | null {
  if (state.currentVolumeNumber === null) return null;

  const chaptersMatch = rowText.match(/Chapters list:([^]*?)(?:Cover character:|Pages:|$)/i);

  // Extract volume page URL from the first non-image wiki link in this row.
  // Chapter links often include anchors (e.g., /wiki/VOLUME_TITLE#001._Chapter) —
  // strip the anchor to get the volume page URL.
  let volumePageUrl: string | undefined;
  $row.find('a[href*="/wiki/"]').each((_, link) => {
    if (volumePageUrl) return;
    const $link = $(link);
    if ($link.find('img').length > 0) return; // skip image-wrapping links
    const href = ($link.attr('href') ?? '').split('#')[0]; // strip anchor
    if (!href) return;
    volumePageUrl = buildAbsoluteUrl(href, baseUrl) ?? undefined;
  });

  const urlMap = extractChapterUrlsFromRow($, $row, baseUrl);
  const chapters: NumberedRowChapter[] = [];
  if (chaptersMatch?.[1]) {
    chapters.push(...extractChaptersFromList(chaptersMatch[1], state.currentVolumeNumber, urlMap));
  }

  // Extract title (usually ALL CAPS text before Cover character)
  const titleMatch = rowText.match(/([A-Z][A-Z\s&'.,!?-]+)(?:Cover character:|Pages:)/);
  const title = titleMatch?.[1]?.trim();

  const $img = $row.find('img').first();
  const coverImage = $img.attr('data-src') ?? $img.attr('src');

  const volume: NumberedRowVolume = { number: state.currentVolumeNumber, chapters };
  if (title && title.length < 100) volume.title = title;
  if (coverImage) volume.coverImage = coverImage;
  if (volumePageUrl) volume.url = volumePageUrl;
  if (state.currentReleaseDateJp) volume.releaseDate = state.currentReleaseDateJp;
  if (state.currentIsbnJp) volume.isbn = state.currentIsbnJp;
  if (state.currentReleaseDateEn) volume.releaseDateEn = state.currentReleaseDateEn;
  if (state.currentIsbnEn) volume.isbnEn = state.currentIsbnEn;

  const pagesMatch = rowText.match(/Pages:\s*(\d+)/i);
  if (pagesMatch?.[1]) {
    const p = parseInt(pagesMatch[1], 10);
    if (p > 0 && p < 2000) volume.pages = p;
  }

  return volume;
}

/**
 * Parses volumes from a table where each row (or group of rows) represents one volume.
 * Bleach uses this format: multiple volumes per table, each with a "Chapters list:" row.
 */
function parseVolumesFromTable(
  $: CheerioAPI,
  $table: Cheerio<Element>,
  baseUrl?: string
): NumberedRowVolume[] {
  const volumes: NumberedRowVolume[] = [];
  const $rows = $table.find('> tbody > tr, > tr');
  const state: RowParserState = {
    currentVolumeNumber: null,
    currentReleaseDateJp: undefined,
    currentIsbnJp: undefined,
    currentReleaseDateEn: undefined,
    currentIsbnEn: undefined,
  };

  let lastVolume: NumberedRowVolume | null = null;
  let expectDescription = false;

  $rows.each((_, row) => {
    const $row = $(row);
    const rowText = $row.text();

    // Check if this row has a volume number in the first cell
    const $firstCell = $row.find('td, th').first();
    const cellText = $firstCell.text().trim();
    const volumeMatch = cellText.match(/^(\d{1,3})$/);

    if (volumeMatch?.[1]) {
      state.currentVolumeNumber = parseInt(volumeMatch[1], 10);
      extractReleaseDatesAndIsbns($row.find('td, th'), state);
      expectDescription = false;
    } else if (rowText.includes('Chapters list:')) {
      const volume = buildVolumeFromChaptersRow($, $row, rowText, state, baseUrl);
      if (volume) {
        volumes.push(volume);
        lastVolume = volume;
        expectDescription = true;
      }
    } else if (expectDescription && lastVolume) {
      // Description row: single <td colspan="5"> with the volume synopsis
      const $cells = $row.find('td');
      if ($cells.length === 1) {
        const desc = $cells.first().text().trim();
        if (desc.length > 30) {
          lastVolume.description = desc;
        }
      }
      expectDescription = false;
    }
  });

  return volumes;
}

/**
 * Parses numbered row structure from HTML.
 *
 * @param html - HTML content to parse
 * @param baseUrl - Base URL of the wiki (e.g., https://bleach.fandom.com)
 * @returns Parsed volumes and chapters
 */
export function parseNumberedRowStructure(html: string, baseUrl?: string): NumberedRowParseResult {
  const $ = load(html);
  const volumes: NumberedRowVolume[] = [];
  const allChapters: NumberedRowChapter[] = [];
  const seenVolumes = new Set<number>();

  // Find all tables in content area
  const $content = $('.mw-parser-output');
  const $tables = $content.find('table').not('.navbox').not('.toc');

  logger.debug(`[numbered-row-parser] Found ${$tables.length} tables`);

  $tables.each((_, table) => {
    const $table = $(table);
    const tableVolumes = parseVolumesFromTable($, $table, baseUrl);

    for (const volume of tableVolumes) {
      if (!seenVolumes.has(volume.number)) {
        seenVolumes.add(volume.number);
        volumes.push(volume);
        allChapters.push(...volume.chapters);
      }
    }
  });

  // Sort by volume number
  volumes.sort((a, b) => a.number - b.number);
  allChapters.sort((a, b) => a.number - b.number);

  logger.info(`[numbered-row-parser] Parsed ${volumes.length} volumes, ${allChapters.length} chapters`);

  return {
    volumes,
    chapters: allChapters,
    success: volumes.length > 0,
  };
}

/**
 * Checks if a page uses numbered row structure.
 *
 * @param html - HTML content to check
 * @returns true if the page has tables with "Chapters list:" format
 */
export function isNumberedRowStructure(html: string): boolean {
  const $ = load(html);

  const $content = $('.mw-parser-output');
  const $tables = $content.find('table').not('.navbox');

  let hasChaptersList = false;
  $tables.each((_, table) => {
    const text = $(table).text();
    if (text.includes('Chapters list:')) {
      hasChaptersList = true;
      return false; // break
    }
  });

  return hasChaptersList;
}
