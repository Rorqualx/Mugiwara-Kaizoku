/**
 * WikiContentScraper Chapter Extraction Module
 *
 * Chapter extraction logic from wiki pages.
 * Identifies chapter numbers, titles, and volume associations.
 *
 * Extracted from: WikiContentScraper.ts (lines 363-415)
 *
 * Fixes:
 * - Reduces extractChapterFromLink from 7 params to 2 params (max-params violation)
 * - Uses ChapterExtractionContext to group parameters
 *
 * Functions:
 * 1. extractChapterFromLink - Extract chapter info from link element
 * 2. findVolumeContext - Find associated volume for chapter
 */

import { logger } from '@/utils/logger';

import type { ChapterExtractionContext, ChapterInfo } from './types';
import type { CheerioAPI } from 'cheerio';
import type * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

/**
 * Special chapter patterns for Epilogue, Prologue, etc.
 * Each pattern maps to a base offset for chapter numbering
 */
const SPECIAL_CHAPTER_PATTERNS: Array<{ pattern: RegExp; baseOffset: number }> = [
  { pattern: /Epilogue\s*(\d+)/i, baseOffset: 1000 },
  { pattern: /^Epilogue$/i, baseOffset: 1001 },
  { pattern: /Prologue\s*(\d+)/i, baseOffset: -100 },
  { pattern: /^Prologue$/i, baseOffset: 0 },
  { pattern: /Final\s*Chapter\s*(\d+)/i, baseOffset: 2000 },
  { pattern: /Final\s*Chapter/i, baseOffset: 2001 },
  { pattern: /Extra\s*(\d+)/i, baseOffset: 3000 },
  { pattern: /Special\s*(\d+)/i, baseOffset: 4000 },
];

/**
 * Try to extract chapter number from text, including special chapters
 */
function extractChapterNum(text: string): string | null {
  // First try regular chapter pattern
  const chapterMatch = text.match(/Chapter\s*(\d+(?:\.\d+)?)/i);
  if (chapterMatch?.[1]) {
    return chapterMatch[1];
  }

  // Try special chapter patterns
  for (const { pattern, baseOffset } of SPECIAL_CHAPTER_PATTERNS) {
    const specialMatch = text.match(pattern);
    if (specialMatch) {
      const numStr = specialMatch[1];
      const num = numStr ? parseInt(numStr, 10) : 0;
      const result = baseOffset + num;
      logger.info(`[chapter-extractor] Found special chapter: "${text}" -> ${result}`);
      return String(result);
    }
  }

  return null;
}

/**
 * Extract chapter from link element
 *
 * Parses link text to identify chapter number and title.
 * Associates chapter with volume if volume context is found.
 * Adds chapter to both chapters array and parent volume's chapter list.
 *
 * @param context - Extraction context (cheerio, link, text, href, pageUrl, volumes)
 * @param chapters - Array to append chapter to
 *
 * BEFORE: 7 params (max-params violation)
 * AFTER: 2 params using context object
 */
export function extractChapterFromLink(
  context: ChapterExtractionContext,
  chapters: ChapterInfo[]
): void {
  const { $, $link, text, href, pageUrl, volumes } = context;

  const chapterNum = extractChapterNum(text);
  if (chapterNum) {

    // Try to determine which volume this chapter belongs to
    const volumeNum = findVolumeContext($, $link);

    const chapter: ChapterInfo = {
      number: chapterNum,
      title: text
    };

    if (volumeNum !== undefined) chapter.volume = volumeNum;

    // Resolve URL using parent class method (will need to be passed via context or made static)
    // For now, we'll use the raw href - parent class can handle resolution
    if (href) {
      const chapterUrl = resolveUrl(href, pageUrl);
      if (chapterUrl !== undefined) chapter.url = chapterUrl;
    }

    chapters.push(chapter);

    // Add to volume if we found one
    if (volumeNum) {
      const volume = volumes.find(v => v.number === volumeNum);
      if (volume) {
        volume.chapters.push(chapter);
      }
    }
  }
}

/**
 * Find volume context for a chapter link
 *
 * Searches previous sibling elements for volume number.
 * Looks for "Volume X" pattern in list items, table rows, or divs.
 *
 * @param $ - Cheerio instance
 * @param $link - Link element to find context for
 * @returns Volume number if found, undefined otherwise
 */
export function findVolumeContext($: CheerioAPI, $link: cheerio.Cheerio<Element>): number | undefined {
  const volumeContext = $link.closest('li, tr, div').prevAll().filter((_: number, el: Element) =>
    !!$(el).text().match(/Volume\s*(\d+)/i)
  ).first();

  if (volumeContext.length) {
    const volMatch = volumeContext.text().match(/Volume\s*(\d+)/i);
    if (volMatch?.[1]) return parseInt(volMatch[1], 10);
  }

  return undefined;
}

/**
 * Resolve a relative URL against a base URL
 *
 * Internal utility matching WikiContentScraper.resolveUrl implementation.
 * Handles absolute URLs, protocol-relative URLs, absolute paths, and relative paths.
 *
 * @param url - URL to resolve (may be undefined)
 * @param baseUrl - Base URL to resolve against
 * @returns Resolved URL or undefined if invalid
 */
function resolveUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined;

  try {
    const base = new URL(baseUrl);

    if (url.startsWith('http')) {
      return url;
    } else if (url.startsWith('//')) {
      return base.protocol + url;
    } else if (url.startsWith('/')) {
      return base.origin + url;
    } else {
      // Relative path
      const pathParts = base.pathname.split('/');
      pathParts.pop(); // Remove filename
      return base.origin + pathParts.join('/') + '/' + url;
    }
  } catch {
    return url;
  }
}
