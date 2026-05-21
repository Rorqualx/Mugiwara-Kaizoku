/**
 * Volume List Pattern Parser
 *
 * Parses chapters from Wikipedia HTML content when chapters are in ordered lists
 * within volume sections marked with id="volN".
 * Pattern: <ol> lists inside volume sections with id="vol1", id="vol2", etc.
 *
 * Used by: One Piece and manga with ordered list chapter formats
 */

import { DEFAULT_PARSER_CONFIG } from '@/server/services/wikipedia/parser-config';
import type { WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';
import { logger } from '@/utils/logger';

// Use configurable values
const { patterns: patternConfig } = DEFAULT_PARSER_CONFIG;

/**
 * Extract the start attribute from an `<ol>` tag, defaulting to 1.
 * Handles `<ol start="245">` → 245.
 */
function extractOlStart(olTag: string): number {
  const startMatch = olTag.match(/<ol[^>]*\bstart="(\d+)"/i);
  return startMatch?.[1] ? parseInt(startMatch[1], 10) : 0;
}

/**
 * Parse chapters from HTML content with volume list pattern
 *
 * Extracts chapters organized by volumes with id="volN" markers.
 * Uses `<ol start="N">` attributes when available to assign correct
 * chapter numbers (critical for sub-pages like Naruto Part II).
 * Falls back to sequential numbering when no start attribute exists.
 *
 * @param html - HTML content containing chapter data
 * @returns Array of parsed chapters
 */
export function parseVolumeListPattern(html: string): WikipediaChapter[] {
  const chapters: WikipediaChapter[] = [];

  // Extract volume sections with their chapters
  // Each volume has an id="vol#" and contains a list of chapters
  const volumeSectionPattern = new RegExp(
    `id="${patternConfig.volumeIdPrefix}(\\d+)".*?(<ol[^>]*>.*?<\\/ol>)`,
    'gs'
  );
  const volumeSections = [...html.matchAll(volumeSectionPattern)];
  logger.info(`[WIKIPEDIA] Found ${volumeSections.length} volume sections (volume list pattern)`);

  let fallbackNumber = 1;

  for (const volMatch of volumeSections) {
    const volumeNum = volMatch[1];
    const chapterList = volMatch[2];
    if (!volumeNum || !chapterList) continue;

    const volumeNumber = parseInt(volumeNum, 10);
    const olStart = extractOlStart(chapterList);
    const chapterMatches = [...chapterList.matchAll(/<li>"([^"<]+)"/g)];

    for (let i = 0; i < chapterMatches.length; i++) {
      const chapterTitle = chapterMatches[i]?.[1];
      if (!chapterTitle) continue;

      // Use ol start attribute if available, otherwise sequential fallback
      const number = olStart > 0 ? olStart + i : fallbackNumber++;
      chapters.push({ number, title: chapterTitle, volumeNumber });
    }

    // Advance fallback counter to stay in sync if ol start was used
    if (olStart > 0) fallbackNumber = olStart + chapterMatches.length;
  }

  // If no volume sections found, fallback to simple extraction
  if (chapters.length === 0) {
    return parseSimpleChapterList(html);
  }

  logger.info(`[WIKIPEDIA] Parsed ${chapters.length} total chapters`);
  return chapters;
}

/** Fallback: extract chapters from flat `<li>` lists without volume markers */
function parseSimpleChapterList(html: string): WikipediaChapter[] {
  const chapters: WikipediaChapter[] = [];

  // Try to find <ol start="N"> for correct numbering
  const olPattern = /<ol[^>]*?(?:\bstart="(\d+)")?[^>]*>([\s\S]*?)<\/ol>/gi;
  const olBlocks = [...html.matchAll(olPattern)];

  if (olBlocks.length > 0) {
    for (const block of olBlocks) {
      const olStart = block[1] ? parseInt(block[1], 10) : 0;
      const content = block[2] ?? '';
      const items = [...content.matchAll(/<li>"([^"<]+)"/g)];
      for (let i = 0; i < items.length; i++) {
        const title = items[i]?.[1];
        if (!title) continue;
        const number = olStart > 0 ? olStart + i : chapters.length + 1;
        chapters.push({ number, title });
      }
    }
  } else {
    // Final fallback: match all <li> with quoted titles, sequential numbering
    const simpleMatches = [...html.matchAll(/<li>"([^"<]+)"/g)];
    logger.info(`[WIKIPEDIA] Fallback: Found ${simpleMatches.length} chapters without volume info`);
    for (let i = 0; i < simpleMatches.length; i++) {
      const title = simpleMatches[i]?.[1];
      if (title) chapters.push({ number: i + 1, title });
    }
  }

  logger.info(`[WIKIPEDIA] Parsed ${chapters.length} total chapters`);
  return chapters;
}

