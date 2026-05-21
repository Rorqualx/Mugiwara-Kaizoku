// @file-size-justified: Volume parser handles complex multi-format wiki tables (Fire Force, One Piece, Bleach styles) - splitting would break pattern detection
/* eslint-disable max-lines */
/**
 * Fandom Volume Parser
 *
 * Parses volume tables from Fandom wiki pages including Fire Force style
 * tables with detailed structure, chapter listings, and cover images.
 *
 * Extracted from: fandomTableParser.ts (lines 404-716)
 */

import * as cheerio from 'cheerio';

import { extractDateString, extractISBN } from '@/server/services/shared/parsing-utils';
import { logger } from '@/utils/logger';

import {
  extractChapterNumber as extractChapterNumberShared,
  extractChapterNumberFromUrl,
  extractSpecialChapterNumberOnly,
} from './chapter-extraction';
import { parseGalleryWithLists } from './fandom-gallery-parser';
import { detectWikiStructure } from './fandom-structure-detector';
import { VolumeData, WikiStructureType } from './fandom-types';

import type { Element } from 'domhandler';

/**
 * Chapter data structure
 */
interface ChapterInfo {
  number: number;
  title: string;
  url?: string;
}

/**
 * Try to extract special chapter number from text (Epilogue, Prologue, etc.)
 * Uses shared extraction utility
 */
function extractSpecialChapterNumber(text: string): number | undefined {
  return extractSpecialChapterNumberOnly(text);
}

/**
 * Builds a full URL from a relative href
 * @param href - The href to convert (may be relative or absolute)
 * @param baseUrl - Base URL of the wiki (required for relative URLs)
 * @returns Full URL, or undefined if href is empty or baseUrl missing for relative URL
 */
function buildFullUrl(href: string | undefined, baseUrl?: string): string | undefined {
  if (!href) return undefined;

  if (href.startsWith('http')) {
    return href;
  }

  if (href.startsWith('/')) {
    // baseUrl is required for relative URLs - no more hardcoded defaults
    if (!baseUrl) {
      logger.warn('[buildFullUrl] Relative URL without baseUrl, returning undefined', { href });
      return undefined;
    }
    return `${baseUrl}${href}`;
  }

  return undefined;
}

/**
 * Cleans and formats a Fandom image URL
 */
function cleanImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  // Remove any scale parameters to get full image
  let cleaned = url.replace(/\/scale-to-width-down\/\d+/, '');
  cleaned = cleaned.replace(/\/revision\/latest.*/, '/revision/latest');

  // Ensure it's an absolute URL
  if (!cleaned.startsWith('http')) {
    cleaned = cleaned.startsWith('//') ? `https:${cleaned}` : `https://${cleaned}`;
  }

  return cleaned;
}

/**
 * Extracts cover image from a table
 * Handles Fire Force wiki's collapsible sections with lazy-loaded images
 */
// eslint-disable-next-line complexity -- Multi-selector image extraction with multiple fallback strategies for various Fandom wiki structures
function extractCoverImage($: cheerio.CheerioAPI, $table: cheerio.Cheerio<Element>): string | undefined {
  // Try multiple image selectors - Fire Force wiki may have different structures
  const selectors = [
    'a.image img',                   // Image inside link (common for volume covers)
    '.image img',                    // Image inside .image class
    '.pi-image img',                 // Portable infobox image
    '.thumbimage',                   // Thumbnail images
    '[data-image-key] img',          // Fandom image container
    'img',                           // Direct image (last resort)
  ];

  let $img: cheerio.Cheerio<Element> | null = null;
  let linkHref: string | undefined;

  for (const selector of selectors) {
    const $found = $table.find(selector).first();
    if ($found.length > 0) {
      $img = $found;
      // Also grab the parent link href if it exists (contains full-size image URL)
      const parentLinkHref = $found.parent('a').attr('href') ?? $found.closest('a').attr('href');
      if (parentLinkHref) {
        linkHref = parentLinkHref;
      }
      break;
    }
  }

  if (!$img?.length) {
    // Debug: log what we found in the table
    const tableHtml = $table.html()?.substring(0, 500) ?? '';
    const hasAnyImg = $table.find('img').length;
    logger.debug('[extractCoverImage] No image found in volume table', {
      hasAnyImg,
      selectorsTried: selectors.length,
      tablePreview: tableHtml.substring(0, 200)
    });
    return undefined;
  }

  // Try various image attributes that Fandom uses (expanded list)
  // Also check parent link href for full-size image URL
  let coverImage = $img.attr('data-src') ??
                   $img.attr('data-image-url') ??
                   $img.attr('data-original') ??
                   $img.attr('data-lazy-src');

  // If img src is a placeholder GIF, try the link href instead
  const src = $img.attr('src');
  if (!coverImage && src && !src.startsWith('data:image/gif')) {
    coverImage = src;
  }

  // Fallback: get full-size image from parent link href
  if (!coverImage && linkHref?.includes('static.wikia.nocookie.net')) {
    coverImage = linkHref;
  }

  logger.debug('[extractCoverImage] Found image', {
    dataSrc: $img.attr('data-src')?.substring(0, 60),
    src: src?.substring(0, 60),
    linkHref: linkHref?.substring(0, 60),
    result: coverImage?.substring(0, 60)
  });

  return cleanImageUrl(coverImage);
}

/**
 * Extracts Japanese/CJK title from table text
 */
