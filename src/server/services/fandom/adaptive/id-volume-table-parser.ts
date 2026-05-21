/**
 * ID-Based Volume Table Parser for Fandom Wikis
 *
 * Handles wikis where each volume is a separate table with id="Volume_N".
 * Common pattern in One Piece wiki.
 *
 * @module id-volume-table-parser
 */

import { load } from 'cheerio';

import { logger } from '@/utils/logger';

import { isIsbnPrefix } from './utils/isbn-filter';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

/**
 * Chapter from id-based volume table.
 */
export interface IdVolumeChapter {
  number: number;
  title?: string;
  url?: string;
  volumeNumber: number;
}

/**
 * Volume from id-based volume table.
 */
export interface IdVolumeVolume {
  number: number;
  title?: string;
  url?: string;
  coverImage?: string;
  chapters: IdVolumeChapter[];
}

/**
 * Result of id-based volume table parsing.
 */
export interface IdVolumeTableResult {
  volumes: IdVolumeVolume[];
  chapters: IdVolumeChapter[];
  success: boolean;
}

/**
 * Extracts chapter from a list item with format: "N. <a>Title</a>".
 */
function extractChapterFromListItem(
  $: CheerioAPI,
  $li: Cheerio<Element>,
  volumeNumber: number
): IdVolumeChapter | null {
  const text = $li.text().trim();

  // Match pattern: "N. Title" or "N Title"
  const match = text.match(/^(\d+)\.?\s+/);
  if (!match?.[1]) return null;

  const chapterNum = parseInt(match[1], 10);
  if (Number.isNaN(chapterNum) || chapterNum < 0 || chapterNum > 2000) return null;
  if (isIsbnPrefix(chapterNum)) return null;

  // Get title from first link
  const $link = $li.find('a').first();
  let title: string | undefined;
  let url: string | undefined;

  if ($link.length > 0) {
    const href = $link.attr('href') ?? '';
    // Skip links to SBS, Author's Notes, etc.
    if (href.includes('SBS') || href.includes('Author') || href.includes('Special:BookSources')) {
      return null;
    }
    if (href.startsWith('/wiki/Chapter_')) {
      url = href;
    }
    title = $link.text().trim();
  }

  // Clean title - remove Japanese text in parentheses at the end
  if (title) {
    title = title.replace(/\s*\([^)]*\?\s*\)$/, '').trim();
  }

  const chapter: IdVolumeChapter = { number: chapterNum, volumeNumber };
  if (title && title.length > 0) chapter.title = title;
  if (url) chapter.url = url;

  return chapter;
}

/**
 * Parses a single volume table with id="Volume_N".
 */
function parseVolumeTable(
  $: CheerioAPI,
  $table: Cheerio<Element>,
  volumeNumber: number
): IdVolumeVolume {
  const chapters: IdVolumeChapter[] = [];

  // Extract volume link and cover
  let volumeUrl: string | undefined;
  let coverImage: string | undefined;

  const $volumeLink = $table.find('a[href*="/wiki/Volume_"]').first();
  if ($volumeLink.length > 0) {
    const href = $volumeLink.attr('href') ?? '';
    if (href.startsWith('/wiki/Volume_')) {
      volumeUrl = href;
    }
  }

  const $img = $table.find('img').first();
  if ($img.length > 0) {
    coverImage = $img.attr('data-src') ?? $img.attr('src');
  }

  // Extract chapters from list items
  $table.find('ul > li').each((_, li) => {
    const chapter = extractChapterFromListItem($, $(li), volumeNumber);
    if (chapter) {
      chapters.push(chapter);
    }
  });

  const volume: IdVolumeVolume = { number: volumeNumber, chapters };
  if (volumeUrl) volume.url = volumeUrl;
  if (coverImage) volume.coverImage = coverImage;

  return volume;
}

/**
 * Processes a volume table and adds results to accumulators.
 */
function processVolumeTable(
  $: CheerioAPI,
  $table: Cheerio<Element>,
  allVolumes: IdVolumeVolume[],
  allChapters: IdVolumeChapter[],
  seenChapters: Set<number>
): void {
  const id = $table.attr('id') ?? '';
  const match = id.match(/^Volume_(\d+)$/);
  if (!match?.[1]) return;

  const volumeNumber = parseInt(match[1], 10);
  const volume = parseVolumeTable($, $table, volumeNumber);

  if (volume.chapters.length === 0) return;

  allVolumes.push(volume);
  for (const chapter of volume.chapters) {
    if (!seenChapters.has(chapter.number)) {
      seenChapters.add(chapter.number);
      allChapters.push(chapter);
    }
  }
}

/**
 * Checks if HTML has id-based volume table structure.
 */
export function isIdVolumeTableStructure(html: string): boolean {
  const $ = load(html);
  let volumeTableCount = 0;

  $('table[id^="Volume_"]').each((_, table) => {
    const id = $(table).attr('id') ?? '';
    if (/^Volume_\d+$/.test(id)) {
      volumeTableCount++;
    }
  });

  return volumeTableCount >= 5;
}

/**
 * Parses id-based volume table structure from HTML.
 */
export function parseIdVolumeTableStructure(html: string): IdVolumeTableResult {
  const $ = load(html);
  const allVolumes: IdVolumeVolume[] = [];
  const allChapters: IdVolumeChapter[] = [];
  const seenChapters = new Set<number>();

  $('table[id^="Volume_"]').each((_, table) => {
    processVolumeTable($, $(table), allVolumes, allChapters, seenChapters);
  });

  allVolumes.sort((a, b) => a.number - b.number);
  allChapters.sort((a, b) => a.number - b.number);

  logger.info(`[id-volume-parser] Parsed ${allVolumes.length} volumes, ${allChapters.length} chapters`);

  return {
    volumes: allVolumes,
    chapters: allChapters,
    success: allVolumes.length > 0 && allChapters.length > 0,
  };
}
