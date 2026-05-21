/**
 * Fandom Chapter Parser
 *
 * Parses chapter tables from Fandom wiki pages to extract chapter numbers,
 * titles, URLs, and cover images.
 *
 * Extracted from: fandomTableParser.ts (lines 718-817)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import { extractChapterNumber as extractChapterNumberShared } from './chapter-extraction';
import { ChapterData } from './fandom-types';

import type { AnyNode, Element } from 'domhandler';

/** Check if a table is a navigation/infobox/toccolours table */
function isNavOrInfoTable($table: cheerio.Cheerio<AnyNode>): boolean {
  return $table.hasClass('navbox') || $table.hasClass('infobox') || $table.hasClass('toccolours');
}

/**
 * Extracts chapter number from cell text using shared extraction utility
 * Handles regular chapters (Chapter 1, Ch. 1, #1), special chapters (Epilogue, Prologue, etc.),
 * naming conventions (Stage, Mission, Episode), and Volume 0 prequel format (Chapter 0-1, etc.)
 */
function extractChapterNumber(chapterText: string): number | null {
  const result = extractChapterNumberShared(chapterText);
  return result?.number ?? null;
}

/**
 * Extracts volume number from cell text
 */
function extractVolumeNumber(chapterText: string): number | undefined {
  const volumeMatch = chapterText.match(/Volume\s+(\d+)/i);
  return volumeMatch?.[1] ? parseInt(volumeMatch[1], 10) : undefined;
}

/**
 * Cleans and formats image URL
 */
function cleanImageUrl(url: string): string {
  let cleanUrl = url;

  // Remove any scale parameters to get full image
  cleanUrl = cleanUrl.replace(/\/scale-to-width-down\/\d+/, '');
  cleanUrl = cleanUrl.replace(/\/revision\/latest.*/, '/revision/latest');

  // Ensure it's an absolute URL
  if (!cleanUrl.startsWith('http')) {
    cleanUrl = cleanUrl.startsWith('//') ? `https:${cleanUrl}` : `https://${cleanUrl}`;
  }

  return cleanUrl;
}

/**
 * Extracts cover image from row
 */
function extractCoverImage(
  $row: cheerio.Cheerio<AnyNode>,
  chapterNumber: number
): string | undefined {
  const $img = $row.find('img').first();

  // Debug logging
  logger.info(`[parseChapterTables] Chapter ${chapterNumber}:`, {
    hasImg: $img.length > 0,
    imgAttrs: $img.length ? {
      src: $img.attr('src'),
      'data-src': $img.attr('data-src'),
      'data-image-url': $img.attr('data-image-url'),
      'data-image-key': $img.attr('data-image-key'),
      class: $img.attr('class'),
      alt: $img.attr('alt')
    } : 'no image found',
    rowHtml: $row.html()?.substring(0, 200) // First 200 chars
  });

  if (!$img.length) return undefined;

  const rawCoverImage = $img.attr('data-src') ??
                        $img.attr('data-image-url') ??
                        $img.attr('src');

  if (!rawCoverImage) return undefined;

  const cleanedUrl = cleanImageUrl(rawCoverImage);
  logger.info(`[parseChapterTables] Chapter ${chapterNumber} cover found:`, cleanedUrl);

  return cleanedUrl;
}

/**
 * Formats chapter URL to absolute URL
 * @param url - The relative or absolute URL
 * @param baseUrl - Base URL of the wiki (e.g., https://dandadan.fandom.com)
 */
function formatChapterUrl(url: string | undefined, baseUrl?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  // Require baseUrl for relative URLs - no hardcoded fallback
  if (!baseUrl) {
    logger.warn('[formatChapterUrl] Relative URL without baseUrl, returning undefined', { url });
    return undefined;
  }
  return `${baseUrl}${url}`;
}

/**
 * Parses a single table row to extract chapter data
 */