function extractJapaneseTitle(tableText: string, volumeNumber: number): string | undefined {
  const volumeNumPadded = volumeNumber.toString().padStart(2, '0');
  const patterns = [
    new RegExp(`([\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]+[\\s\\u3000]*${volumeNumPadded})`),
    new RegExp(`([\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]+[\\s\\u3000]*${volumeNumber})`),
  ];

  for (const pattern of patterns) {
    const match = tableText.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

/**
 * Extracts English title from bold/strong elements in table
 */
function extractTitleFromBoldElements(
  $table: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI,
  volumeNumber: number
): string | undefined {
  const volumeNumPadded = volumeNumber.toString().padStart(2, '0');
  const volumeNumPlain = volumeNumber.toString();
  let title: string | undefined;

  $table.find('b, strong').each((_, el) => {
    if (title) return;
    const text = $(el).text().trim();

    // Skip if text is too short or doesn't have letters
    if (text.length < 5 || !/[a-zA-Z]/.test(text)) return;

    // Skip header-like text
    if (text.toLowerCase().includes('title') ||
        text.toLowerCase().includes('release date') ||
        text.toLowerCase().includes('cover character')) return;

    // Check if text ends with the volume number (either format)
    // Use regex to ensure we match the exact number, not a substring
    const paddedPattern = new RegExp(`\\s${volumeNumPadded}$`);
    const plainPattern = new RegExp(`\\s${volumeNumPlain}$`);

    if (paddedPattern.test(text) || plainPattern.test(text)) {
      title = text;
    }
  });

  return title;
}

/**
 * Extracts title from table cells - looks for cells containing "SeriesName NN" pattern
 *
 * Uses flexible regex that:
 * - Tolerates leading/trailing whitespace
 * - Matches "Series Name 01" pattern anywhere in the text
 * - Captures the full title including the volume number
 */
function extractTitleFromTableCells(
  $table: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI,
  volumeNumber: number
): string | undefined {
  const volumeNumPadded = volumeNumber.toString().padStart(2, '0');
  const volumeNumPlain = volumeNumber.toString();

  // Patterns - match title ending with volume number (allowing trailing whitespace)
  // Removed ^ anchor to allow matching within cell text
  const paddedPattern = new RegExp(`([A-Za-z][A-Za-z0-9 \\-:!']+)\\s+${volumeNumPadded}\\s*$`);
  const plainPattern = new RegExp(`([A-Za-z][A-Za-z0-9 \\-:!']+)\\s+${volumeNumPlain}\\s*$`);

  let foundTitle: string | undefined;

  $table.find('td').each((_, cell) => {
    if (foundTitle) return;

    // Get direct text content, trimmed
    const text = $(cell).text().trim();

    // Skip if too short or too long (likely not a title)
    if (text.length < 5 || text.length > 100) return;

    // Skip header-like text
    if (/title|release date|cover character|chapters/i.test(text)) return;

    // Try matching padded pattern first (e.g., "Fire Force 01")
    const paddedMatch = text.match(paddedPattern);
    if (paddedMatch?.[0]) {
      foundTitle = paddedMatch[0].trim();
      return;
    }

    // Try plain pattern (e.g., "Fire Force 1")
    const plainMatch = text.match(plainPattern);
    if (plainMatch?.[0]) {
      foundTitle = plainMatch[0].trim();
    }
  });

  return foundTitle;
}

/**
 * Extracts English and Japanese titles from table using multiple strategies
 * Works with any manga series, not just Fire Force
 */
function extractTitles(
  $table: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI,
  tableText: string,
  volumeNumber: number
): {
  title: string;
  alternativeTitle?: string;
} {
  let title: string | undefined;

  // Strategy 1: Look for title in table cells (most reliable for Fire Force style)
  // Looks for cells containing "SeriesName NN" pattern
  title = extractTitleFromTableCells($table, $, volumeNumber);

  // Strategy 2: Look for bold/strong text containing volume number
  if (!title) {
    title = extractTitleFromBoldElements($table, $, volumeNumber);
  }

  // Strategy 3: Extract Japanese title
  const alternativeTitle = extractJapaneseTitle(tableText, volumeNumber);

  return {
    title: title ?? `Volume ${volumeNumber}`,
    ...(alternativeTitle !== undefined ? { alternativeTitle } : {})
  };
}

/**
 * Extracts chapter information from a list item
 * Handles regular chapters (00. Title), special chapters (Epilogue 1, Prologue, etc.),
 * and naming conventions (Stage 5, Mission 3, Episode 12, etc.)
 */
function extractChapterFromListItem(
  $: cheerio.CheerioAPI,
  $li: cheerio.Cheerio<Element>,
  baseUrl?: string
): ChapterInfo | undefined {
  // Try to find a chapter link first
  const $link = $li.find('a[href*="/wiki/Chapter_"], a[href*="/wiki/Epilogue"], a[href*="/wiki/Prologue"]').first();

  const liText = $li.text().trim();
  const linkText = $link.length ? $link.text().trim() : '';
  const href = $link.length ? $link.attr('href') : undefined;

  // Extract chapter number from the list item text (e.g., "00. Title" or "22. Title")
  let chapterNumber: number | undefined;

  // Match patterns like "00." "01." "22." etc.
  const numberMatch = liText.match(/^(\d{1,3})\./);
  if (numberMatch?.[1]) {
    chapterNumber = parseInt(numberMatch[1], 10);
  } else {
    // Try shared extraction (handles special chapters + naming conventions)
    const sharedResult = extractChapterNumberShared(liText);
    if (sharedResult) {
      chapterNumber = sharedResult.number;
    }

    // Fallback to extracting from href using shared utility
    if (chapterNumber === undefined && href) {
      const urlResult = extractChapterNumberFromUrl(href);
      if (urlResult) {
        chapterNumber = urlResult.number;
      }
    }
  }

  if (chapterNumber === undefined) return undefined;

  const fullUrl = buildFullUrl(href, baseUrl);
  const chapter: ChapterInfo = {
    number: chapterNumber,
    title: linkText || liText.replace(/^\d+\.\s*/, '') || `Chapter ${chapterNumber}`,
  };

  if (fullUrl !== undefined) chapter.url = fullUrl;

  return chapter;
}

/**
 * Extracts chapters from <ul> lists (Fire Force wiki format)
 */
function extractChaptersFromLists(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<Element>,
  baseUrl?: string
): Map<number, ChapterInfo> {
  const chaptersMap = new Map<number, ChapterInfo>();
  const chapterLists = $table.find('ul');

  chapterLists.each((_, ul) => {
    const $ul = $(ul);
    const $items = $ul.find('li');

    $items.each((_, li) => {
      const $li = $(li);
      const chapter = extractChapterFromListItem($, $li, baseUrl);

      // Only add if we have valid chapter and haven't seen this chapter yet
      if (chapter && !chaptersMap.has(chapter.number)) {
        chaptersMap.set(chapter.number, chapter);
      }
    });
  });

  return chaptersMap;
}

/**
 * Extracts chapter information from a direct link
 * Handles regular chapters and special chapters (Epilogue, Prologue, etc.)
 */
function extractChapterFromLink(
  _$: cheerio.CheerioAPI,
  $link: cheerio.Cheerio<Element>,
  baseUrl?: string
): ChapterInfo | undefined {
  const href = $link.attr('href');
  const linkText = $link.text().trim();

  let chapterNumber: number | undefined;

  // Special handling for Volume 0 prequel format: Chapter_0-1 → 0.1
  if (href) {
    const zeroMatch = href.match(/Chapter_0+-(\d+)/i);
    if (zeroMatch?.[1]) {
      chapterNumber = parseFloat(`0.${zeroMatch[1]}`);
    }
  }

  // Try regular chapter pattern from href
  if (chapterNumber === undefined) {
    const hrefMatch = href?.match(/Chapter_(\d+(?:_\d+)?)/i);
    if (hrefMatch?.[1]) {
      chapterNumber = parseFloat(hrefMatch[1].replace('_', '.'));
    }
  }

  if (chapterNumber === undefined) {
    // Try special chapter patterns from link text
    chapterNumber = extractSpecialChapterNumber(linkText);

    // Try special chapters from href
    if (chapterNumber === undefined && href) {
      const epilogueHrefMatch = href.match(/Epilogue_?(\d*)/i);
      if (epilogueHrefMatch) {
        const num = epilogueHrefMatch[1] ? parseInt(epilogueHrefMatch[1], 10) : 1;
        chapterNumber = 1000 + num;
      }
    }
  }

  if (chapterNumber === undefined) return undefined;

  const fullUrl = buildFullUrl(href, baseUrl);

  const chapter: ChapterInfo = {
    number: chapterNumber,
    title: linkText || `Chapter ${chapterNumber}`,
  };

  if (fullUrl !== undefined) chapter.url = fullUrl;

  return chapter;
}

/**
 * Extracts chapters from direct chapter links in the table
 * Includes both regular chapter links and special chapter links (Epilogue, Prologue)
 */
function extractChaptersFromLinks(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<Element>,
  baseUrl?: string
): Map<number, ChapterInfo> {
  const chaptersMap = new Map<number, ChapterInfo>();
  // Include links to regular chapters and special chapters
  const chapterLinks = $table.find('a[href*="/wiki/Chapter_"], a[href*="/wiki/Epilogue"], a[href*="/wiki/Prologue"]');

  chapterLinks.each((_, link) => {
    const $link = $(link);
    const chapter = extractChapterFromLink($, $link, baseUrl);

    if (chapter && !chaptersMap.has(chapter.number)) {
      chaptersMap.set(chapter.number, chapter);
    }
  });

  return chaptersMap;
}

/**
 * Extracts chapters from plain text (fallback method)
 * Handles regular chapters and special chapters (Epilogue, Prologue, etc.)
 */
// eslint-disable-next-line complexity -- Multi-format text parsing: regular chapters, epilogues, prologues, finals, extras, specials with different numbering schemes
function extractChaptersFromText(tableText: string): Map<number, ChapterInfo> {
  const chaptersMap = new Map<number, ChapterInfo>();
  const chapterSection = tableText.split('Chapters')[1]?.split('ISBN')[0];

  if (!chapterSection) return chaptersMap;

  // Match regular chapters: "00. Title" or "22. Title"
  const chapterMatches = chapterSection.matchAll(/(\d+)(?:\.\s+|\s*[.:]?\s*)([^\n(]+?)(?:\s*\([^)]+\))?(?:\n|$)/g);

  for (const match of chapterMatches) {
    if (!match[1] || !match[2]) continue;

    const chapterNumber = parseInt(match[1], 10);
    if (isNaN(chapterNumber) || chaptersMap.has(chapterNumber)) continue;

    const chapterTitle = match[2].trim();
    chaptersMap.set(chapterNumber, {
      number: chapterNumber,
      title: chapterTitle || `Chapter ${chapterNumber}`
    });
  }

  // Also look for special chapters (Epilogue, Prologue, etc.)
  const specialMatches = chapterSection.matchAll(/(Epilogue|Prologue|Final Chapter|Extra|Special)\s*(\d*)[.:\s]*([^\n(]+?)(?:\s*\([^)]+\))?(?:\n|$)/gi);

  for (const match of specialMatches) {
    const specialType = match[1]?.toLowerCase() ?? '';
    const specialNum = match[2] ? parseInt(match[2], 10) : 1;
    const specialTitle = match[3]?.trim() ?? match[1] ?? '';

    let chapterNumber: number;
    if (specialType.includes('epilogue')) {
      chapterNumber = 1000 + specialNum;
    } else if (specialType.includes('prologue')) {
      chapterNumber = specialNum > 0 ? -100 + specialNum : 0;
    } else if (specialType.includes('final')) {
      chapterNumber = 2000 + specialNum;
    } else if (specialType.includes('extra')) {
      chapterNumber = 3000 + specialNum;
    } else if (specialType.includes('special')) {
      chapterNumber = 4000 + specialNum;
    } else {
      continue;
    }

    if (!chaptersMap.has(chapterNumber)) {
      chaptersMap.set(chapterNumber, {
        number: chapterNumber,
        title: specialTitle || `${match[1]} ${specialNum > 0 ? specialNum : ''}`.trim()
      });
      logger.info(`[fandom-volume-parser] Found special chapter in text: "${match[0]}" -> ${chapterNumber}`);
    }
  }

  return chaptersMap;
}

/**
 * Extracts all chapters from a table using multiple strategies
 */
function extractChapters(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<Element>,
  tableText: string,
  baseUrl?: string
): ChapterInfo[] {
  // First try to find chapters in <ul> lists (Fire Force wiki format)
  let chaptersMap = extractChaptersFromLists($, $table, baseUrl);

  // If no chapters found in lists, try direct chapter links in the table
  if (chaptersMap.size === 0) {
    chaptersMap = extractChaptersFromLinks($, $table, baseUrl);
  }

  // If still no chapters, fall back to text extraction
  if (chaptersMap.size === 0) {
    chaptersMap = extractChaptersFromText(tableText);
  }

  return Array.from(chaptersMap.values());
}

/**
 * Merges new volume data with existing volume data
 */
function mergeVolumeData(existing: VolumeData, volumeData: VolumeData, volumeNumber: number): VolumeData {
  const mergedTitle = volumeData.title ?? existing.title ?? `Volume ${volumeNumber}`;
  const merged: VolumeData = {
    ...existing,
    title: mergedTitle,
  };

  const mergedAlternativeTitle = volumeData.alternativeTitle ?? existing.alternativeTitle;
  if (mergedAlternativeTitle !== undefined) merged.alternativeTitle = mergedAlternativeTitle;

  const mergedCoverImage = volumeData.coverImage ?? existing.coverImage;
  if (mergedCoverImage !== undefined) merged.coverImage = mergedCoverImage;

  const mergedReleaseDate = volumeData.releaseDate ?? existing.releaseDate;
  if (mergedReleaseDate !== undefined) merged.releaseDate = mergedReleaseDate;

  const mergedIsbn = volumeData.isbn ?? existing.isbn;
  if (mergedIsbn !== undefined) merged.isbn = mergedIsbn;

  const mergedChapters = (volumeData.chapters && volumeData.chapters.length > 0)
    ? volumeData.chapters
    : existing.chapters;
  if (mergedChapters !== undefined) merged.chapters = mergedChapters;

  return merged;
}

/**
 * Extracts chapter data from a cell containing chapter links
 * (Solo Leveling / fandom-table style)
 */
function extractChaptersFromCell(
  $: cheerio.CheerioAPI,
  $cell: cheerio.Cheerio<Element>,
  baseUrl?: string
): ChapterInfo[] {
  const chapters: ChapterInfo[] = [];
  const seenNumbers = new Set<number>();

  $cell.find('a[href*="/wiki/Chapter_"], a[href*="/wiki/Prologue"], a[href*="/wiki/Epilogue"]').each((_, el) => {
    const $link = $(el);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();

    const chapterNum = parseChapterFromHref(href);
    if (chapterNum === undefined || seenNumbers.has(chapterNum)) return;
    seenNumbers.add(chapterNum);

    const chapterInfo: ChapterInfo = { number: chapterNum, title: text || `Chapter ${chapterNum}` };
    const fullUrl = href.startsWith('http') ? href : (baseUrl ? `${baseUrl}${href}` : undefined);
    if (fullUrl) chapterInfo.url = fullUrl;
    chapters.push(chapterInfo);
  });

  return chapters.sort((a, b) => a.number - b.number);
}

/** Parse chapter number from href */
function parseChapterFromHref(href: string): number | undefined {
  // Special handling for Volume 0 prequel format: Chapter_0-1 → 0.1, Chapter_0-2 → 0.2
  const zeroChapterMatch = href.match(/Chapter_0+-(\d+)/i);
  if (zeroChapterMatch?.[1]) {
    return parseFloat(`0.${zeroChapterMatch[1]}`);
  }

  const chapterMatch = href.match(/Chapter_(\d+(?:\.\d+)?)/i);
  if (chapterMatch?.[1]) return parseFloat(chapterMatch[1]);
  if (/Prologue/i.test(href)) return 0;
  if (/Epilogue/i.test(href)) return 1001;
  return undefined;
}

/** Get column indices from table headers */
function getFandomTableColumnIndices(headerTexts: string[]): { volumeCol: number; chaptersCol: number; coverCol: number } {
  return {
    volumeCol: headerTexts.findIndex(h => h === '#' || h.includes('vol')),
    chaptersCol: headerTexts.findIndex(h => h.includes('chapter')),
    coverCol: headerTexts.findIndex(h => h.includes('cover'))
  };
}

/** Extract cover image URL from a cell */
function extractCoverFromCell($: cheerio.CheerioAPI, $cell: cheerio.Cheerio<Element>): string | undefined {
  const $img = $cell.find('img').first();
  if (!$img.length) return undefined;
  const rawUrl = $img.attr('data-src') ?? $img.attr('src');
  if (!rawUrl || rawUrl.includes('data:image')) return undefined;
  return cleanImageUrl(rawUrl);
}

/** Volume data being built during fandom-table parsing */
interface FandomTableVolume {
  vol: number;
  title?: string;
  cover?: string;
  chapters: ChapterInfo[];
}

/** Processes fandom-table article-table style tables (Solo Leveling format) */
function processFandomTableRows(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<Element>,
  volumeMap: Map<number, VolumeData>,
  baseUrl?: string
): void {
  const $headers = $table.find('th');
  if ($headers.length < 3) return;

  const headerTexts = $headers.map((_, th) => $(th).text().toLowerCase().trim()).get();
  const { volumeCol, chaptersCol, coverCol } = getFandomTableColumnIndices(headerTexts);
  if (volumeCol < 0 || chaptersCol < 0) return;

  let current: FandomTableVolume | null = null;

  $table.find('tr').each((rowIdx, row) => {
    if (rowIdx === 0) return;
    const $cells = $(row).find('td');
    if ($cells.length === 0) return;

    const volMatch = $cells.first().text().trim().match(/^\d+$/);
    if (volMatch) {
      if (current && current.chapters.length > 0) saveVolume(volumeMap, current);
      current = { vol: parseInt(volMatch[0], 10), chapters: [] };
      if ($cells.length > 1) {
        const titleText = $cells.eq(1).find('b, strong').first().text().trim();
        if (titleText.toLowerCase().includes('volume')) current.title = titleText;
      }
    }

    if (!current) return;
    if ($cells.length > chaptersCol) {
      current.chapters.push(...extractChaptersFromCell($, $cells.eq(chaptersCol), baseUrl));
    }
    if (coverCol >= 0 && $cells.length > coverCol && !current.cover) {
      const coverUrl = extractCoverFromCell($, $cells.eq(coverCol));
      if (coverUrl) current.cover = coverUrl;
    }
  });

  // Save final volume (type assertion needed after .each() callback)
  const finalVolume = current as FandomTableVolume | null;
  if (finalVolume && finalVolume.chapters.length > 0) saveVolume(volumeMap, finalVolume);
}

/** Helper to save volume to map */
function saveVolume(volumeMap: Map<number, VolumeData>, current: FandomTableVolume): void {
  const volumeData: VolumeData = {
    number: current.vol,
    title: current.title ?? `Volume ${current.vol}`,
    chapters: current.chapters
  };
  if (current.cover) volumeData.coverImage = current.cover;
  volumeMap.set(current.vol, volumeData);
}

/** Extract chapters from cells in a nav table row */
function extractChaptersFromNavRow(
  $: cheerio.CheerioAPI,
  $cells: cheerio.Cheerio<Element>,
  baseUrl?: string
): ChapterInfo[] {
  const chapters: ChapterInfo[] = [];
  const seenChapters = new Set<number>();

  $cells.slice(1).find('a[href*="/wiki/Chapter_"]').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();

    const chapterNum = parseChapterFromHref(href);
    if (chapterNum === undefined || seenChapters.has(chapterNum)) return;
    seenChapters.add(chapterNum);

    const chapter: ChapterInfo = { number: chapterNum, title: text || `Chapter ${chapterNum}` };
    const fullUrl = href.startsWith('http') ? href : (baseUrl ? `${baseUrl}${href}` : undefined);
    if (fullUrl) chapter.url = fullUrl;
    chapters.push(chapter);
  });

  return chapters.sort((a, b) => a.number - b.number);
}

