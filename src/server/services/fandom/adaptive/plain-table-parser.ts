// @file-size-justified: Cohesive Fandom table parser with interdependent extraction functions - splitting reduces discoverability
/**
 * Plain Table Parser for Fandom Wikis
 *
 * Handles wikis that use plain <table> elements (without .wikitable class)
 * for volume data. Common in wikis like One Piece that use Template:Volume.
 *
 * Structure pattern:
 * <h3>Volume 1 To 10</h3>
 * <table>
 *   Volume 1 | Title | Release Date | Pages | ISBN | Chapters...
 * </table>
 *
 * @module plain-table-parser
 */

import { load } from 'cheerio';

import { logger } from '@/utils/logger';

import {
  NAMING_CONVENTIONS,
  detectNamingConvention,
  extractChapterNumber as extractWithConvention,
  cleanChapterTitle as cleanWithConvention,
} from './naming-convention-detector';
import { isIsbnPrefix } from './utils/isbn-filter';

import type { NamingConvention } from './naming-convention-detector';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

/**
 * Parsed volume from plain table structure.
 */
export interface PlainTableVolume {
  number: number;
  title?: string;
  releaseDate?: string;
  pages?: number;
  isbn?: string;
  coverImage?: string;
  chapters: PlainTableChapter[];
}

/**
 * Parsed chapter from plain table.
 */
export interface PlainTableChapter {
  number: number;
  title?: string;
  url?: string;
  volumeNumber: number;
  releaseDate?: string;
}

/**
 * Result of plain table parsing.
 */
export interface PlainTableParseResult {
  volumes: PlainTableVolume[];
  chapters: PlainTableChapter[];
  success: boolean;
}

/**
 * Extracts chapter number from text using multiple patterns.
 * Supports decimals (1.5, 2.1) for bonus/special chapters.
 * Uses naming convention detector for non-standard patterns.
 */