function parseChapterRow(
  $: cheerio.CheerioAPI,
  row: Element,
  baseUrl?: string
): ChapterData | null {
  const $cells = $(row).find('td');
  if ($cells.length < 2) return null;

  // Extract chapter number
  const chapterText = $cells.text();
  const chapterNumber = extractChapterNumber(chapterText);
  if (chapterNumber === null) return null;

  // Extract title
  const $link = $cells.find('a').first();
  const title = $link.text().trim() || `Chapter ${chapterNumber}`;
  const url = $link.attr('href');

  // Extract cover image from the row
  const coverImage = extractCoverImage($(row), chapterNumber);

  // Extract volume if present
  const volumeNum = extractVolumeNumber(chapterText);

  // Build chapter data
  const chapter: ChapterData = {
    number: chapterNumber,
    title,
  };

  if (volumeNum !== undefined) chapter.volume = volumeNum;
  const chapterUrl = formatChapterUrl(url, baseUrl);
  if (chapterUrl !== undefined) chapter.url = chapterUrl;
  if (coverImage !== undefined) chapter.coverImage = coverImage;

  return chapter;
}

/**
 * Parses chapters from a single table element
 */
function parseChaptersFromTable(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<AnyNode>,
  baseUrl?: string
): ChapterData[] {
  const chapters: ChapterData[] = [];

  // Skip navigation and infobox tables
  if (isNavOrInfoTable($table)) {
    return chapters;
  }

  // Check if this is a chapter table
  const headers = $table.find('th').text().toLowerCase();
  if (!headers.includes('chapter') && !headers.includes('ch.')) {
    return chapters;
  }

  // Parse rows (skip header row at index 0)
  $table.find('tr').each((index, row) => {
    if (index === 0) return;
    const chapter = parseChapterRow($, row as Element, baseUrl);
    if (chapter) chapters.push(chapter);
  });

  return chapters;
}

/**
 * Merges chapter data, returning a new chapter with filled-in fields
 */
function mergeChapterData(existing: ChapterData, newChapter: ChapterData): ChapterData {
  const merged: ChapterData = { ...existing };

  // Prefer existing title unless it's a placeholder (empty, "Chapter N", or bare number like "1")
  // Bare-number titles come from navigation tables (e.g., toccolours) that list chapters as "1 • 2 • 3"
  const existingIsPlaceholder = !existing.title
    || existing.title === `Chapter ${newChapter.number}`
    || /^\d+$/.test(existing.title);
  if (existingIsPlaceholder && newChapter.title) {
    merged.title = newChapter.title;
  }
  // Add URL if missing
  if (!existing.url && newChapter.url) {
    merged.url = newChapter.url;
  }
  // Add cover image if missing
  if (!existing.coverImage && newChapter.coverImage) {
    merged.coverImage = newChapter.coverImage;
  }

  return merged;
}

/**
 * Adds chapter to map, deduplicating by chapter number
 * Handles wikis with Japanese/English tabs that both contain chapter tables
 */
function addChapterToMap(chapterMap: Map<number, ChapterData>, chapter: ChapterData): void {
  if (!chapterMap.has(chapter.number)) {
    chapterMap.set(chapter.number, chapter);
    return;
  }
  // Merge additional data if the new chapter has more info
  const existing = chapterMap.get(chapter.number);
  if (existing) {
    const merged = mergeChapterData(existing, chapter);
    chapterMap.set(chapter.number, merged);
  }
}

/**
 * Extracts chapter data from a single chapter link element
 */
function extractChapterFromLink(
  $link: cheerio.Cheerio<AnyNode>,
  baseUrl?: string
): ChapterData | null {
  const href = $link.attr('href') ?? '';
  const linkText = $link.text().trim();

  // Extract chapter number from URL (most reliable)
  // Use (?:_|\s|%20) instead of [_\s%20] to avoid treating '%', '2', '0' as
  // individual separator characters, which would consume leading digits of
  // chapter numbers (e.g. Chapter_20 was misparsed as chapter 0).
  const urlMatch = href.match(/Chapter(?:_|\s|%20)+(\d+(?:[._]\d+)?)/i);
  if (!urlMatch?.[1]) return null;

  const chapterNumber = parseFloat(urlMatch[1].replace('_', '.'));
  if (isNaN(chapterNumber)) return null;

  // Extract title - remove chapter prefix from link text
  const title = cleanChapterLinkTitle(linkText, chapterNumber);
  const chapterUrl = formatChapterUrl(href, baseUrl);

  return {
    number: chapterNumber,
    title,
    ...(chapterUrl && { url: chapterUrl }),
  };
}

/**
 * Cleans chapter title from link text, removing number prefixes
 */
