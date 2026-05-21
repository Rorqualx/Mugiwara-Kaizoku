/**
 * Collapsible Table Parser for Fandom Wikis
 *
 * Handles wikis that use separate `.collapsible` tables for each volume.
 * Each table contains volume header and chapter list in cells.
 *
 * Example wiki: Fullmetal Alchemist (FMA)
 *
 * Structure pattern:
 * <table class="collapsible">
 *   <tr><th><a href="/wiki/Volume_1">Volume 1</a></th></tr>
 *   <tr><th>Cover</th><th>Chapters</th><th>Release Date</th></tr>
 *   <tr>
 *     <td>cover image</td>
 *     <td><ul><li><a href="/wiki/Chapter_1">Chapter 1: Title</a></li>...</ul></td>
 *     <td>release dates</td>
 *   </tr>
 * </table>
 *
 * @module collapsible-table-parser
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

// ============================================================================
// Types
// ============================================================================

export interface CollapsibleVolume {
  number: number;
  title?: string;
  url?: string;
  coverImage?: string;
  releaseDate?: string;
  chapters: CollapsibleChapter[];
}

export interface CollapsibleChapter {
  number: number;
  title?: string;
  url?: string;
  volumeNumber: number;
}

export interface CollapsibleTableResult {
  success: boolean;
  volumes: CollapsibleVolume[];
  chapters: CollapsibleChapter[];
}

// ============================================================================
// Detection
// ============================================================================

/**
 * Checks if the HTML contains collapsible table structure.
 * Supports both `.collapsible` (FMA style) and `.mw-collapsible` (Dandadan style)
 */
export function isCollapsibleTableStructure(html: string): boolean {
  const $ = cheerio.load(html);
  const $content = $('.mw-parser-output');

  // Look for .collapsible OR .mw-collapsible tables (different wikis use different classes)
  const $collapsibleTables = $content.find('table.collapsible, table.mw-collapsible');
  if ($collapsibleTables.length === 0) return false;

  // Check if at least one table has volume-related content
  let hasVolumeTable = false;
  $collapsibleTables.each((_, table) => {
    const $table = $(table);
    const text = $table.text().toLowerCase();
    if (text.includes('volume') || text.includes('chapter')) {
      hasVolumeTable = true;
      return false; // break
    }
  });

  return hasVolumeTable;
}

// ============================================================================
// Parsing Utilities
// ============================================================================

/**
 * Extracts volume number from link text or URL.
 */
function extractVolumeNumber(text: string, href: string): number | null {
  // Try text first: "Volume 1", "Vol. 1"
  const textMatch = text.match(/volume\s*(\d+)|vol\.?\s*(\d+)/i);
  if (textMatch) {
    const numStr = textMatch[1] ?? textMatch[2];
    if (numStr) return parseInt(numStr, 10);
  }

  // Try URL: /wiki/Volume_1, /wiki/Volume%201
  const hrefMatch = href.match(/volume(?:_|\s|%20)*(\d+)/i);
  if (hrefMatch?.[1]) {
    return parseInt(hrefMatch[1], 10);
  }

  return null;
}

/**
 * Extracts chapter number from text or URL.
 * Supports Volume 0 prequel format: "Chapter_0-1" → 0.1, "000-1" → 0.1
 */
function extractChapterNumber(text: string, href: string): number | null {
  // Special handling for Volume 0 prequel format: "Chapter_0-1", "000-1" → 0.1, 0.2, etc.
  const zeroChapterPatterns = [
    { source: href, regex: /chapter(?:_|\s|%20)*0+-(\d+)/i },  // /wiki/Chapter_0-1 → 0.1
    { source: text, regex: /chapter\s*0+-(\d+)/i },        // Chapter 0-1 → 0.1
    { source: text, regex: /^0+-(\d+)(?:\.|$|\s)/ },       // 000-1, 000-1. → 0.1
    { source: text, regex: /\b0+-(\d+)\b/ },               // 000-1 anywhere → 0.1
  ];
  for (const { source, regex } of zeroChapterPatterns) {
    const match = source.match(regex);
    if (match?.[1]) {
      return parseFloat(`0.${match[1]}`);
    }
  }

  // Try text: "Chapter 1:", "Chapter 1 -", "Ch. 1"
  const textMatch = text.match(/chapter\s*(\d+(?:\.\d+)?)|ch\.?\s*(\d+(?:\.\d+)?)/i);
  if (textMatch) {
    const numStr = textMatch[1] ?? textMatch[2];
    if (numStr) return parseFloat(numStr);
  }

  // Try URL: /wiki/Chapter_1, /wiki/Chapter_1:_Title
  const hrefMatch = href.match(/chapter(?:_|\s|%20)*(\d+(?:\.\d+)?)/i);
  if (hrefMatch?.[1]) {
    return parseFloat(hrefMatch[1]);
  }

  return null;
}

