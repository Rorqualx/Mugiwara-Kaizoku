/**
 * Text Pattern Chapter Parser
 *
 * Parses chapters from unstructured text using regex patterns.
 * Extracted from: scrapingService.ts (lines 394-486)
 *
 * @module text-parser
 */

import { logger } from '@/utils/logger';

import { CHAPTER_PATTERNS } from './constants';
import { romanToArabic } from './utils';

import type { ComicVineChapter } from './types';

/**
 * Parse chapters from unstructured body text using regex patterns
 *
 * This method complements list-based parsing by finding chapters
 * mentioned in prose text or less structured formats.
 *
 * @param bodyText - Raw text content from the page
 * @returns Array of chapters found in text patterns
 */
export function parseChaptersFromText(bodyText: string): ComicVineChapter[] {
  const chaptersFromText: ComicVineChapter[] = [];
  const foundChapters = new Map<
    string,
    { number: string; title: string; romanNumeral?: string }
  >();

  for (const pattern of CHAPTER_PATTERNS) {
    const matches = Array.from(bodyText.matchAll(pattern));
    for (const match of matches) {
      const fullMatch = match[0];

      let chapterNumber: string;
      let chapterTitle: string;
      let romanNumeral: string | undefined;

      // Handle special cases - don't assign hardcoded numbers
      if (fullMatch.startsWith('Final Chapter')) {
        // Skip Final Chapter in text parsing - it's already handled in list parsing
        continue;
      } else if (fullMatch.startsWith('Epilogue')) {
        // Skip Epilogue in text parsing - it's already handled in list parsing
        continue;
      } else if (match[1] && match[2]) {
        const [, num, title] = match;

        if (/^[IVXLCDM]+$/i.test(num)) {
          romanNumeral = num.toUpperCase();
          chapterNumber = String(romanToArabic(romanNumeral));
        } else {
          chapterNumber = num;
        }

        chapterTitle = title;
      } else {
        continue;
      }

      const cleanTitle = chapterTitle
        .trim()
        .replace(/\.$/, '')
        .replace(/\s+/g, ' ');

      if (cleanTitle.length > 200 || cleanTitle.includes('Chapter Titles')) {
        continue;
      }

      if (isNaN(parseInt(chapterNumber))) {
        continue;
      }

      // Handle "Evil" bonus chapters - skip here, let list-parser handle them as special
      if (cleanTitle.toLowerCase() === 'evil') {
        continue;
      }

      const key = `${chapterNumber}-${cleanTitle.toLowerCase()}`;
      if (!foundChapters.has(key)) {
        const chapter: {
          number: string;
          title: string;
          romanNumeral?: string;
        } = {
          number: chapterNumber,
          title: cleanTitle,
        };
        if (romanNumeral !== undefined) chapter.romanNumeral = romanNumeral;
        foundChapters.set(key, chapter);
      }
    }
  }

  // Sort and add chapters
  const sortedChapters = Array.from(foundChapters.values()).sort(
    (a, b) => parseInt(a.number) - parseInt(b.number)
  );

  for (const chapterInfo of sortedChapters) {
    const chapter: ComicVineChapter = {
      number: chapterInfo.number,
      title:
        chapterInfo.title ||
        `Chapter ${chapterInfo.romanNumeral || chapterInfo.number}`,
    };
    if (chapterInfo.romanNumeral) chapter.romanNumeral = chapterInfo.romanNumeral;
    chaptersFromText.push(chapter);

    logger.info('[ComicVine Scraper] Found chapter from text:', {
      number: chapterInfo.number,
      title: chapterInfo.title,
      romanNumeral: chapterInfo.romanNumeral,
    });
  }

  return chaptersFromText;
}