function cleanChapterLinkTitle(linkText: string, chapterNumber: number): string {
  // Handle "001: Title" format
  const numberedTitleMatch = linkText.match(/^\d+\s*[:.\-–—]\s*(.+)$/);
  if (numberedTitleMatch?.[1]) {
    return numberedTitleMatch[1];
  }
  // Handle "Chapter 1: Title" format
  const chapterTitleMatch = linkText.match(/^(?:Chapter|Ch\.?)\s*\d+\s*[:.\-–—]?\s*(.*)$/i);
  if (chapterTitleMatch?.[1]) {
    return chapterTitleMatch[1] || `Chapter ${chapterNumber}`;
  }
  return linkText || `Chapter ${chapterNumber}`;
}

/**
 * Extracts chapters from all chapter links within a table
 * Handles wikis like Sakamoto Days where multiple chapters are in one cell
 */
function parseChaptersFromLinks(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<AnyNode>,
  baseUrl?: string
): ChapterData[] {
  const chapters: ChapterData[] = [];

  // Skip navigation and infobox tables
  if (isNavOrInfoTable($table)) {
    return chapters;
  }

  // Find all chapter links in the table
  const selector = 'a[href*="/wiki/Chapter_"], a[href*="/wiki/Chapter%20"], a[title*="Chapter "]';
  $table.find(selector).each((_, link) => {
    const chapter = extractChapterFromLink($(link), baseUrl);
    if (chapter) chapters.push(chapter);
  });

  return chapters;
}

/**
 * Applies link-based parsing to all content tables
 */
function parseAllTablesWithLinkStrategy(
  $: cheerio.CheerioAPI,
  chapterMap: Map<number, ChapterData>,
  baseUrl?: string
): void {
  $('table').each((_, table) => {
    const $table = $(table);
    // Skip navigation, infobox, and toccolours tables (nav tables have bare-number links that poison merge)
    if (isNavOrInfoTable($table)) return;

    const linkChapters = parseChaptersFromLinks($, $table, baseUrl);
    for (const chapter of linkChapters) {
      addChapterToMap(chapterMap, chapter);
    }
  });
}

/**
 * Extracts chapter links from list items (<li>) outside of tables.
 * Some wikis (e.g., Chainsaw Man) place certain volumes' chapters in
 * <ul>/<ol> lists rather than tables, causing them to be missed by
 * table-only parsing.
 */
function parseChapterLinksFromLists(
  $: cheerio.CheerioAPI,
  chapterMap: Map<number, ChapterData>,
  baseUrl?: string,
): void {
  const sizeBefore = chapterMap.size;
  const selector = 'li a[href*="/wiki/Chapter_"], li a[href*="/wiki/Chapter%20"]';
  $(selector).each((_, link) => {
    const $link = $(link);
    // Skip links inside non-nav tables (already handled by Strategy 1)
    // But DO process links inside toccolours/navbox tables (Strategy 1 skips these)
    const $closestTable = $link.closest('table');
    if ($closestTable.length > 0 && !isNavOrInfoTable($closestTable)) return;
    // Skip links inside navbox/infobox/toc containers (bare-number navigation links)
    if ($link.closest('.navbox, .infobox, .toc').length > 0) return;

    const chapter = extractChapterFromLink($link, baseUrl);
    if (chapter) {
      addChapterToMap(chapterMap, chapter);
    }
  });
  const added = chapterMap.size - sizeBefore;
  if (added > 0) {
    logger.info(`[parseChapterTables] Found ${added} additional chapters from list elements outside tables`);
  }
}

/**
 * Extracts chapters from links whose visible text starts with a number prefix.
 * Handles wikis like Bleach where chapter links use volume-anchored fragment URLs
 * (e.g., href="/wiki/VOLUME_(Volume_1)#001._Title") with link text "001. Title".
 * Also handles wikis where chapter URLs use character/arc names instead of "Chapter_N".
 */