/**
 * Cleans chapter title by removing number prefix.
 */
function cleanChapterTitle(text: string): string {
  return text
    .replace(/^chapter\s*\d+(?:\.\d+)?[\s:.\-–—]*/i, '')
    .replace(/^ch\.?\s*\d+(?:\.\d+)?[\s:.\-–—]*/i, '')
    .replace(/\([^)]*\)\s*$/g, '') // Remove Japanese text in parentheses
    .trim();
}

/**
 * Extracts cover image URL from table.
 */
function extractCoverImage($: CheerioAPI, $table: Cheerio<Element>): string | undefined {
  const $img = $table.find('img').first();
  if ($img.length > 0) {
    return $img.attr('data-src') ?? $img.attr('src');
  }
  return undefined;
}

/**
 * Parses chapters from a table's chapter cell.
 */
function parseChaptersFromCell(
  $: CheerioAPI,
  $table: Cheerio<Element>,
  volumeNumber: number
): CollapsibleChapter[] {
  const chapters: CollapsibleChapter[] = [];
  const seenChapters = new Set<number>();

  // Find all chapter links in <li> elements within the table
  $table.find('li a').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();
    const title = $link.attr('title') ?? text;

    // Skip non-chapter links
    if (!href.includes('/wiki/Chapter') && !text.toLowerCase().includes('chapter')) {
      return;
    }

    const chapterNum = extractChapterNumber(text, href) ?? extractChapterNumber(title, href);
    if (chapterNum === null || seenChapters.has(chapterNum)) return;

    seenChapters.add(chapterNum);

    const chapter: CollapsibleChapter = {
      number: chapterNum,
      volumeNumber,
    };

    const cleanTitle = cleanChapterTitle(title);
    if (cleanTitle.length > 0 && cleanTitle.length < 200) {
      chapter.title = cleanTitle;
    }

    if (href.startsWith('/wiki/')) {
      chapter.url = href;
    }

    chapters.push(chapter);
  });

  return chapters.sort((a, b) => a.number - b.number);
}

/**
 * Parses a single collapsible table into a volume.
 */
function parseCollapsibleTable(
  $: CheerioAPI,
  $table: Cheerio<Element>
): CollapsibleVolume | null {
  // Find volume link in header row
  const $volumeLink = $table.find('th a').first();
  if ($volumeLink.length === 0) return null;

  const volumeText = $volumeLink.text().trim();
  const volumeHref = $volumeLink.attr('href') ?? '';
  const volumeNum = extractVolumeNumber(volumeText, volumeHref);

  if (volumeNum === null) return null;

  // Extract chapters from the table
  const chapters = parseChaptersFromCell($, $table, volumeNum);

  // Extract cover image
  const coverImage = extractCoverImage($, $table);

  const volume: CollapsibleVolume = {
    number: volumeNum,
    chapters,
  };

  if (volumeHref.startsWith('/wiki/')) {
    volume.url = volumeHref;
  }

  if (coverImage) {
    volume.coverImage = coverImage;
  }

  return volume;
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parses collapsible tables to extract volume and chapter information.
 */
export function parseCollapsibleTables(html: string): CollapsibleTableResult {
  const $ = cheerio.load(html);
  const volumes: CollapsibleVolume[] = [];
  const allChapters: CollapsibleChapter[] = [];
  const seenVolumes = new Set<number>();

  const $content = $('.mw-parser-output');
  const $collapsibleTables = $content.find('table.collapsible, table.mw-collapsible');

  logger.debug(`[collapsibleTableParser] Found ${$collapsibleTables.length} collapsible tables`);

  $collapsibleTables.each((_, table) => {
    const volume = parseCollapsibleTable($, $(table));
    if (!volume || seenVolumes.has(volume.number)) return;

    // Log Volume 0 specifically for debugging
    if (volume.number === 0) {
      logger.info(`[collapsibleTableParser] Found Volume 0 with ${volume.chapters.length} chapters`);
      volume.chapters.forEach((ch, i) => {
        logger.info(`[collapsibleTableParser] Volume 0 chapter ${i}: num=${ch.number}, url=${ch.url ?? 'NO URL'}, title=${ch.title}`);
      });
    }

    seenVolumes.add(volume.number);
    volumes.push(volume);
    allChapters.push(...volume.chapters);
  });

  // Sort by volume number
  volumes.sort((a, b) => a.number - b.number);
  allChapters.sort((a, b) => a.number - b.number);

  logger.info(
    `[collapsibleTableParser] Parsed ${volumes.length} volumes and ${allChapters.length} chapters`
  );

  return {
    success: volumes.length > 0 || allChapters.length > 0,
    volumes,
    chapters: allChapters,
  };
}