/**
 * Processes collapsible navigation tables (Dandadan style)
 * Format: "Volume X | 1 • 2 • 3 • ..." with chapter links
 */
function processCollapsibleNavTable(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<Element>,
  volumeMap: Map<number, VolumeData>,
  baseUrl?: string
): void {
  $table.find('tr').each((_, row) => {
    const $row = $(row);
    const $cells = $row.find('td');
    if ($cells.length < 2) return;

    // Check if first cell contains "Volume X" pattern
    const firstCellText = $cells.first().text().trim();
    const volumeMatch = firstCellText.match(/^Volume\s+(\d+)$/i);
    if (!volumeMatch?.[1]) return;

    const volumeNumber = parseInt(volumeMatch[1], 10);
    if (isNaN(volumeNumber)) return;

    const chapters = extractChaptersFromNavRow($, $cells, baseUrl);
    if (chapters.length === 0) return;

    const volumeData: VolumeData = {
      number: volumeNumber,
      title: `Volume ${volumeNumber}`,
      chapters
    };

    volumeMap.set(volumeNumber, volumeData);
    logger.debug(`[processCollapsibleNavTable] Volume ${volumeNumber}: ${chapters.length} chapters`);
  });
}

/** Extract cover URL from a chapters row */
function extractCoverFromChaptersRow(
  $: cheerio.CheerioAPI,
  $row: cheerio.Cheerio<Element>
): string | undefined {
  const $imgs = $row.find('img');
  if ($imgs.length === 0) return undefined;

  const $img = $imgs.first();
  const coverUrl = $img.attr('data-src') ?? $img.attr('src');
  if (!coverUrl) return undefined;

  // Clean the URL - remove revision/scale parameters
  return coverUrl.split('/revision')[0] ?? coverUrl;
}