function parseChaptersFromNumberedTextLinks(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<AnyNode>,
  baseUrl?: string
): ChapterData[] {
  const chapters: ChapterData[] = [];

  if (isNavOrInfoTable($table)) return chapters;

  $table.find('a[href*="/wiki/"]').each((_, link) => {
    const $link = $(link);
    const text = $link.text().trim();
    const href = $link.attr('href') ?? '';

    // Skip navigation/category/special links
    if (href.includes('Special:') || href.includes('Category:') || href.includes('User:')) return;
    // Skip links that are just numbers without titles (e.g., volume links)
    if (/^\d+$/.test(text)) return;

    // Match numbered chapter text: "001. Title", "1: Title", "1 - Title"
    const match = text.match(/^(\d{1,4})\s*[.:\-–—]\s*(.+)$/);
    if (!match?.[1] || !match[2]) return;

    const chapterNumber = parseInt(match[1], 10);
    const title = match[2].trim();
    if (isNaN(chapterNumber) || !title) return;

    const chapterUrl = formatChapterUrl(href, baseUrl);
    chapters.push({
      number: chapterNumber,
      title,
      ...(chapterUrl ? { url: chapterUrl } : {}),
    });
  });

  return chapters;
}

/**
 * Applies numbered-text link parsing to all content tables
 * (Bleach/Tokyo Ghoul pattern: links with "001. Title" text format)
 */
function parseAllTablesWithNumberedTextLinkStrategy(
  $: cheerio.CheerioAPI,
  chapterMap: Map<number, ChapterData>,
  baseUrl?: string
): void {
  $('table').each((_, table) => {
    const $table = $(table);
    if (isNavOrInfoTable($table)) return;

    const linkChapters = parseChaptersFromNumberedTextLinks($, $table, baseUrl);
    for (const chapter of linkChapters) {
      addChapterToMap(chapterMap, chapter);
    }
  });
}

/**
 * Extracts chapters from <ol> list items inside tables.
 * Handles wikis like World Trigger where chapters are in ordered lists
 * within volume table cells, using character/arc names as chapter page URLs.
 */
function parseChaptersFromOrderedListsInTables(
  $: cheerio.CheerioAPI,
  chapterMap: Map<number, ChapterData>,
  baseUrl?: string
): void {
  // Track cumulative chapter number across all <ol> lists
  let runningChapterNum = 0;
  const sizeBefore = chapterMap.size;

  // Find all <ol> elements inside table cells
  $('table td ol, table td > ol').each((_, ol) => {
    const $ol = $(ol);
    // Skip navbox/infobox lists
    if ($ol.closest('.navbox, .infobox, .toc').length > 0) return;

    $ol.find('> li').each((_, li) => {
      const $li = $(li);
      const $link = $li.find('a[href*="/wiki/"]').first();
      if (!$link.length) return;

      const href = $link.attr('href') ?? '';
      // Skip non-content links
      if (href.includes('Special:') || href.includes('Category:')) return;

      const linkText = $link.text().trim();
      if (!linkText) return;

      runningChapterNum++;
      const chapterUrl = formatChapterUrl(href, baseUrl);
      const chapter: ChapterData = {
        number: runningChapterNum,
        title: linkText,
        ...(chapterUrl ? { url: chapterUrl } : {}),
      };
      addChapterToMap(chapterMap, chapter);
    });
  });

  const added = chapterMap.size - sizeBefore;
  if (added > 0) {
    logger.info(`[parseChapterTables] Found ${added} chapters from <ol> lists in tables`);
  }
}

/**
 * Extracts chapters from <li> elements where the number is outside the link.
 * Handles Detective Conan pattern: <li>0001 - <a href="...">Title</a></li>
 * Also handles: <li>1. <a>Title</a></li>, <li>001 – <a>Title</a></li>
 */
