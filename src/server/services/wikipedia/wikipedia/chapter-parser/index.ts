/**
 * Wikipedia Chapter Parser Module
 *
 * HTML parsing for chapter extraction from Wikipedia pages.
 * Phase 2: Parsing functions (includes API-dependent functions).
 *
 * Pattern-based parsers detect HTML structure, not specific manga titles.
 *
 * Extracted from: WikipediaService.ts (lines 667-701, 708-753, 760-1017, 1024-1080, 2014-2048)
 */

import * as cheerio from 'cheerio';

import { containsWikipediaArtifacts } from '@/server/services/shared/parsing-utils';
import type { ChapterListFormatHints, ChapterMatch, WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';
import { cleanChapterTitle } from '@/server/services/wikipedia/wikipedia/utils';
import { logger } from '@/utils/logger';

// Import format detector and pattern parsers
import { detectChapterListFormat, detectPageStructure } from './format-detector';
import { isChapterRangePattern, parseChapterRangePattern } from './formats/chapter-range-pattern';
import { parseNumberedChaptersPattern } from './formats/numbered-chapters-pattern';
import { isZeroIndexedPattern, parseZeroIndexedPattern } from './formats/zero-indexed-pattern';

// Re-export pattern-specific parsers
export { parseVolumeListPattern } from './formats/volume-list-pattern';
export { parseChapterRangePattern, isChapterRangePattern } from './formats/chapter-range-pattern';
export { parseZeroIndexedPattern, isZeroIndexedPattern } from './formats/zero-indexed-pattern';
export { parseNumberedChaptersPattern } from './formats/numbered-chapters-pattern';

// Re-export API-dependent parsers
export { parseDisambiguationPage } from './disambiguation-parser';
export { searchChapterList } from './search-parser';

/**
 * Parse chapter tables from HTML content
 *
 * Detects the HTML pattern and routes to the appropriate parser:
 * - Chapter Range Pattern: "Chapter: 1-10" ranges (e.g., Kaiju No. 8)
 * - Zero-Indexed Pattern: Chapters starting with 00 (e.g., Fire Force)
 * - Numbered Chapters Pattern: Standard "1. Title" format (default)
 *
 * @param html - HTML content containing chapter tables
 * @returns Array of parsed chapters
 */
export function parseChapterTables(html: string): WikipediaChapter[] {
  // First check for chapter range pattern (e.g., "Chapter: 1-10")
  if (isChapterRangePattern(html)) {
    return parseChapterRangePattern(html);
  }

  // Tier 1: Page-level structure (volume markers, edition layout)
  const pageHints = detectPageStructure(html);

  // Tier 2: Chapter-list format (ol-start vs bare-ol vs numbered-text)
  const formatHints = detectChapterListFormat(html);

  // Extract all chapter matches (hints inform ol-vs-regex tiebreak)
  const allChapterMatches = extractChapterMatches(html, formatHints);

  if (allChapterMatches.length === 0) {
    logger.info(`[WIKIPEDIA] No chapter patterns found`);
    return [];
  }

  logger.info(`[WIKIPEDIA] Found ${allChapterMatches.length} chapter patterns`);

  const totalVolumes = pageHints.volumeCount;

  if (totalVolumes > 0) {
    logger.info(`[WIKIPEDIA] Found ${totalVolumes} volume markers (format: ${pageHints.volumeMarkerFormat})`);
  } else {
    logger.info(`[WIKIPEDIA] No volume markers found - chapters will not be assigned to volumes`);
  }

  // Check for zero-indexed chapters pattern (starting with 00)
  // Skip when ol-start format is detected — <ol start="N"> provides correct numbering
  // and "00." can false-positive on dates/footnotes (e.g., Naruto sub-pages)
  if (isZeroIndexedPattern(html) && formatHints.primaryFormat !== 'ol-start') {
    logger.info(`[WIKIPEDIA] Detected zero-indexed chapter pattern`);
    const chapters = parseZeroIndexedPattern(html, allChapterMatches, totalVolumes);
    logChapterSummary(chapters);
    return filterArtifactChapters(chapters);
  }

  // Default: use numbered chapters pattern (with both hint tiers)
  const chapters = parseNumberedChaptersPattern(html, allChapterMatches, totalVolumes, formatHints, pageHints);
  logChapterSummary(chapters);
  return filterArtifactChapters(chapters);
}

/**
 * Reject batches where titles are mostly CSS classes / DOM artifacts.
 * If >50% of titled chapters are artifacts, the parser extracted garbage.
 */
function filterArtifactChapters(chapters: WikipediaChapter[]): WikipediaChapter[] {
  if (chapters.length === 0) return chapters;

  const titled = chapters.filter(ch => typeof ch.title === 'string' && ch.title.length > 0);
  if (titled.length === 0) return chapters;

  const artifactCount = titled.filter(ch => containsWikipediaArtifacts(ch.title ?? '')).length;
  const artifactRatio = artifactCount / titled.length;

  if (artifactRatio > 0.5) {
    logger.warn(`[WIKIPEDIA] Rejected ${chapters.length} chapters: ${Math.round(artifactRatio * 100)}% titles are CSS/DOM artifacts`);
    return [];
  }

  // Filter out individual artifacts even if the batch is mostly good
  if (artifactCount > 0) {
    logger.info(`[WIKIPEDIA] Filtered ${artifactCount} artifact titles from ${titled.length} chapters`);
    return chapters.map(ch => {
      if (ch.title && containsWikipediaArtifacts(ch.title)) {
        const { title: _removed, ...rest } = ch;
        return rest;
      }
      return ch;
    });
  }

  return chapters;
}

/**
 * Extract chapter matches from HTML content
 *
 * Looks for numbered chapters with quotes and special chapters.
 * Supports multiple formats:
 * 1. "N. Title" format (Fire Force, Chainsaw Man)
 * 2. <ol start="N"><li>"Title"</li> format (Jujutsu Kaisen)
 * 3. One Piece style fallback
 *
 * IMPORTANT: Deduplicates special chapters to prevent counting the same
 * chapter twice (e.g., "303. Title" and "Epilogue 1: Title" both referring
 * to the same chapter). This fixes the 310 vs 304 chapter count issue.
 *
 * @param html - HTML content
 * @returns Array of chapter matches (deduplicated)
 */
function extractChapterMatches(html: string, hints?: ChapterListFormatHints): ChapterMatch[] {
  // If hints indicate One Piece format, go straight there
  if (hints?.primaryFormat === 'one-piece') {
    return tryOnePieceStyleExtraction(html);
  }

  // Try numbered chapters with quotes (Fire Force and Chainsaw Man style)
  // Look for patterns like "00. Title" or "123. Title"
  // Note: Match both curly quotes ("") and regular double quotes (")
  const regexMatches = [...html.matchAll(/(\d{1,3}(?:\.\d+)?)\.\s*["""]([^"""]+)["""]?/g)];

  // Also try ordered list format (Jujutsu Kaisen style)
  // Pattern: <ol start="N"><li>"Title"<span...
  const olMatches = tryOrderedListExtraction(html);

  // Convert to ChapterMatch objects from regex matches
  const regexChapterMatches: ChapterMatch[] = regexMatches
    .filter(match => match[1] !== undefined && match[2] !== undefined)
    .map(match => ({
      fullMatch: match[0],
      chapterNumber: match[1] as string,
      chapterTitle: match[2] as string
    }));

  // Decide between ol and regex matches using hints when available
  let allChapterMatches: ChapterMatch[];
  if (hints && hints.primaryFormat !== 'unknown') {
    const preferOl = hints.primaryFormat === 'ol-start' || hints.primaryFormat === 'bare-ol-quoted';
    const preferred = preferOl ? olMatches : regexChapterMatches;
    const fallback = preferOl ? regexChapterMatches : olMatches;
    // Use preferred extraction; fall back to the other if preferred found nothing
    allChapterMatches = preferred.length > 0 ? preferred : fallback;
  } else {
    // Without hints: existing count-based tiebreak
    allChapterMatches = olMatches.length > regexChapterMatches.length
      ? olMatches
      : regexChapterMatches;
  }

  if (olMatches.length > 0) {
    logger.info(`[WIKIPEDIA] Found ${olMatches.length} chapters from ordered list format`);
  }

  // Track seen chapter titles to prevent duplicates
  // Use normalized titles (lowercase, trimmed) for comparison
  const seenTitles = new Set<string>();
  allChapterMatches.forEach(match => {
    seenTitles.add(match.chapterTitle.toLowerCase().trim());
  });

  // Also capture special chapters (Epilogue, Prologue, etc.)
  // Note: Match both curly quotes ("") and regular double quotes (")
  const specialChapterPattern = /(Epilogue|Prologue|Introduction|Intro|Final Chapter|Special|Extra|Omake|Bonus)\s*(\d*)\s*:?\s*["""]([^"""]+)["""]/gi;
  const specialMatches = [...html.matchAll(specialChapterPattern)];

  // Add special chapters to the matches, but skip duplicates
  specialMatches.forEach(match => {
    const chapterType = match[1];
    const chapterNum = match[2] ?? '';
    const chapterTitle = match[3];

    if (!chapterTitle || !chapterType) return;

    // Skip if we've already captured this title from numbered chapters
    const normalizedTitle = chapterTitle.toLowerCase().trim();
    if (seenTitles.has(normalizedTitle)) {
      return;
    }

    // Mark as seen and add to matches
    seenTitles.add(normalizedTitle);

    // Create a ChapterMatch for the special chapter
    const specialNumber = chapterNum ? `${chapterType} ${chapterNum}` : chapterType;
    allChapterMatches.push({
      fullMatch: match[0],
      chapterNumber: specialNumber,
      chapterTitle: chapterTitle
    });
  });

  // If no numbered chapters found, try One Piece style
  if (allChapterMatches.length === 0) {
    return tryOnePieceStyleExtraction(html);
  }

  return allChapterMatches;
}

/**
 * Extract chapter matches from a single <ol> list content
 *
 * Helper function to reduce nesting depth in tryOrderedListExtraction.
 *
 * @param listContent - HTML content inside the <ol> tag
 * @param startNum - Starting chapter number from ol start attribute
 * @returns Array of chapter matches
 */
function extractChaptersFromOlList(listContent: string, startNum: number): ChapterMatch[] {
  // Try quoted titles first (most reliable)
  const quoted = extractQuotedLiChapters(listContent, startNum);
  if (quoted.length > 0) return quoted;

  // Fallback: extract unquoted <li> items (Kaguya-sama style: plain text before <span>)
  return extractUnquotedLiChapters(listContent, startNum);
}

/** Extract chapters from <li> with quoted titles */
function extractQuotedLiChapters(listContent: string, startNum: number): ChapterMatch[] {
  const chapters: ChapterMatch[] = [];
  const liPattern = /<li(?:\s[^>]*)?>(?:[^<]*?|<[^>]*>)*?[\u0022\u201C\u201D]([^\u0022\u201C\u201D<]+)[\u0022\u201C\u201D]/gi;
  const liMatches = [...listContent.matchAll(liPattern)];

  let currentNum = startNum;
  for (const liMatch of liMatches) {
    const title = liMatch[1];
    if (!title || title.length <= 1) continue;
    const valueMatch = liMatch[0].match(/<li\s[^>]*value="(\d+)"/i);
    if (valueMatch?.[1]) currentNum = parseInt(valueMatch[1], 10);
    chapters.push({ fullMatch: liMatch[0], chapterNumber: String(currentNum), chapterTitle: title });
    currentNum++;
  }
  return chapters;
}

/** Extract chapters from <li> with unquoted titles (text before first <span>) */
function extractUnquotedLiChapters(listContent: string, startNum: number): ChapterMatch[] {
  const chapters: ChapterMatch[] = [];
  const liPattern = /<li(?:\s[^>]*)?>([^<]+)/gi;
  const liMatches = [...listContent.matchAll(liPattern)];

  let currentNum = startNum;
  for (const liMatch of liMatches) {
    const rawTitle = liMatch[1]?.trim();
    if (!rawTitle || rawTitle.length <= 2) continue;
    // Skip empty list items and navigation text
    if (/^(mw-|&#|contents$)/i.test(rawTitle)) continue;
    const valueMatch = liMatch[0].match(/<li\s[^>]*value="(\d+)"/i);
    if (valueMatch?.[1]) currentNum = parseInt(valueMatch[1], 10);
    chapters.push({ fullMatch: liMatch[0], chapterNumber: String(currentNum), chapterTitle: rawTitle });
    currentNum++;
  }
  return chapters;
}

/**
 * Try extracting chapters from ordered list format (Jujutsu Kaisen style)
 *
 * Wikipedia pages like JJK use <ol start="N"><li>"Title"</li> format
 * instead of the standard "N. Title" pattern.
 *
 * @param html - HTML content
 * @returns Array of chapter matches in standard format
 */
function tryOrderedListExtraction(html: string): ChapterMatch[] {
  const chapters: ChapterMatch[] = [];
  // Match both <ol start="N"> and bare <ol> blocks (AoT Vol 1 uses bare <ol>)
  // Excludes <ol class="references"> to avoid matching footnote lists
  const olPattern = /<ol(?:\s+start="(\d+)")?(?:\s[^>]*)?>(?!<li[^>]*>\s*<sup)([\s\S]*?)<\/ol>/gi;
  const olMatches = [...html.matchAll(olPattern)];

  for (const olMatch of olMatches) {
    // Skip reference/footnote lists (they have class="references" or similar)
    const fullTag = olMatch[0].slice(0, olMatch[0].indexOf('>') + 1);
    if (fullTag.includes('class="references"') || fullTag.includes('class="reflist"')) continue;

    const isBareOl = !olMatch[1];
    const startNum = olMatch[1] ? parseInt(olMatch[1], 10) : 1;
    const listContent = olMatch[2] ?? '';
    const extracted = extractChaptersFromOlList(listContent, startNum);

    // Only include bare <ol> results if they actually contain quoted titles
    // (filters out non-chapter lists like TOC, references, etc.)
    if (isBareOl && extracted.length === 0) continue;
    chapters.push(...extracted);
  }

  return chapters;
}

/**
 * Try extracting One Piece style chapter titles
 *
 * One Piece uses quoted titles within volume descriptions.
 * Pattern: "Chapter Title" (Japanese, Romaji)
 *
 * @param html - HTML content
 * @returns Array of chapter matches in standard format
 */
function tryOnePieceStyleExtraction(html: string): ChapterMatch[] {
  // One Piece uses quoted titles within volume descriptions
  // Pattern: "Chapter Title" (Japanese, Romaji)
  // But exclude CSS styles that might contain quotes
  const onePiecePattern = /"([^"]+)"\s*\([^)]+\)/g;
  const titleMatches = [...html.matchAll(onePiecePattern)];

  // Filter out CSS or other non-chapter content
  const validMatches = titleMatches.filter(match => {
    const content = match[1];
    if (content) {
      // Skip if it looks like CSS (contains colons, semicolons, or CSS properties)
      return !content.includes(':') && !content.includes(';') && !content.includes('{');
    }
    return false;
  });

  if (validMatches.length > 0) {
    logger.info(`[WIKIPEDIA] Found ${validMatches.length} One Piece style chapter titles`);

    // Convert to ChapterMatch objects
    return validMatches
      .filter(match => match[1] !== undefined)
      .map((match, index) => ({
        fullMatch: match[0],
        chapterNumber: String(index + 1),
        chapterTitle: match[1] as string
      }));
  }

  return [];
}

/**
 * Log chapter parsing summary
 *
 * @param chapters - Parsed chapters
 */
function logChapterSummary(chapters: WikipediaChapter[]): void {
  const uniqueVolumes = new Set(chapters.map(ch => ch.volumeNumber).filter(v => v !== undefined));
  logger.info(`[WIKIPEDIA] Parsed ${chapters.length} chapters across ${uniqueVolumes.size} volumes`);
}

/**
 * Extract chapters from embedded content on main Wikipedia page
 *
 * Looks for chapter information in ordered lists using cheerio.
 * Useful when chapters are embedded directly on the main page
 * rather than on a separate chapters list page.
 *
 * @param html - HTML content of main page
 * @returns Array of extracted chapters (sorted by number)
 */
export function extractEmbeddedChapters(html: string): WikipediaChapter[] {
  const chapters: WikipediaChapter[] = [];
  const $ = cheerio.load(html);

  // Look for ordered lists that might contain chapters
  $('ol li').each((i, elem) => {
    const text = $(elem).text().trim();

    // Pattern for numbered chapters like: 1. "Chapter Title", 1.5. "Interlude", Chapter 1: "Title"
    const patterns = [
      /(\d+(?:\.\d+)?)\.\s*"([^"]+)"/,
      /Chapter\s+(\d+(?:\.\d+)?):?\s*"?([^"]+)"?/i,
      /^(\d+(?:\.\d+)?)\s*[–-]\s*"([^"]+)"/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1] && match[2]) {
        const chapterNumber = parseFloat(match[1]);
        const chapterTitle = cleanChapterTitle(match[2]);

        if (chapterTitle && chapterTitle.length > 0) {
          // Check if not already added
          if (!chapters.some(ch => ch.number === chapterNumber)) {
            chapters.push({
              number: chapterNumber,
              title: chapterTitle
            });
          }
        }
        break;
      }
    }
  });

  if (chapters.length > 0) {
    logger.info(`[WIKIPEDIA] Found ${chapters.length} embedded chapters in main page`);
  }

  return chapters.sort((a, b) => (a.number as number) - (b.number as number));
}
