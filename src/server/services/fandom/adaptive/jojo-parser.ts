/**
 * JoJo's Bizarre Adventure Parser
 *
 * Specialized parser for the JoJo wiki which uses a unique structure:
 * - Volume headers in tables with "Volume N:" format
 * - Chapter lists in adjacent tables with <ul><li>NNN. Title</li></ul> format
 *
 * @module jojo-parser
 */

import { load } from 'cheerio';

import { logger } from '@/utils/logger';

import { isIsbnPrefix } from './utils/isbn-filter';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

/** Volume from JoJo parser */
export interface JoJoVolume {
  number: number;
  title?: string;
}

/** Chapter from JoJo parser */
export interface JoJoChapter {
  number: number;
  title?: string;
  volumeNumber: number;
}

/** Result of JoJo parsing */
export interface JoJoParseResult {
  volumes: JoJoVolume[];
  chapters: JoJoChapter[];
  success: boolean;
}

/**
 * Extracts chapters from a table cell containing <ul><li>NNN. Title</li></ul>.
 */
function extractChaptersFromCell(cellHtml: string, volumeNumber: number): JoJoChapter[] {
  const chapters: JoJoChapter[] = [];
  const $cell = load(cellHtml);

  $cell('ul li').each((_, li) => {
    const text = $cell(li).text().trim();
    const match = text.match(/^(\d+)\.\s+(.+?)(?:\s*\(|$)/);
    if (!match?.[1]) return;

    const num = parseInt(match[1], 10);
    if (Number.isNaN(num) || num < 0 || num > 2000) return;
    if (isIsbnPrefix(num)) return;

    const title = match[2]?.trim();
    const chapter: JoJoChapter = { number: num, volumeNumber };
    if (title && title.length > 0 && title.length < 200) {
      chapter.title = title;
    }
    chapters.push(chapter);
  });

  return chapters;
}

/**
 * Processes chapters from a chapter table and adds them to the collection.
 */
function processChapterTable(
  $: CheerioAPI,
  $chapterTable: Cheerio<Element>,
  volumeNumber: number,
  chapters: JoJoChapter[],
  seenChapters: Set<number>
): void {
  const chapterCells = $chapterTable.find('td').filter((_, td) => {
    return $(td).find('ul li').length > 0;
  });

  chapterCells.each((_, td) => {
    const cellHtml = $(td).html() ?? '';
    const cellChapters = extractChaptersFromCell(cellHtml, volumeNumber);
    for (const ch of cellChapters) {
      if (!seenChapters.has(ch.number)) {
        seenChapters.add(ch.number);
        chapters.push(ch);
      }
    }
  });
}

/**
 * Processes a volume table and extracts volume + chapter data.
 */
// eslint-disable-next-line max-params -- Volume table processing requires Cheerio, collections, and dedup sets
function processVolumeTable(
  $: CheerioAPI,
  $table: Cheerio<Element>,
  volumes: JoJoVolume[],
  chapters: JoJoChapter[],
  seenVolumes: Set<number>,
  seenChapters: Set<number>
): void {
  const tableHtml = $table.html() ?? '';
  const volumeMatch = tableHtml.match(/Volume\s+(\d+)\s*:/);
  if (!volumeMatch?.[1]) return;

  const volumeNumber = parseInt(volumeMatch[1], 10);
  // Allow Volume 0 for prequels (e.g., JJK 0)
  if (Number.isNaN(volumeNumber) || volumeNumber < 0 || volumeNumber > 200) return;

  // Add volume if not seen
  if (!seenVolumes.has(volumeNumber)) {
    seenVolumes.add(volumeNumber);
    const $volumeLink = $table.find('a[href*="/wiki/Volume_"]').first();
    const titleText = $volumeLink.text().trim();
    const title = titleText.length > 0 ? titleText : undefined;
    const vol: JoJoVolume = { number: volumeNumber };
    if (title) vol.title = title;
    volumes.push(vol);
  }

  // Look for chapter list in the next table
  const $chapterTable = $table.next('table');
  if ($chapterTable.length > 0) {
    processChapterTable($, $chapterTable, volumeNumber, chapters, seenChapters);
  }
}

/**
 * Parses JoJo wiki page for volumes and chapters.
 */
export function parseJoJoStructure(html: string): JoJoParseResult {
  const $ = load(html);
  const volumes: JoJoVolume[] = [];
  const chapters: JoJoChapter[] = [];
  const seenVolumes = new Set<number>();
  const seenChapters = new Set<number>();

  $('table').each((_, table) => {
    processVolumeTable($, $(table), volumes, chapters, seenVolumes, seenChapters);
  });

  volumes.sort((a, b) => a.number - b.number);
  chapters.sort((a, b) => a.number - b.number);

  logger.info(`[jojo-parser] Parsed ${volumes.length} volumes, ${chapters.length} chapters`);

  return {
    volumes,
    chapters,
    success: volumes.length > 0 && chapters.length > 0,
  };
}

/**
 * Checks if HTML has JoJo's distinctive structure.
 */
export function isJoJoStructure(html: string): boolean {
  const $ = load(html);

  let volumeCount = 0;
  $('table').each((_, table) => {
    const text = $(table).text();
    if (/Volume\s+\d+\s*:/.test(text)) {
      volumeCount++;
    }
  });

  const hasChapterLists = $('ul li').filter((_, li) => {
    return /^\d+\.\s+/.test($(li).text().trim());
  }).length > 10;

  return volumeCount >= 10 && hasChapterLists;
}