function parseDashSeparatedListItems(
  $: cheerio.CheerioAPI,
  chapterMap: Map<number, ChapterData>,
  baseUrl?: string
): void {
  const sizeBefore = chapterMap.size;

  $('li').each((_, li) => {
    const $li = $(li);
    // Skip items inside navboxes/tables
    if ($li.closest('.navbox, .infobox, .toc').length > 0) return;

    const $link = $li.find('a[href*="/wiki/"]').first();
    if (!$link.length) return;

    const href = $link.attr('href') ?? '';
    if (href.includes('Special:') || href.includes('Category:') || href.includes('User:')) return;

    // Get the full text of the <li> before the link
    const fullText = $li.text().trim();
    const linkText = $link.text().trim();
    if (!linkText) return;

    // Match: "0001 - Title" or "001. Title" or "1 – Title" pattern at start of <li>
    const match = fullText.match(/^(\d{1,4})\s*[-–—.:\s]\s*/);
    if (!match?.[1]) return;

    const chapterNumber = parseInt(match[1], 10);
    if (isNaN(chapterNumber) || chapterNumber === 0) return;

    const chapterUrl = formatChapterUrl(href, baseUrl);

    // Merge title into existing entry if it lacks a real title (title enrichment mode)
    const existing = chapterMap.get(chapterNumber);
    if (existing) {
      if (linkText && (!existing.title || /^\d+$/.test(existing.title) || /^(Chapter|Ch\.?)\s*\d+$/i.test(existing.title))) {
        existing.title = linkText;
      }
      if (chapterUrl && !existing.url) {
        existing.url = chapterUrl;
      }
    } else {
      const chapter: ChapterData = {
        number: chapterNumber,
        title: linkText,
        ...(chapterUrl ? { url: chapterUrl } : {}),
      };
      addChapterToMap(chapterMap, chapter);
    }
  });

  const added = chapterMap.size - sizeBefore;
  if (added > 0) {
    logger.info(`[parseChapterTables] Found ${added} chapters from dash-separated list items`);
  }
}

/**
 * Applies row-based parsing to all tables
 */
function parseAllTablesWithRowStrategy(
  $: cheerio.CheerioAPI,
  chapterMap: Map<number, ChapterData>,
  baseUrl?: string
): void {
  $('table').each((_, table) => {
    const tableChapters = parseChaptersFromTable($, $(table), baseUrl);
    for (const chapter of tableChapters) {
      addChapterToMap(chapterMap, chapter);
    }
  });
}

export function parseChapterTables(html: string, baseUrl?: string): ChapterData[] {
  try {
    const $ = cheerio.load(html);
    const chapterMap = new Map<number, ChapterData>();

    // Strategy 1: Link-based parsing (most reliable - works for both styles)
    parseAllTablesWithLinkStrategy($, chapterMap, baseUrl);

    // Strategy 1b: Also scan <li> elements outside tables for chapter links
    // Some wikis place certain volumes' chapters in lists instead of tables
    parseChapterLinksFromLists($, chapterMap, baseUrl);

    // Strategy 1c: Numbered-text link parsing (Bleach/Tokyo Ghoul pattern)
    // Links where text starts with "001. Title" but href doesn't contain "Chapter_"
    if (chapterMap.size === 0) {
      logger.debug('[parseChapterTables] Standard link-based found 0, trying numbered-text links');
      parseAllTablesWithNumberedTextLinkStrategy($, chapterMap, baseUrl);
    }

    // Strategy 1d: Ordered list parsing (World Trigger pattern)
    // Chapters in <ol> lists inside table cells, using character/arc names as URLs
    if (chapterMap.size === 0) {
      logger.debug('[parseChapterTables] No chapters from link strategies, trying <ol> lists in tables');
      parseChaptersFromOrderedListsInTables($, chapterMap, baseUrl);
    }

    // Strategy 1e: Dash-separated list items (Detective Conan pattern)
    // Handles <li> elements with "0001 - <a>Title</a>" where number is outside the link
    // Also runs as title enrichment when chapters exist but lack real titles
    const hasRealTitlesBeforeDash = chapterMap.size > 0 && [...chapterMap.values()]
      .filter(ch => ch.title && !/^\d+$/.test(ch.title) && !/^(Chapter|Ch\.?)\s*\d+$/i.test(ch.title))
      .length > chapterMap.size * 0.3;
    if (chapterMap.size === 0 || !hasRealTitlesBeforeDash) {
      logger.debug('[parseChapterTables] Trying dash-separated list items');
      parseDashSeparatedListItems($, chapterMap, baseUrl);
    }

    // Strategy 2: Row-based parsing (fallback for tables without chapter links)
    if (chapterMap.size === 0) {
      logger.debug('[parseChapterTables] All link strategies found 0, trying row-based');
      parseAllTablesWithRowStrategy($, chapterMap, baseUrl);
    }

    const chapters = Array.from(chapterMap.values());
    logger.info(`Parsed ${chapters.length} unique chapters from tables (deduplicated)`);
    return chapters.sort((a, b) => a.number - b.number);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error parsing chapter tables:', errorMessage);
    return [];
  }
}
