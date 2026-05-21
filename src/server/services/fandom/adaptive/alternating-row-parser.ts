/**
 * Alternating Row Parser for Fandom Wikis
 *
 * Handles wikis that use a table format where:
 * - Odd rows (1, 3, 5...) contain volume info (number, title, release dates)
 * - Even rows (2, 4, 6...) contain chapter lists for the previous volume
 *
 * Examples: Haikyuu, Naruto
 *
 * @module alternating-row-parser
 */

import { load } from 'cheerio';

import { logger } from '@/utils/logger';

import type { CheerioAPI } from 'cheerio';

/**
 * Parsed volume from alternating row structure.
 */
export interface AlternatingRowVolume {
  number: number;
  title?: string;
  releaseDate?: string;
  coverImage?: string;
  chapters: AlternatingRowChapter[];
}

/**
 * Parsed chapter from alternating row.
 */
export interface AlternatingRowChapter {
  number: number;
  title?: string;
  url?: string;
  volumeNumber: number;
}

/**
 * Result of alternating row parsing.
 */
export interface AlternatingRowParseResult {
  volumes: AlternatingRowVolume[];
  chapters: AlternatingRowChapter[];
  success: boolean;
}

/**
 * Builds an absolute URL from a relative href.
 */
function buildAbsoluteUrl(href: string, baseUrl?: string): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/') && baseUrl) return `${baseUrl}${href}`;
  if (href.startsWith('/')) {
    logger.warn('[alternating-row-parser] Relative URL without baseUrl', { href });
    return undefined;
  }
  return undefined;
}

/** Link info for URL mapping */
interface LinkInfo {
  href: string;
  text: string;
  url: string;
  chapterNumber?: number;
}

/** Extract chapter number from link text (e.g., "Chapter 1", "1: Title") */
function extractChapterFromLinkText(text: string): number | null {
  const match = text.match(/^(?:Chapter\s*)?(\d+)/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

/** Extract chapter number from URL (e.g., /wiki/Title_(chapter_1)) */
function extractChapterFromUrl(href: string): number | null {
  const match = href.match(/(?:chapter[_-]?(\d+)|_ch(?:apter)?[_-]?(\d+)|\(chapter[_-]?(\d+)\))/i);
  if (!match) return null;
  return parseInt(match[1] ?? match[2] ?? match[3] ?? '0', 10);
}

/** Match links by position - more flexible matching */
function matchLinksByPosition(
  links: LinkInfo[],
  chapters: AlternatingRowChapter[]
): Map<number, string> {
  const result = new Map<number, string>();
  const sorted = [...chapters].sort((a, b) => a.number - b.number);

  // Filter out non-chapter links (volumes, categories, external)
  const filtered = links.filter(({ href, text, url }) => {
    const path = href.toLowerCase();
    const lowerText = text.toLowerCase();
    // Exclude external links (wikipedia, etc.) - must be fandom URL
    if (!url.includes('.fandom.com/')) return false;
    // Exclude volume/category/special links
    if (path.includes('volume') || path.includes('category')) return false;
    if (lowerText.includes('volume') || lowerText === 'cover') return false;
    // Must be an internal wiki link
    return path.includes('/wiki/');
  });

  // If we have at least as many links as chapters, match by position
  // This handles cases where the HTML structure lists chapters in order
  if (filtered.length >= sorted.length) {
    for (let i = 0; i < sorted.length; i++) {
      const chapter = sorted[i];
      const link = filtered[i];
      if (chapter && link) result.set(chapter.number, link.url);
    }
  }
  return result;
}

/**
 * Builds a map of chapter numbers to URLs from row links.
 * Uses multiple strategies combined: link text, URL patterns, position matching.
 */
function buildChapterUrlMap(
  $: CheerioAPI,
  $row: ReturnType<typeof $>,
  baseUrl: string | undefined,
  chapters: AlternatingRowChapter[]
): Map<number, string> {
  // Collect all wiki links
  const allLinks: LinkInfo[] = [];
  $row.find('a[href*="/wiki/"]').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();
    const url = buildAbsoluteUrl(href, baseUrl);
    if (url) allLinks.push({ href, text, url });
  });

  const linkMap = new Map<number, string>();

  // Strategy 1: Match by chapter number in link text (e.g., "Chapter 1", "001. Title")
  for (const { text, url } of allLinks) {
    const chapterNum = extractChapterFromLinkText(text);
    if (chapterNum !== null && !linkMap.has(chapterNum)) {
      // Use URL as-is - wiki links already have correct disambiguation when needed
      linkMap.set(chapterNum, url);
    }
  }

  // Strategy 2: Match by chapter number in URL (e.g., (chapter_1), Chapter_1)
  for (const { href, url } of allLinks) {
    const chapterNum = extractChapterFromUrl(href);
    if (chapterNum !== null && chapterNum > 0 && !linkMap.has(chapterNum)) {
      linkMap.set(chapterNum, url);
    }
  }

  // Strategy 3: Fill in remaining chapters by position matching
  const missingChapters = chapters.filter((ch) => !linkMap.has(ch.number));
  if (missingChapters.length > 0) {
    // Filter out links already used by strategies 1 & 2
    const usedUrls = new Set(linkMap.values());
    const unusedLinks = allLinks.filter((link) => !usedUrls.has(link.url));
    const positionMap = matchLinksByPosition(unusedLinks, missingChapters);
    for (const [num, url] of positionMap) {
      if (!linkMap.has(num)) linkMap.set(num, url);
    }
  }

  return linkMap;
}