/**
 * Extract volume covers from main detail table (Dandadan style)
 * Table structure: Row with volume # -> Row with "Chapters list:" and cover images
 */
function extractCoversFromDetailTable(
  $: cheerio.CheerioAPI,
  volumeMap: Map<number, VolumeData>
): void {
  const $mainTable = $('table').not('.mw-collapsible').first();
  if (!$mainTable.length) return;

  let currentVolume: number | undefined;

  $mainTable.find('tr').each((_, row) => {
    const $row = $(row);
    const rowText = $row.text().trim();

    // Check if row starts with volume number (e.g., "1 August 4, 2021...")
    const volMatch = rowText.match(/^(\d+)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
    if (volMatch?.[1]) {
      currentVolume = parseInt(volMatch[1], 10);
      return;
    }

    // Check if this is a "Chapters list:" row with covers
    if (currentVolume === undefined || !rowText.includes('Chapters list')) return;

    const coverUrl = extractCoverFromChaptersRow($, $row);
    if (coverUrl) {
      const volume = volumeMap.get(currentVolume);
      if (volume && !volume.coverImage) {
        volume.coverImage = coverUrl;
        logger.debug(`[extractCoversFromDetailTable] Volume ${currentVolume}: cover found`);
      }
    }
    currentVolume = undefined;
  });
}

/**
 * Extract volume covers from individual volume tables (JJK style)
 * Each volume has its own table with "Volume X" header and cover images
 */
function extractCoversFromIndividualTables(
  $: cheerio.CheerioAPI,
  volumeMap: Map<number, VolumeData>
): void {
  // Find all tables that contain Volume X headers
  $('table').not('.mw-collapsible').each((_, table) => {
    const $table = $(table);
    const tableText = $table.text();

    // Look for "Volume X" pattern in the table text
    const volumeMatch = tableText.match(/Volume\s+(\d+)\b/i);
    if (!volumeMatch?.[1]) return;

    const volumeNumber = parseInt(volumeMatch[1], 10);
    if (isNaN(volumeNumber)) return;

    // Check if we have this volume in our map and it needs a cover
    const volume = volumeMap.get(volumeNumber);
    if (!volume || volume.coverImage) return;

    // Find cover image in this table
    const $img = $table.find('img').first();
    if (!$img.length) return;

    // Get image URL from data-src or src
    let coverUrl = $img.attr('data-src') ?? $img.attr('src');
    if (!coverUrl || coverUrl.startsWith('data:image')) {
      // Try getting from parent link href
      const $link = $img.closest('a');
      coverUrl = $link.attr('href');
    }

    if (coverUrl?.includes('static.wikia.nocookie.net')) {
      // Clean the URL
      const cleanUrl = coverUrl.split('/revision')[0] ?? coverUrl;
      volume.coverImage = cleanUrl;
      logger.debug(`[extractCoversFromIndividualTables] Volume ${volumeNumber}: cover found`);
    }
  });

  // Count volumes with covers for logging
  const withCovers = Array.from(volumeMap.values()).filter(v => v.coverImage).length;
  logger.info(`[extractCoversFromIndividualTables] Added covers to ${withCovers} volumes`);
}

/**
 * Extract chapter titles from individual volume tables (JJK style)
 * Pattern: "001. Chapter Title (Japanese, Romaji?)"
 */
function extractChapterTitlesFromIndividualTables(
  $: cheerio.CheerioAPI,
  volumeMap: Map<number, VolumeData>
): void {
  // Iterate all tables to find chapter titles
  $('table').not('.mw-collapsible').each((_, table) => {
    const $table = $(table);
    const tableText = $table.text();

    // Look for "Volume X" pattern to identify which volume this is
    const volumeMatch = tableText.match(/Volume\s+(\d+)\b/i);
    if (!volumeMatch?.[1]) return;

    const volumeNumber = parseInt(volumeMatch[1], 10);
    if (isNaN(volumeNumber)) return;

    const volume = volumeMap.get(volumeNumber);
    if (!volume?.chapters) return;

    // Extract chapter titles from this table
    // Match patterns like "001. Title Name" or "1. Title Name"
    const titleMatches = tableText.matchAll(/(\d{1,3})\.\s+([^(\n]+?)(?:\s*\(|$)/g);
    const chapterTitles = new Map<number, string>();

    for (const match of titleMatches) {
      const chapterNum = parseInt(match[1] ?? '0', 10);
      const title = (match[2] ?? '').trim();
      if (chapterNum > 0 && title.length > 1 && title.length < 100) {
        chapterTitles.set(chapterNum, title);
      }
    }

    // Update chapter titles in the volume
    for (const chapter of volume.chapters as ChapterInfo[]) {
      const title = chapterTitles.get(chapter.number);
      if (title) {
        chapter.title = title;
      }
    }
  });
}

/**
 * Extract chapter titles from main detail table (Dandadan style)
 * Pattern: "001. Title Name (Japanese, Romaji?)"
 */
function extractChapterTitlesFromDetailTable(
  $: cheerio.CheerioAPI,
  volumeMap: Map<number, VolumeData>
): void {
  const $mainTable = $('table').not('.mw-collapsible').first();
  if (!$mainTable.length) return;

  // Build a map of chapter number -> title from the table text
  const chapterTitles = new Map<number, string>();
  const tableText = $mainTable.text();

  // Match patterns like "001. Title Name" - captures 3-digit number and title up to Japanese text
  const titleMatches = tableText.matchAll(/(\d{3})\.\s+([^(\n]+?)(?:\s*\(|$)/g);
  for (const match of titleMatches) {
    const chapterNum = parseInt(match[1] ?? '0', 10);
    const title = (match[2] ?? '').trim();
    if (chapterNum > 0 && title.length > 0) {
      chapterTitles.set(chapterNum, title);
    }
  }

  logger.debug(`[extractChapterTitlesFromDetailTable] Found ${chapterTitles.size} chapter titles`);

  // Update chapters in all volumes with the extracted titles
  for (const volume of volumeMap.values()) {
    if (!volume.chapters) continue;
    for (const chapter of volume.chapters as ChapterInfo[]) {
      const title = chapterTitles.get(chapter.number);
      if (title) {
        chapter.title = title;
      }
    }
  }
}

/**
 * Extract volume number from cell text
 */
function extractVolumeNumberFromCell(cellText: string): number | undefined {
  const match = cellText.trim().match(/^Volume\s+(\d+)$/i);
  return match?.[1] ? parseInt(match[1], 10) : undefined;
}

/**
 * Extract English volume title from chapters row
 * Sakamoto Days style: Title is bold text at start of cell, before "Pages:" or "Cover character"
 * Example: "The Legendary Hitman\nPages:\n192 (Japanese)..."
 */
function extractEnglishVolumeTitle(
  $: cheerio.CheerioAPI,
  $row: cheerio.Cheerio<Element>
): string | undefined {
  // Look for cells that contain "Pages:" which indicates the English info cell
  const $cells = $row.find('td');

  let title: string | undefined;

  $cells.each((_, cell) => {
    if (title) return;
    const $cell = $(cell);
    const cellText = $cell.text().trim();

    // Skip cells that only have chapters (contain "Days" links but no "Pages:")
    if (!cellText.includes('Pages:')) return;

    // Try to find bold text at the start (the volume title)
    const $bold = $cell.find('b, strong').first();
    if ($bold.length > 0) {
      const boldText = $bold.text().trim();
      // Validate it's a title (not "Pages:" or other labels)
      if (boldText.length > 0 &&
          !boldText.includes('Pages') &&
          !boldText.includes('Cover') &&
          !boldText.includes('Chapter')) {
        title = boldText;
        return;
      }
    }

    // Fallback: Extract text before "Pages:" or "Cover character"
    const textBeforePages = cellText.split(/Pages:|Cover character/i)[0]?.trim();
    if (textBeforePages && textBeforePages.length > 0 && textBeforePages.length < 100) {
      // Clean up: Remove any chapter-related text
      const cleanTitle = textBeforePages
        .split('\n')[0]  // Take first line only
        ?.trim();
      if (cleanTitle && cleanTitle.length > 1 && !cleanTitle.includes('Days ')) {
        title = cleanTitle;
      }
    }
  });

  return title;
}

/**
 * Extract cover image from chapters row
 * Sakamoto Days style: Cover image is in the same cell as the English info
 */
function extractCoverFromChaptersRowCell(
  $: cheerio.CheerioAPI,
  $row: cheerio.Cheerio<Element>
): string | undefined {
  // Look for cells that contain images
  const $cells = $row.find('td');

  let coverUrl: string | undefined;

  $cells.each((_, cell) => {
    if (coverUrl) return;
    const $cell = $(cell);

    // Look for image in this cell
    const $img = $cell.find('img').first();
    if (!$img.length) return;

    // Get image URL from data-src or src
    let url = $img.attr('data-src') ?? $img.attr('src');

    // Skip placeholder images
    if (!url || url.startsWith('data:image')) {
      // Try getting from parent link href
      const $link = $img.closest('a');
      url = $link.attr('href');
    }

    // Validate it's a wikia image
    if (url?.includes('static.wikia.nocookie.net')) {
      coverUrl = cleanImageUrl(url);
    }
  });

  return coverUrl;
}

/**
 * Extract chapters from the row following a volume row
 */
function extractChaptersFromFollowingRow(
  $: cheerio.CheerioAPI,
  $chapterRow: cheerio.Cheerio<Element>,
  baseUrl?: string
): ChapterInfo[] {
  const chapters: ChapterInfo[] = [];
  const seenNumbers = new Set<number>();

  $chapterRow.find('a[href*="/wiki/Chapter_"]').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();

    const chapterNum = parseChapterFromHref(href);
    if (chapterNum === undefined || seenNumbers.has(chapterNum)) return;
    seenNumbers.add(chapterNum);

    const chapter: ChapterInfo = { number: chapterNum, title: text || `Chapter ${chapterNum}` };
    if (href) {
      const fullUrl = href.startsWith('http') ? href : (baseUrl ? `${baseUrl}${href}` : undefined);
      if (fullUrl) chapter.url = fullUrl;
    }
    chapters.push(chapter);
  });

  return chapters.sort((a, b) => a.number - b.number);
}

/**
 * Process alternating-row table structure (Sakamoto Days style)
 * Pattern: Volume info row -> Chapters row -> Volume info row -> Chapters row
 *
 * The chapters row contains:
 * - Chapter links (left cell)
 * - English info with title, pages, cover characters, and cover image (right cell)
 */
function processAlternatingRowTable(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<Element>,
  volumeMap: Map<number, VolumeData>,
  baseUrl?: string
): void {
  const $rows = $table.find('tr');

  $rows.each((rowIdx, row) => {
    const $row = $(row);
    const $cells = $row.find('td, th');

    // Look for a cell that contains exactly "Volume N"
    let volumeNumber: number | undefined;
    let volumeCellIdx = -1;

    $cells.each((cellIdx, cell) => {
      if (volumeNumber !== undefined) return;
      const cellText = $(cell).text().trim();
      const num = extractVolumeNumberFromCell(cellText);
      if (num !== undefined) {
        volumeNumber = num;
        volumeCellIdx = cellIdx;
      }
    });

    if (volumeNumber === undefined || volumeCellIdx < 0) return;

    // Found a volume row - extract metadata from this row
    const rowText = $row.text();
    const releaseDate = extractDateString(rowText) ?? undefined;
    const isbnResult = extractISBN(rowText);
    const isbn = isbnResult?.isbn13 ?? isbnResult?.isbn10;

    // Get data from the NEXT row (chapters row)
    const $nextRow = $rows.eq(rowIdx + 1);
    const chapters = $nextRow.length ? extractChaptersFromFollowingRow($, $nextRow, baseUrl) : [];

    // Extract English volume title from the chapters row (e.g., "The Legendary Hitman")
    const englishTitle = $nextRow.length ? extractEnglishVolumeTitle($, $nextRow) : undefined;

    // Extract cover image from the chapters row
    const coverImage = $nextRow.length ? extractCoverFromChaptersRowCell($, $nextRow) : undefined;

    const volumeData: VolumeData = {
      number: volumeNumber,
      title: englishTitle ?? `Volume ${volumeNumber}`,
      chapters
    };

    if (releaseDate !== undefined) volumeData.releaseDate = releaseDate;
    if (isbn !== undefined) volumeData.isbn = isbn;
    if (coverImage !== undefined) volumeData.coverImage = coverImage;

    volumeMap.set(volumeNumber, volumeData);
    logger.debug(`[processAlternatingRowTable] Volume ${volumeNumber}: ${chapters.length} chapters, title="${volumeData.title}", cover=${!!coverImage}`);
  });
}

/**
 * Check if a table uses alternating-row structure (volume row followed by chapters row)
 */
function isAlternatingRowStructure($: cheerio.CheerioAPI, $table: cheerio.Cheerio<Element>): boolean {
  const $rows = $table.find('tr');
  let volumeRowCount = 0;
  let followedByChapters = 0;

  $rows.each((rowIdx, row) => {
    const rowText = $(row).text().trim();
    if (/^Volume\s+\d+/i.test(rowText.substring(0, 15))) {
      volumeRowCount++;
      // Check if next row has chapter links
      const $nextRow = $rows.eq(rowIdx + 1);
      if ($nextRow.find('a[href*="/wiki/Chapter_"]').length > 0) {
        followedByChapters++;
      }
    }
  });

  // At least 3 volumes with chapters following = alternating pattern
  return volumeRowCount >= 3 && followedByChapters >= 3;
}

/**
 * Processes a single table element to extract volume data
 */
function processVolumeTable(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<Element>,
  baseUrl?: string
): VolumeData | undefined {
  const tableText = $table.text();

  // Look for volume number in parentheses like "(Volume 34)" or in text
  const volumeMatch = tableText.match(/\(Volume\s+(\d+)\)|Fire Force\s+(\d+)/i);
  if (!volumeMatch) return undefined;

  const volumeNumberStr = volumeMatch[1] ?? volumeMatch[2];
  if (!volumeNumberStr) return undefined;

  const volumeNumber = parseInt(volumeNumberStr, 10);
  const coverImage = extractCoverImage($, $table);
  const { title, alternativeTitle } = extractTitles($table, $, tableText, volumeNumber);

  // Extract release date using shared utility
  const releaseDate = extractDateString(tableText) ?? undefined;

  // Extract chapters from the table
  const chapters = extractChapters($, $table, tableText, baseUrl);

  // Extract ISBN using shared utility
  const isbnResult = extractISBN(tableText);
  const isbn = isbnResult?.isbn13 ?? isbnResult?.isbn10;

  const volumeData: VolumeData = {
    number: volumeNumber,
    title
  };

  if (alternativeTitle !== undefined) volumeData.alternativeTitle = alternativeTitle;
  if (coverImage !== undefined) volumeData.coverImage = coverImage;
  if (releaseDate !== undefined) volumeData.releaseDate = releaseDate;
  if (isbn !== undefined) volumeData.isbn = isbn;
  if (chapters.length > 0) volumeData.chapters = chapters;

  return volumeData;
}

/**
 * Extracts image URL from a gallery item
 */
function extractGalleryImageUrl(
  $: cheerio.CheerioAPI,
  $item: cheerio.Cheerio<Element>
): string | undefined {
  // Extract image with multiple attribute checks
  const $img = $item.find('img').first();
  let imageUrl = $img.attr('data-src') ??
                 $img.attr('data-image-url') ??
                 $img.attr('data-original') ??
                 $img.attr('src');

  // Also check parent link for full-size image
  if (imageUrl === undefined) {
    const $link = $item.find('a').first();
    imageUrl = $link.attr('href');
  }

  return cleanImageUrl(imageUrl);
}

/**
 * Processes a single gallery item to extract volume data
 */
function processGalleryItem(
  $: cheerio.CheerioAPI,
  $item: cheerio.Cheerio<Element>,
  volumeMap: Map<number, VolumeData>
): void {
  const $caption = $item.find('.lightbox-caption, .gallerytext, .thumbcaption');
  const captionText = $caption.text().trim();

  // Check if this is a volume cover (enhanced regex)
  const volumeMatch = captionText.match(/(?:Volume|Vol\.?)\s*(\d+)(?:\s*[:-]\s*(.+))?/i);
  if (!volumeMatch?.[1]) return;

  const volumeNumber = parseInt(volumeMatch[1], 10);
  const volumeTitle = volumeMatch[2] ?? `Volume ${volumeNumber}`;
  const imageUrl = extractGalleryImageUrl($, $item);

  // Find or create volume entry in map
  let volume = volumeMap.get(volumeNumber);
  if (!volume) {
    volume = {
      number: volumeNumber,
      title: volumeTitle,
      galleryImages: []
    };
    volumeMap.set(volumeNumber, volume);
  }

  // Initialize galleryImages if not present
  volume.galleryImages ??= [];

  if (!imageUrl) return;

  volume.galleryImages.push(imageUrl);

  // Set as cover if no cover yet
  if (!volume.coverImage) {
    volume.coverImage = imageUrl;
    logger.info(`Found volume ${volumeNumber} cover from gallery: ${imageUrl}`);
  }
}

/**
 * Parses volume tables from Fandom wiki HTML
 *
 * Supports:
 * - Fire Force style tables with detailed structure
 * - Gallery-based volume listings
 * - Chapter listings within volume tables
 * - Cover image extraction
 *
 * @param html - The HTML content of the wiki page
 * @param baseUrl - Optional base URL for resolving relative links
 * @returns Array of parsed volume data sorted by volume number
 */
export function parseVolumeTables(html: string, baseUrl?: string): VolumeData[] {
  // Check if we should use adaptive parsing
  const structureType = detectWikiStructure(html);
  if (structureType === WikiStructureType.GALLERY_WITH_LISTS) {
    return parseGalleryWithLists(html);
  }

  try {
    const $ = cheerio.load(html);
    const volumeMap = new Map<number, VolumeData>();

    // First: Try fandom-table article-table style (Solo Leveling format)
    $('table.fandom-table, table.article-table').each((_, table) => {
      const $table = $(table);
      processFandomTableRows($, $table, volumeMap, baseUrl);
    });

    // If fandom-table parsing found volumes, return early
    if (volumeMap.size > 0) {
      const volumeArray = Array.from(volumeMap.values());
      logger.info(`Parsed ${volumeArray.length} volumes from fandom-table structure`);
      return volumeArray.sort((a, b) => a.number - b.number);
    }

    // Second: Try collapsible navigation table format (Dandadan style)
    // Format: "Volume X | 1 • 2 • 3 • ..." with chapter links
    $('table.mw-collapsible, table.mw-collapsed').each((_, table) => {
      const $table = $(table);
      processCollapsibleNavTable($, $table, volumeMap, baseUrl);
    });

    // If collapsible table parsing found volumes, extract covers and titles from main table
    if (volumeMap.size > 0) {
      // Extract cover images from the main detail table (Dandadan style)
      extractCoversFromDetailTable($, volumeMap);
      // Extract chapter titles from the main detail table (Dandadan style)
      extractChapterTitlesFromDetailTable($, volumeMap);

      // Also try individual volume tables (JJK style) for covers
      // This handles wikis where each volume has its own table
      extractCoversFromIndividualTables($, volumeMap);
      // Extract chapter titles from individual volume tables (JJK style)
      extractChapterTitlesFromIndividualTables($, volumeMap);

      const volumeArray = Array.from(volumeMap.values());
      const withCovers = volumeArray.filter(v => v.coverImage).length;
      logger.info(`Parsed ${volumeArray.length} volumes from collapsible nav table (${withCovers} with covers)`);
      return volumeArray.sort((a, b) => a.number - b.number);
    }

    // Third: Try alternating-row structure (Sakamoto Days style)
    // Pattern: Volume info row -> Chapters row -> Volume info row -> ...
    $('table').not('.navbox').not('.infobox').each((_, table) => {
      const $table = $(table);
      if (isAlternatingRowStructure($, $table)) {
        processAlternatingRowTable($, $table, volumeMap, baseUrl);
      }
    });

    if (volumeMap.size > 0) {
      const volumeArray = Array.from(volumeMap.values());
      const totalChapters = volumeArray.reduce((sum, v) => sum + (v.chapters?.length ?? 0), 0);
      logger.info(`Parsed ${volumeArray.length} volumes with ${totalChapters} chapters from alternating-row table`);
      return volumeArray.sort((a, b) => a.number - b.number);
    }

    // Fallback: Look for Fire Force style volume tables with detailed structure
    $('table').each((_, table) => {
      const $table = $(table);

      // Skip navigation tables only - DO NOT skip mw-collapsible as Fire Force uses
      // collapsible sections for each volume which contain the actual volume data
      if ($table.hasClass('navbox')) {
        return;
      }

      // Skip infobox tables that don't contain volume info
      const tableText = $table.text();
      if ($table.hasClass('infobox') && !tableText.match(/Volume\s+\d+|Fire Force\s+\d+/i)) {
        return;
      }

      // Process the table to extract volume data
      const volumeData = processVolumeTable($, $table, baseUrl);
      if (!volumeData) return;

      const volumeNumber = volumeData.number;

      // Skip if we already have this volume with complete data
      const existing = volumeMap.get(volumeNumber);
      if (existing?.coverImage && existing.chapters && existing.chapters.length > 0) {
        return;
      }

      // Update map - merge with existing data if present
      if (!existing) {
        volumeMap.set(volumeNumber, volumeData);
      } else {
        const merged = mergeVolumeData(existing, volumeData, volumeNumber);
        volumeMap.set(volumeNumber, merged);
      }
    });

    // Enhanced gallery extraction (based on archived implementation)
    $('.wikia-gallery, .gallery').each((_, gallery) => {
      const $gallery = $(gallery);
      const $items = $gallery.find('.wikia-gallery-item, .gallerybox, .gallery .thumb');

      $items.each((_, item) => {
        const $item = $(item);
        processGalleryItem($, $item, volumeMap);
      });
    });

    // Convert map to array and sort
    const volumeArray = Array.from(volumeMap.values());
    logger.info(`Parsed ${volumeArray.length} volumes from tables and galleries`);
    return volumeArray.sort((a, b) => a.number - b.number);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error parsing volume tables:', errorMessage);
    return [];
  }
}