function extractChapterNumberFromText(
  text: string,
  href: string,
  title: string,
  convention?: NamingConvention | null
): number | null {
  // Special handling for Volume 0 prequel format: "0-1", "000-1", "Chapter 0-1" → 0.1, 0.2, etc.
  // Must be checked before convention-aware extractor since this is a structural pattern
  // Patterns handle: "000-1", "000-1.", "000-1. Title", "Chapter 0-1", etc.
  const zeroChapterPatterns = [
    { source: href, regex: /Chapter[_\s]*0+-(\d+)/i },
    { source: title, regex: /Chapter\s*0+-(\d+)/i },
    { source: text, regex: /^0+-(\d+)(?:\.|$|\s)/ },  // "000-1", "000-1.", "000-1 Title"
    { source: text, regex: /Chapter\s*0+-(\d+)/i },
    { source: text, regex: /\b0+-(\d+)\b/ },  // "000-1" anywhere in text with word boundaries
  ];
  for (const { source, regex } of zeroChapterPatterns) {
    const match = source.match(regex);
    if (match?.[1]) {
      // Convert "0-1" to 0.1, "0-2" to 0.2, etc.
      return parseFloat(`0.${match[1]}`);
    }
  }

  // If we have a detected convention, use the convention-aware extractor
  if (convention !== undefined) {
    return extractWithConvention(text, href, title, convention);
  }

  // Build patterns dynamically from all known conventions
  const patterns: Array<{ regex: RegExp; source: string }> = [
    { regex: /^(\d+(?:\.\d+)?)$/, source: text },
  ];

  // Add patterns from all naming conventions
  for (const conv of NAMING_CONVENTIONS) {
    for (const pattern of conv.patterns) {
      patterns.push({ regex: pattern, source: text });
      patterns.push({ regex: pattern, source: title });
    }
    for (const urlPattern of conv.urlPatterns) {
      patterns.push({ regex: urlPattern, source: href });
    }
  }

  // Add standard chapter patterns
  patterns.push(
    { regex: /Chapter[_\s](\d+(?:\.\d+)?)/i, source: href },
    { regex: /Chapter\s*(\d+(?:\.\d+)?)/i, source: title },
    { regex: /Ch\.\s*(\d+(?:\.\d+)?)/i, source: text },
    { regex: /#(\d+(?:\.\d+)?)/i, source: text }
  );

  for (const { regex, source } of patterns) {
    const match = source.match(regex);
    if (match?.[1]) return parseFloat(match[1]);
  }

  return null;
}

/**
 * Cleans chapter title by removing number prefixes.
 * Uses convention-aware cleaner for non-standard patterns.
 */
function cleanChapterTitle(title: string, convention?: NamingConvention | null): string {
  // Use the convention-aware cleaner which handles all known patterns
  return cleanWithConvention(title, convention);
}

/**
 * Extracts chapter from cell text (fallback when no links exist).
 * Handles all naming conventions dynamically.
 */
function extractChapterFromCellText(
  cellText: string,
  volumeNumber: number,
  convention?: NamingConvention | null
): PlainTableChapter | null {
  // Build patterns for all conventions (prioritize detected convention)
  const conventionsToTry = convention
    ? [convention, ...NAMING_CONVENTIONS.filter(c => c.name !== convention.name)]
    : NAMING_CONVENTIONS;

  for (const conv of conventionsToTry) {
    for (const pattern of conv.patterns) {
      // Create a pattern that captures both number and optional title
      const source = pattern.source;
      // Extract the base word (e.g., "Stage" from /Stage\.?\s*(\d+)/i)
      const baseMatch = source.match(/^(\w+)/);
      if (!baseMatch) continue;

      const baseWord = baseMatch[1];
      const fullPattern = new RegExp(
        `${baseWord}\\.?\\s*(\\d+(?:\\.\\d+)?)[:\\s]*(?:"([^"]+)"|(.+))?`,
        'i'
      );

      const match = cellText.match(fullPattern);
      if (match?.[1]) {
        const num = parseFloat(match[1]);
        const title = match[2] ?? match[3]?.split(/[(\n]/)[0]?.trim();
        const chapter: PlainTableChapter = { number: num, volumeNumber };
        if (title) chapter.title = cleanChapterTitle(title, convention);
        return chapter;
      }
    }
  }

  // Fallback: Try standard Chapter pattern
  const chapterMatch = cellText.match(/Chapter\s*(\d+(?:\.\d+)?)[:\s]*(?:"([^"]+)"|(.+))?/i);
  if (chapterMatch?.[1]) {
    const num = parseFloat(chapterMatch[1]);
    const title = chapterMatch[2] ?? chapterMatch[3]?.split(/[(\n]/)[0]?.trim();
    const chapter: PlainTableChapter = { number: num, volumeNumber };
    if (title) chapter.title = cleanChapterTitle(title, convention);
    return chapter;
  }

  return null;
}

/**
 * Builds link selectors for the detected naming convention.
 */
function buildLinkSelectors(convention?: NamingConvention | null): string {
  const selectors = [
    'a[href*="/wiki/Chapter"]',
    'a[title*="Chapter"]',
    'a[href*="chapter"]',
  ];

  // Add selectors for detected convention
  if (convention) {
    for (const urlPattern of convention.urlPatterns) {
      const baseMatch = urlPattern.source.match(/^(\w+)/);
      if (baseMatch?.[1]) {
        const word = baseMatch[1];
        selectors.push(`a[href*="${word}"]`);
        selectors.push(`a[title*="${word}"]`);
      }
    }
  }

  // Also add all known convention selectors for broader coverage
  for (const conv of NAMING_CONVENTIONS) {
    const baseMatch = conv.patterns[0]?.source.match(/^(\w+)/);
    if (baseMatch?.[1]) {
      const word = baseMatch[1];
      if (!selectors.includes(`a[href*="${word}"]`)) {
        selectors.push(`a[href*="${word}"]`);
      }
    }
  }

  return selectors.join(', ');
}

/**
 * Extracts chapters from bullet list items containing chapter patterns.
 * Handles <li> with <a>, <span class="new">, or plain text.
 */
function extractChaptersFromBulletList(
  $: CheerioAPI,
  $cell: Cheerio<Element>,
  volumeNumber: number,
  seenChapters: Set<number>,
  convention?: NamingConvention | null
): PlainTableChapter[] {
  const chapters: PlainTableChapter[] = [];

  $cell.find('ul li, ol li').each((_, li) => {
    const $li = $(li);
    const liText = $li.text().trim();
    const href = $li.find('a').first().attr('href') ?? '';
    const titleAttr = $li.find('a').first().attr('title') ?? '';

    // Try convention-aware extraction (handles Curse, Spell, Episode, etc.)
    const chapterNum = extractChapterNumberFromText(liText, href, titleAttr, convention);

    if (chapterNum === null || isIsbnPrefix(chapterNum) || seenChapters.has(chapterNum)) return;

    seenChapters.add(chapterNum);
    const chapterInfo = extractChapterTitleFromListItem($, $li, liText, convention);
    const chapter: PlainTableChapter = { number: chapterNum, volumeNumber };
    if (chapterInfo.title !== undefined) chapter.title = chapterInfo.title;
    if (chapterInfo.url !== undefined) chapter.url = chapterInfo.url;
    chapters.push(chapter);
  });

  return chapters;
}

/**
 * Extracts title and URL from a list item element.
 */
function extractChapterTitleFromListItem(
  _$: CheerioAPI,
  $li: Cheerio<Element>,
  fallbackText: string,
  convention?: NamingConvention | null
): { title?: string; url?: string } {
  const $link = $li.find('a').first();
  const $redlink = $li.find('span.new').first();

  let title: string | undefined;
  let url: string | undefined;

  if ($link.length > 0) {
    title = $link.attr('title')?.trim() ?? $link.text().trim();
    const href = $link.attr('href') ?? '';
    if (href.startsWith('/wiki/')) url = href;
  } else if ($redlink.length > 0) {
    title = $redlink.attr('title')?.replace(' (page does not exist)', '').trim() ?? $redlink.text().trim();
  } else {
    title = fallbackText;
  }

  const cleanedTitle = cleanChapterTitle(title, convention);
  const result: { title?: string; url?: string } = {};
  if (cleanedTitle.length > 0) result.title = cleanedTitle;
  if (url !== undefined) result.url = url;
  return result;
}

/**
 * Extracts chapter info from a cell.
 */
function extractChaptersFromCell(
  $: CheerioAPI,
  $cell: Cheerio<Element>,
  volumeNumber: number,
  convention?: NamingConvention | null
): PlainTableChapter[] {
  const chapters: PlainTableChapter[] = [];
  const seenChapters = new Set<number>();

  // Build dynamic selector based on detected convention
  const linkSelector = buildLinkSelectors(convention);

  $cell.find(linkSelector).each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const titleAttr = $link.attr('title') ?? '';
    const text = $link.text().trim();

    const chapterNum = extractChapterNumberFromText(text, href, titleAttr, convention);

    if (chapterNum !== null && !isIsbnPrefix(chapterNum) && !seenChapters.has(chapterNum)) {
      seenChapters.add(chapterNum);
      // Prefer visible link text when it has alphabetic chars (real titles like "Kaiman"),
      // fall back to HTML title attribute (often generic "Chapter N")
      const titleSource = (text.length > 0 && /[a-zA-Z]/.test(text)) ? text : titleAttr;
      const cleanedTitle = cleanChapterTitle(titleSource, convention);

      const chapter: PlainTableChapter = { number: chapterNum, volumeNumber };
      if (cleanedTitle.length > 0) chapter.title = cleanedTitle;
      if (href.startsWith('/wiki/')) chapter.url = href;
      chapters.push(chapter);
    }
  });

  // Check bullet lists with chapter patterns (March Comes in Like a Lion)
  if (chapters.length === 0) {
    const bulletChapters = extractChaptersFromBulletList($, $cell, volumeNumber, seenChapters, convention);
    chapters.push(...bulletChapters);
  }

  // Fallback: extract chapter from cell text
  if (chapters.length === 0) {
    const cellText = $cell.text().trim();
    const chapter = extractChapterFromCellText(cellText, volumeNumber, convention);
    if (chapter && !seenChapters.has(chapter.number)) {
      chapters.push(chapter);
    }
  }

  return chapters;
}

/**
 * Extracts chapter info from a single list item element.
 * Handles: <a> links, <span class="new"> red links, and plain text.
 */
function extractChapterFromListItem(
  _$: CheerioAPI,
  $li: Cheerio<Element>,
  chapterNumber: number,
  volumeNumber: number
): PlainTableChapter | null {
  const $link = $li.find('a').first();
  const $redlink = $li.find('span.new').first();

  let title: string;
  let url: string | undefined;

  if ($link.length > 0) {
    // Real link exists
    title = $link.attr('title')?.trim() ?? $link.text().trim();
    const href = $link.attr('href') ?? '';
    if (href.startsWith('/wiki/')) {
      url = href;
    }
  } else if ($redlink.length > 0) {
    // Red link (page doesn't exist) - extract title from title attribute or text
    title = $redlink.attr('title')?.replace(' (page does not exist)', '').trim() ?? $redlink.text().trim();
  } else {
    // Plain text
    title = $li.text().trim();
  }

  // Skip empty or navigation items
  if (title.length < 2 || title.toLowerCase().includes('edit') || title.toLowerCase().includes('view source')) {
    return null;
  }

  const chapter: PlainTableChapter = { number: chapterNumber, title, volumeNumber };
  if (url !== undefined) chapter.url = url;
  return chapter;
}

/**
 * Extracts chapters from "Chapter List:" or "Chapters list:" sections in table cells.
 * Patterns: Future Diary (ul), Attack on Titan (ol with start attr)
 */
function extractChaptersFromChapterListCell(
  $: CheerioAPI,
  $cell: Cheerio<Element>,
  volumeNumber: number,
  _startingChapterNumber: number
): PlainTableChapter[] {
  const chapters: PlainTableChapter[] = [];

  // Handle ordered lists with start attribute (Attack on Titan pattern)
  $cell.find('ol').each((_, ol) => {
    const $ol = $(ol);
    const startAttr = $ol.attr('start');
    let chapterNumber = startAttr ? parseInt(startAttr, 10) : 1;

    $ol.find('> li').each((__, li) => {
      const chapter = extractChapterFromListItem($, $(li), chapterNumber, volumeNumber);
      if (chapter) {
        chapters.push(chapter);
        chapterNumber++;
      }
    });
  });

  // Handle unordered lists (Future Diary pattern) - use sequential numbering
  let ulChapterNumber = chapters.length > 0 ? Math.max(...chapters.map((c) => c.number)) + 1 : 1;
  $cell.find('ul').each((_, ul) => {
    $(ul).find('> li').each((__, li) => {
      const chapter = extractChapterFromListItem($, $(li), ulChapterNumber, volumeNumber);
      if (chapter) {
        chapters.push(chapter);
        ulChapterNumber++;
      }
    });
  });

  return chapters;
}

/**
 * Parses a single volume table.
 */
function parseVolumeTable(
  $: CheerioAPI,
  $table: Cheerio<Element>,
  convention?: NamingConvention | null
): PlainTableVolume | null {
  // Look for volume number in the table
  const tableText = $table.text();
  const volumeMatch = tableText.match(/Volume\s*(\d+)/i);

  if (!volumeMatch?.[1]) {
    return null;
  }

  const volumeNumber = parseInt(volumeMatch[1], 10);
  const chapters: PlainTableChapter[] = [];

  // Find cover image
  const $img = $table.find('img').first();
  const coverImage = $img.attr('data-src') ?? $img.attr('src');

  // Find title - usually in a cell with Japanese text or explicit "Title" header
  let title: string | undefined;
  $table.find('tr').each((_, row) => {
    const rowText = $(row).text();
    // Look for pattern: X | "Title" or just a title row
    if (rowText.includes('Title')) {
      // This is likely a header row, skip
      return;
    }
  });

  // Extract chapters from the table
  // Two-pass approach: first check for "Chapter List:" pattern, then extract
  const hasChapterListPattern = $table.find('td, th').toArray().some((cell) => {
    return /chapters?\s*list:/i.test($(cell).text());
  });

  $table.find('td, th').each((_, cell) => {
    const $cell = $(cell);
    const cellText = $cell.text();

    if (hasChapterListPattern) {
      // Use Chapter List extraction if pattern exists (Future Diary, Attack on Titan)
      if (/chapters?\s*list:/i.test(cellText)) {
        const listChapters = extractChaptersFromChapterListCell($, $cell, volumeNumber, chapters.length + 1);
        chapters.push(...listChapters);
      }
      // Skip standard extraction when using Chapter List pattern
    } else {
      // Standard chapter extraction
      const cellChapters = extractChaptersFromCell($, $cell, volumeNumber, convention);
      chapters.push(...cellChapters);
    }
  });

  // Extract release date
  let releaseDate: string | undefined;
  const dateMatch = tableText.match(/(\w+\s+\d{1,2},?\s+\d{4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (dateMatch) {
    releaseDate = dateMatch[0];
  }

  // Extract ISBN
  let isbn: string | undefined;
  const isbnMatch = tableText.match(/(?:ISBN[-:\s]*)?(978[-\s]?\d[-\s]?\d{2,5}[-\s]?\d{4,7}[-\s]?\d)/i);
  if (isbnMatch?.[1]) {
    isbn = isbnMatch[1].replace(/[-\s]/g, '');
  }

  // Inherit volume release date to all chapters in this volume
  if (releaseDate) {
    for (const ch of chapters) { ch.releaseDate = releaseDate; }
  }

  const volume: PlainTableVolume = {
    number: volumeNumber,
    chapters,
  };

  if (title) volume.title = title;
  if (releaseDate) volume.releaseDate = releaseDate;
  if (isbn) volume.isbn = isbn;
  if (coverImage) volume.coverImage = coverImage;

  const pagesMatch = tableText.match(/(\d+)\s*pages?\b/i);
  if (pagesMatch?.[1]) {
    const p = parseInt(pagesMatch[1], 10);
    if (p > 0 && p < 2000) volume.pages = p;
  }

  return volume;
}

/**
 * Checks if text contains any naming convention keywords.
 */
function containsConventionKeyword(text: string): boolean {
  // Check for standard Chapter
  if (/Chapter/i.test(text)) return true;

  // Check all naming conventions
  for (const conv of NAMING_CONVENTIONS) {
    for (const pattern of conv.patterns) {
      const baseMatch = pattern.source.match(/^(\w+)/);
      if (baseMatch?.[1]) {
        const regex = new RegExp(baseMatch[1], 'i');
        if (regex.test(text)) return true;
      }
    }
  }

  return false;
}

/**
 * Processes a row to extract chapter information.
 * Also handles <li> elements inside cells for wikis like Dr. Stone.
 */
function processRowForChapter(
  $: CheerioAPI,
  $row: Cheerio<Element>,
  volumeNumber: number,
  convention?: NamingConvention | null
): PlainTableChapter | null {
  let foundChapter: PlainTableChapter | null = null;

  $row.find('td').each((_, cell) => {
    if (foundChapter) return; // Already found one

    const $cell = $(cell);
    const cellText = $cell.text().trim();

    // Skip cells that are just volume labels (unless they contain convention keywords)
    if (/^Volume\s*\d+/i.test(cellText) && !containsConventionKeyword(cellText)) {
      return;
    }

    // First, try extracting from cell text
    const chapter = extractChapterFromCellText(cellText, volumeNumber, convention);
    if (chapter) {
      foundChapter = chapter;
      return;
    }

    // Also check for chapter links inside <li> elements (Dr. Stone, etc.)
    const cellChapters = extractChaptersFromCell($, $cell, volumeNumber, convention);
    const firstChapter = cellChapters[0];
    if (firstChapter) {
      foundChapter = firstChapter;
    }
  });

  return foundChapter;
}

/**
 * Extracts all chapters from a table row's cells.
 */
function extractAllChaptersFromRow(
  $: CheerioAPI,
  $row: Cheerio<Element>,
  volumeNumber: number,
  convention?: NamingConvention | null
): PlainTableChapter[] {
  const rowChapters: PlainTableChapter[] = [];

  $row.find('td').each((_, cell) => {
    const $cell = $(cell);
    const cellChapters = extractChaptersFromCell($, $cell, volumeNumber, convention);
    rowChapters.push(...cellChapters);
  });

  return rowChapters;
}

/**
 * Parses a unified chapter list table (all chapters in one table with volume groupings).
 * Used for wikis like Evangelion where the table has Volume + Stage rows.
 * Also handles wikis like Dr. Stone where chapters are in <ul><li> elements.
 */
function parseUnifiedChapterTable(
  $: CheerioAPI,
  $table: Cheerio<Element>,
  convention?: NamingConvention | null
): { volumes: PlainTableVolume[]; chapters: PlainTableChapter[] } {
  const volumeMap = new Map<number, PlainTableVolume>();
  const chapters: PlainTableChapter[] = [];
  const seenChapters = new Set<number>();
  let currentVolume = 0;

  $table.find('tr').each((_, row) => {
    const $row = $(row);
    const rowText = $row.text();

    // Check if this row contains a volume indicator (including h4 headers in cells)
    const volumeMatch = rowText.match(/Volume\s*(\d+)/i);
    if (volumeMatch?.[1]) {
      currentVolume = parseInt(volumeMatch[1], 10);
      if (!volumeMap.has(currentVolume)) {
        volumeMap.set(currentVolume, { number: currentVolume, chapters: [] });
      }
    }

    // Extract ALL chapters from this row (handles Dr. Stone's <ul><li> pattern)
    const rowChapters = extractAllChaptersFromRow($, $row, currentVolume, convention);
    for (const chapter of rowChapters) {
      if (!seenChapters.has(chapter.number)) {
        seenChapters.add(chapter.number);
        chapters.push(chapter);
        volumeMap.get(currentVolume)?.chapters.push(chapter);
      }
    }

    // Also try single chapter extraction for rows with plain text (Evangelion pattern)
    if (rowChapters.length === 0) {
      const chapter = processRowForChapter($, $row, currentVolume, convention);
      if (chapter && !seenChapters.has(chapter.number)) {
        seenChapters.add(chapter.number);
        chapters.push(chapter);
        volumeMap.get(currentVolume)?.chapters.push(chapter);
      }
    }
  });

  return {
    volumes: Array.from(volumeMap.values()).sort((a, b) => a.number - b.number),
    chapters: chapters.sort((a, b) => a.number - b.number),
  };
}

/**
 * Parses plain table structure from HTML.
 * Looks for tables containing volume data based on content, not CSS class.
 *
 * @param html - HTML content to parse
 * @returns Parsed volumes and chapters
 */

/**
 * Checks if table uses any naming convention pattern (including standard Chapter).
 */
function detectTableConventionPattern(tableText: string): boolean {
  // Check for standard Chapter pattern first
  if (/Chapter\s*\d+/i.test(tableText)) {
    return true;
  }

  // Check all other naming conventions
  for (const conv of NAMING_CONVENTIONS) {
    for (const pattern of conv.patterns) {
      if (pattern.test(tableText)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if a table uses numbered volume pattern (e.g., Demon Slayer).
 * Pattern: # header with numeric first data cell, plus chapter links.
 */
function isNumberedVolumeTable(
  _$: CheerioAPI,
  $table: Cheerio<Element>
): { isNumbered: boolean; volumeNumber: number } {
  // Check for # header pattern
  const headerText = $table.find('tr').first().text().trim();
  const hasHashHeader = /^#\s/.test(headerText) || /\s#\s/.test(headerText);

  // Check first data cell for bare number (allow Volume 0 for prequels like JJK 0)
  const firstDataCell = $table.find('td').first().text().trim();
  const volumeNumber = parseInt(firstDataCell, 10);
  const isNumericCell = /^\d+$/.test(firstDataCell) && volumeNumber >= 0 && volumeNumber <= 200;

  // Must have chapter links to be a volume table (check all known conventions)
  let hasChapterLinks = $table.find('a[href*="Chapter"], a[title*="Chapter"]').length > 0;
  if (!hasChapterLinks) {
    // Check all naming conventions (Curse, Spell, Episode, etc.)
    for (const conv of NAMING_CONVENTIONS) {
      const baseMatch = conv.patterns[0]?.source.match(/^(\w+)/);
      if (baseMatch?.[1]) {
        const word = baseMatch[1];
        if ($table.find(`a[href*="${word}"], a[title*="${word}"]`).length > 0) {
          hasChapterLinks = true;
          break;
        }
      }
    }
  }

  const isNumbered = (hasHashHeader || isNumericCell) && hasChapterLinks;

  return { isNumbered, volumeNumber: isNumericCell ? volumeNumber : 0 };
}

/**
 * Parses a numbered volume table (uses # and bare numbers instead of "Volume X").
 */
function parseNumberedVolumeTable(
  $: CheerioAPI,
  $table: Cheerio<Element>,
  volumeNumber: number,
  convention?: NamingConvention | null
): PlainTableVolume | null {
  const chapters: PlainTableChapter[] = [];

  // Find cover image
  const $img = $table.find('img').first();
  const coverImage = $img.attr('data-src') ?? $img.attr('src');

  // Extract chapters from the table
  $table.find('td, th').each((_, cell) => {
    const $cell = $(cell);
    const cellChapters = extractChaptersFromCell($, $cell, volumeNumber, convention);
    chapters.push(...cellChapters);
  });

  // Extract release date
  const tableText = $table.text();
  let releaseDate: string | undefined;
  const dateMatch = tableText.match(/(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (dateMatch) {
    releaseDate = dateMatch[0];
  }

  // Extract ISBN
  let isbn: string | undefined;
  const isbnMatch = tableText.match(/ISBN\s*(978[-\s]?\d[-\s]?\d{2,5}[-\s]?\d{4,7}[-\s]?\d)/i);
  if (isbnMatch?.[1]) {
    isbn = isbnMatch[1].replace(/[-\s]/g, '');
  }

  // Inherit volume release date to all chapters in this volume
  if (releaseDate) {
    for (const ch of chapters) { ch.releaseDate = releaseDate; }
  }

  const volume: PlainTableVolume = {
    number: volumeNumber,
    chapters,
  };

  if (releaseDate) volume.releaseDate = releaseDate;
  if (isbn) volume.isbn = isbn;
  if (coverImage) volume.coverImage = coverImage;

  return volume;
}

/**
 * Processes a single table and returns extracted data.
 */
function processTable(
  $: CheerioAPI,
  $table: Cheerio<Element>,
  convention?: NamingConvention | null
): { volumes: PlainTableVolume[]; chapters: PlainTableChapter[] } | null {
  const tableText = $table.text();

  // Check for numbered volume table pattern (e.g., Demon Slayer with # header)
  // Allow Volume 0 for prequels like JJK 0
  const numberedCheck = isNumberedVolumeTable($, $table);
  if (numberedCheck.isNumbered && numberedCheck.volumeNumber >= 0) {
    const volume = parseNumberedVolumeTable($, $table, numberedCheck.volumeNumber, convention);
    if (volume && volume.chapters.length > 0) {
      return { volumes: [volume], chapters: volume.chapters };
    }
  }

  // Skip tables that don't look like volume tables
  if (!tableText.includes('Volume') && !tableText.includes('Vol')) {
    return null;
  }

  // Check if this is a unified chapter list table (uses naming convention + multiple volumes)
  const hasConventionPattern = detectTableConventionPattern(tableText);
  const multipleVolumes = (tableText.match(/Volume\s*\d+/gi) ?? []).length > 1;

  if (hasConventionPattern && multipleVolumes) {
    return parseUnifiedChapterTable($, $table, convention);
  }

  // Standard volume table parsing
  const hasVolumeData = /Volume\s*\d+/i.test(tableText);
  if (!hasVolumeData) return null;

  const volume = parseVolumeTable($, $table, convention);
  if (!volume) return null;

  return { volumes: [volume], chapters: volume.chapters };
}

export function parsePlainTableStructure(html: string): PlainTableParseResult {
  const $ = load(html);
  const volumes: PlainTableVolume[] = [];
  const allChapters: PlainTableChapter[] = [];
  const seenVolumes = new Set<number>();

  // Detect naming convention for this page
  const conventionResult = detectNamingConvention(html);
  const convention = conventionResult.convention;

  if (convention) {
    logger.info(`[plain-table-parser] Using ${convention.displayName} naming convention`);
  }

  // Find all tables in the content area (include .wikitable since many wikis use it for content).
  // Note: .collapsible.collapsed tables are included — the CSS class is a browser-side presentation
  // concern, but the HTML content is fully present server-side. Deduplication handles overlaps.
  const $content = $('.mw-parser-output');
  const $tables = $content.find('table').not('.navbox').not('.toc');

  logger.debug(`[plain-table-parser] Found ${$tables.length} plain tables`);

  $tables.each((_, table) => {
    const result = processTable($, $(table), convention);
    if (!result) return;

    for (const vol of result.volumes) {
      if (!seenVolumes.has(vol.number)) {
        seenVolumes.add(vol.number);
        volumes.push(vol);
      }
    }
    allChapters.push(...result.chapters);
  });

  // Sort volumes by number
  volumes.sort((a, b) => a.number - b.number);

  // Deduplicate chapters by number (handles Omnibus/Colossal editions that repeat chapters)
  const seenChapterNumbers = new Set<number>();
  const deduplicatedChapters: PlainTableChapter[] = [];
  for (const chapter of allChapters) {
    if (!seenChapterNumbers.has(chapter.number)) {
      seenChapterNumbers.add(chapter.number);
      deduplicatedChapters.push(chapter);
    }
  }
  if (deduplicatedChapters.length < allChapters.length) {
    logger.debug(`[plain-table-parser] Deduplicated ${allChapters.length} -> ${deduplicatedChapters.length} chapters`);
    allChapters.length = 0;
    allChapters.push(...deduplicatedChapters);
  }

  // Check if chapters need sequential renumbering (for title-only chapters like Future Diary)
  // This happens when multiple volumes have chapters starting at 1
  const volumesWithChapter1 = volumes.filter((v) => v.chapters.some((c) => c.number === 1));
  if (volumesWithChapter1.length > 1 && allChapters.length > 0) {
    // Renumber chapters sequentially based on volume order
    let globalChapterNumber = 1;
    for (const vol of volumes) {
      for (const chapter of vol.chapters) {
        chapter.number = globalChapterNumber;
        globalChapterNumber++;
      }
    }
    // Update allChapters with new numbers
    allChapters.length = 0;
    for (const vol of volumes) {
      allChapters.push(...vol.chapters);
    }
    logger.debug(`[plain-table-parser] Renumbered ${allChapters.length} chapters sequentially (title-only pattern)`);
  }

  // Sort chapters by number
  allChapters.sort((a, b) => a.number - b.number);

  logger.info(`[plain-table-parser] Parsed ${volumes.length} volumes, ${allChapters.length} chapters`);

  return {
    volumes,
    chapters: allChapters,
    success: volumes.length > 0,
  };
}

/**
 * Checks if a page uses plain table structure.
 *
 * @param html - HTML content to check
 * @returns true if the page has plain tables with volume data
 */
export function isPlainTableStructure(html: string): boolean {
  const $ = load(html);

  // Check for plain tables (not wikitable) that contain volume data
  const $content = $('.mw-parser-output');
  const $tables = $content.find('table').not('.wikitable').not('.navbox');

  let hasVolumeTable = false;
  $tables.each((_, table) => {
    const $table = $(table);
    const text = $table.text();

    // Pattern 1: Traditional "Volume X" pattern
    if (/Volume\s*\d+/i.test(text)) {
      hasVolumeTable = true;
      return false; // break
    }

    // Pattern 2: Numbered volume tables (# header with numeric first cell + chapter links)
    // Used by Demon Slayer and similar wikis
    const headerText = $table.find('tr').first().text().trim();
    const hasHashHeader = /^#\s/.test(headerText) || /\s#\s/.test(headerText);
    const firstDataCell = $table.find('td').first().text().trim();
    const isNumericCell = /^\d+$/.test(firstDataCell);
    const hasChapterLinks = $table.find('a[href*="Chapter"], a[title*="Chapter"]').length > 0;

    if ((hasHashHeader || isNumericCell) && hasChapterLinks) {
      hasVolumeTable = true;
      return false; // break
    }
  });

  return hasVolumeTable;
}