/**
 * Parses a single chapter link element.
 */
function parseChapterLink(
  $: CheerioAPI,
  link: ReturnType<typeof $>[number],
  volumeNumber: number,
  seenChapters: Set<number>,
  baseUrl?: string
): AlternatingRowChapter | null {
  const $link = $(link);
  const href = $link.attr('href') ?? '';
  const text = $link.text().trim();

  const chapterMatch = text.match(/^(?:Chapter\s*)?(\d+)/i);
  if (!chapterMatch?.[1]) return null;

  const chapterNum = parseInt(chapterMatch[1], 10);
  if (seenChapters.has(chapterNum) || chapterNum <= 0 || chapterNum >= 10000) return null;

  seenChapters.add(chapterNum);

  const titleMatch = text.match(/^\d+[.:]\s*[""]?(.+?)[""]?\s*$/);
  const title = titleMatch?.[1]?.trim();
  const validTitle = title && title.length < 200 ? title : undefined;
  const urlValue = buildAbsoluteUrl(href, baseUrl);

  const chapter: AlternatingRowChapter = { number: chapterNum, volumeNumber };
  if (validTitle) chapter.title = validTitle;
  if (urlValue) chapter.url = urlValue;
  return chapter;
}

/**
 * Parses chapters from text content using regex.
 * Handles formats like:
 * - Chapter 001: "Title"
 * - 001. "Title"
 * - Chapter 1: Title
 */
// eslint-disable-next-line complexity -- Multi-format chapter text parsing with 5+ regex patterns
function parseChaptersFromText(rowText: string, volumeNumber: number, seenChapters: Set<number>): AlternatingRowChapter[] {
  const chapters: AlternatingRowChapter[] = [];

  // Pattern 1: Chapter XXX: "Title" (with quotes)
  const chapterQuotedPattern = /Chapter\s*(\d+)[.:]\s*[""]([^""]+)[""](?:\s*\([^)]+\))?/gi;
  let match;
  while ((match = chapterQuotedPattern.exec(rowText)) !== null) {
    const chapterNum = parseInt(match[1] ?? '0', 10);
    if (seenChapters.has(chapterNum) || chapterNum <= 0 || chapterNum >= 10000) continue;

    seenChapters.add(chapterNum);
    const title = match[2]?.trim();
    const validTitle = title && title.length < 200 ? title : undefined;

    const chapter: AlternatingRowChapter = { number: chapterNum, volumeNumber };
    if (validTitle) chapter.title = validTitle;
    chapters.push(chapter);
  }

  // Pattern 2: XXX. "Title" (Naruto format - number followed by period and quoted title)
  // Handles nested quotes like 429. ""Know Pain""
  // Uses [^(]+ to capture until parenthetical (Japanese text), avoiding lookahead issues
  if (chapters.length === 0) {
    const numberedPattern = /(\d{1,4})\.\s*[""]([^(]+?)[""](?:\s*\([^)]+\))?/gi;
    while ((match = numberedPattern.exec(rowText)) !== null) {
      const chapterNum = parseInt(match[1] ?? '0', 10);
      if (seenChapters.has(chapterNum) || chapterNum <= 0 || chapterNum >= 10000) continue;

      seenChapters.add(chapterNum);
      // Clean up nested quotes and whitespace from title
      const rawTitle = match[2]?.trim();
      const title = rawTitle?.replace(/^[""]|[""]$/g, '').trim();
      const validTitle = title && title.length < 200 ? title : undefined;

      const chapter: AlternatingRowChapter = { number: chapterNum, volumeNumber };
      if (validTitle) chapter.title = validTitle;
      chapters.push(chapter);
    }
  }

  // Pattern 3: Chapter XXX: Title (without quotes) - fallback
  if (chapters.length === 0) {
    const unquotedPattern = /Chapter\s*(\d+)[.:]\s*([^(]+?)(?:\s*\(|Chapter\s*\d+|$)/gi;
    while ((match = unquotedPattern.exec(rowText)) !== null) {
      const chapterNum = parseInt(match[1] ?? '0', 10);
      if (seenChapters.has(chapterNum) || chapterNum <= 0 || chapterNum >= 10000) continue;

      seenChapters.add(chapterNum);
      const title = match[2]?.trim();
      const validTitle = title && title.length < 200 ? title : undefined;

      const chapter: AlternatingRowChapter = { number: chapterNum, volumeNumber };
      if (validTitle) chapter.title = validTitle;
      chapters.push(chapter);
    }
  }

  return chapters;
}

/**
 * Extracts chapters from a chapter list row.
 * Tries text parsing first (more reliable for "Chapter XXX: Title" format),
 * then falls back to link parsing.
 */
function extractChaptersFromRow(
  $: CheerioAPI,
  $row: ReturnType<typeof $>,
  volumeNumber: number,
  baseUrl?: string
): AlternatingRowChapter[] {
  const seenChapters = new Set<number>();

  // Try text parsing first - more reliable for "Chapter XXX: Title" format
  const rowText = $row.text();
  const textChapters = parseChaptersFromText(rowText, volumeNumber, seenChapters);

  if (textChapters.length > 0) {
    // Try to enrich text-parsed chapters with URLs from links
    const linkMap = buildChapterUrlMap($, $row, baseUrl, textChapters);

    // Add URLs to text-parsed chapters
    for (const chapter of textChapters) {
      const url = linkMap.get(chapter.number);
      if (url) chapter.url = url;
    }

    return textChapters;
  }

  // Fall back to link parsing
  const linkChapters: AlternatingRowChapter[] = [];
  $row.find('a[href*="/wiki/"]').each((_, link) => {
    const chapter = parseChapterLink($, link, volumeNumber, seenChapters, baseUrl);
    if (chapter) linkChapters.push(chapter);
  });

  return linkChapters;
}

/**
 * Extracts volume data from a volume info row.
 */
function extractVolumeFromRow(
  $: CheerioAPI,
  $row: ReturnType<typeof $>,
  volumeNumber: number
): Omit<AlternatingRowVolume, 'chapters'> {
  const $cells = $row.find('td, th');

  const titleCell = $cells.eq(1).text().trim();
  const titleMatch = titleCell.match(/^([^(]+)/);
  const title = titleMatch?.[1]?.trim();

  const releaseDateText = $cells.eq(2).text().trim();
  const releaseDate = releaseDateText.length > 0 ? releaseDateText : undefined;

  const $img = $row.find('img').first();
  const coverImage = $img.attr('data-src') ?? $img.attr('src');

  const volume: Omit<AlternatingRowVolume, 'chapters'> = { number: volumeNumber };

  if (title && title.length < 200) volume.title = title;
  if (releaseDate && releaseDate.length < 50) volume.releaseDate = releaseDate;
  if (coverImage) volume.coverImage = coverImage;

  return volume;
}

/**
 * Tries to extract chapters from the next row if it's a chapter row.
 * Also extracts volume cover image from the chapter row when present
 * (e.g., Vinland Saga places the cover in the chapter list row).
 */
function tryExtractNextRowChapters(
  $: CheerioAPI,
  $rows: ReturnType<typeof $>,
  currentIndex: number,
  volumeNumber: number,
  baseUrl?: string
): { chapters: AlternatingRowChapter[]; skipNext: boolean; coverImage?: string } {
  if (currentIndex + 1 >= $rows.length) {
    return { chapters: [], skipNext: false };
  }

  const $nextRow = $($rows[currentIndex + 1]);
  const nextFirstCell = $nextRow.find('td, th').first().text().trim();

  if (/^\d+$/.test(nextFirstCell)) {
    return { chapters: [], skipNext: false };
  }

  // Extract cover image from the chapter row (some wikis place it here)
  const $img = $nextRow.find('img').first();
  const rawCover = $img.attr('data-src') ?? $img.attr('src');

  return {
    chapters: extractChaptersFromRow($, $nextRow, volumeNumber, baseUrl),
    skipNext: true,
    ...(rawCover ? { coverImage: rawCover } : {}),
  };
}

/**
 * Processes a single volume row and returns the volume if valid.
 */
function processVolumeRow(
  $: CheerioAPI,
  $rows: ReturnType<typeof $>,
  rowIndex: number,
  seenVolumes: Set<number>,
  baseUrl?: string
): { volume: AlternatingRowVolume | null; skipNext: boolean } {
  const $row = $($rows[rowIndex]);
  const $cells = $row.find('td, th');
  const firstCellText = $cells.first().text().trim();
  const volumeMatch = firstCellText.match(/^(\d+)$/);

  if (!volumeMatch?.[1]) {
    return { volume: null, skipNext: false };
  }

  const volumeNumber = parseInt(volumeMatch[1], 10);
  if (seenVolumes.has(volumeNumber)) {
    return { volume: null, skipNext: false };
  }

  seenVolumes.add(volumeNumber);
  const volumeData = extractVolumeFromRow($, $row, volumeNumber);
  const { chapters, skipNext, coverImage } = tryExtractNextRowChapters($, $rows, rowIndex, volumeNumber, baseUrl);

  // Use cover from chapter row when metadata row has none
  if (!volumeData.coverImage && coverImage) {
    volumeData.coverImage = coverImage;
  }

  return {
    volume: { ...volumeData, chapters },
    skipNext,
  };
}

/**
 * Parses volumes from alternating row table structure.
 */
function parseVolumesFromTable(
  $: CheerioAPI,
  $table: ReturnType<typeof $>,
  baseUrl?: string
): AlternatingRowVolume[] {
  const volumes: AlternatingRowVolume[] = [];
  const $rows = $table.find('tr');
  const seenVolumes = new Set<number>();

  let i = 0;
  while (i < $rows.length) {
    const result = processVolumeRow($, $rows, i, seenVolumes, baseUrl);
    if (result.volume) {
      volumes.push(result.volume);
    }
    i += result.skipNext ? 2 : 1;
  }

  return volumes;
}

/**
 * Adds unique volumes to the collection.
 */
function addUniqueVolumes(
  tableVolumes: AlternatingRowVolume[],
  seenVolumes: Set<number>,
  volumes: AlternatingRowVolume[],
  allChapters: AlternatingRowChapter[]
): void {
  for (const volume of tableVolumes) {
    if (seenVolumes.has(volume.number)) continue;
    seenVolumes.add(volume.number);
    volumes.push(volume);
    allChapters.push(...volume.chapters);
  }
}

/**
 * Checks if table has alternating row pattern and returns parsed volumes.
 */
function tryParseTable(
  $: CheerioAPI,
  table: ReturnType<typeof $>[number],
  baseUrl?: string
): AlternatingRowVolume[] | null {
  const $table = $(table);
  const $rows = $table.find('tr');
  if ($rows.length < 3) return null;

  const $firstDataRow = $rows.eq(1);
  const firstCell = $firstDataRow.find('td').first().text().trim();

  if (!/^\d+$/.test(firstCell)) return null;

  return parseVolumesFromTable($, $table, baseUrl);
}

/**
 * Parses alternating row structure from HTML.
 *
 * @param html - HTML content to parse
 * @param baseUrl - Base URL of the wiki (e.g., https://haikyuu.fandom.com)
 * @returns Parsed volumes and chapters
 */
export function parseAlternatingRowStructure(html: string, baseUrl?: string): AlternatingRowParseResult {
  const $ = load(html);
  const volumes: AlternatingRowVolume[] = [];
  const allChapters: AlternatingRowChapter[] = [];
  const seenVolumes = new Set<number>();

  const $content = $('.mw-parser-output');
  const $tables = $content.find('table.volumes, table.wikitable, table.article-table').not('.navbox');
  const $targetTables = $tables.length > 0 ? $tables : $content.find('table').not('.navbox').not('.toc');

  logger.debug(`[alternating-row-parser] Found ${$targetTables.length} tables to check`);

  $targetTables.each((_, table) => {
    const tableVolumes = tryParseTable($, table, baseUrl);
    if (tableVolumes) {
      addUniqueVolumes(tableVolumes, seenVolumes, volumes, allChapters);
    }
  });

  volumes.sort((a, b) => a.number - b.number);
  allChapters.sort((a, b) => a.number - b.number);

  logger.info(`[alternating-row-parser] Parsed ${volumes.length} volumes, ${allChapters.length} chapters`);

  return {
    volumes,
    chapters: allChapters,
    success: volumes.length > 0,
  };
}

/**
 * Checks if a page uses alternating row structure.
 *
 * @param html - HTML content to check
 * @returns true if the page has alternating volume/chapter row pattern
 */
export function isAlternatingRowStructure(html: string): boolean {
  const $ = load(html);

  const $volumesTable = $('.mw-parser-output table.volumes');
  if ($volumesTable.length > 0) {
    return true;
  }

  const $tables = $('.mw-parser-output table').not('.navbox');

  let hasPattern = false;
  $tables.each((_, table) => {
    const $table = $(table);
    const $rows = $table.find('tr');

    if ($rows.length < 3) return;

    const row1Text = $rows.eq(1).find('td').first().text().trim();
    const row2Text = $rows.eq(2).text();

    // Check for various chapter formats:
    // - Chapter X (Haikyuu)
    // - XXX. "Title" (Naruto)
    const hasChapterFormat = /Chapter\s*\d+/i.test(row2Text);
    const hasNumberedFormat = /\d{1,4}\.\s*[""]/.test(row2Text);

    if (/^1$/.test(row1Text) && (hasChapterFormat || hasNumberedFormat)) {
      hasPattern = true;
      return false;
    }
  });

  return hasPattern;
}
