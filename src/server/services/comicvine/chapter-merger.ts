/**
 * Chapter Merger
 *
 * Merges and processes chapters from multiple parsing sources.
 * Extracted from: scrapingService.ts (lines 488-597)
 *
 * @module chapter-merger
 */

import { logger } from '@/utils/logger';

import type { ComicVineChapter } from './types';

/**
 * Merge chapters from different parsing methods and assign final numbers
 *
 * Handles special chapter types:
 * - Regular numbered chapters
 * - Final chapters (assigned after last regular chapter)
 * - Epilogue chapters (assigned after final chapter)
 * - Special chapters (assigned at the end)
 *
 * @param chaptersFromLists - Chapters found in structured lists
 * @param chaptersFromText - Chapters found in unstructured text
 * @returns Merged and sorted array of chapters with final numbering
 */
export function mergeAndProcessChapters(
  chaptersFromLists: ComicVineChapter[],
  chaptersFromText: ComicVineChapter[]
): ComicVineChapter[] {
  const allChapters = new Map<string, ComicVineChapter>();
  const finalChapter: ComicVineChapter | undefined = chaptersFromLists.find(
    (ch) => ch.isFinalChapter
  );
  const epilogueChapters = chaptersFromLists.filter((ch) => ch.isEpilogue);
  const specialChapters = chaptersFromLists.filter((ch) => ch.isSpecial);

  // First, add all regular numbered chapters from lists
  chaptersFromLists.forEach((ch) => {
    if (!ch.isFinalChapter && !ch.isEpilogue && !ch.isSpecial) {
      allChapters.set(ch.number, ch);
    }
  });

  // Add chapters from text (only if not already found)
  chaptersFromText.forEach((ch) => {
    if (!allChapters.has(ch.number)) {
      allChapters.set(ch.number, ch);
    }
  });

  // Find the highest regular chapter number
  let highestRegularChapter = 0;
  const chapterNumbers: number[] = [];
  allChapters.forEach((ch, num) => {
    const chapterNum = parseInt(num);
    if (!isNaN(chapterNum)) {
      chapterNumbers.push(chapterNum);
      if (chapterNum > highestRegularChapter) {
        highestRegularChapter = chapterNum;
      }
    }
  });

  // Validate chapter sequence for large gaps
  if (chapterNumbers.length > 1) {
    chapterNumbers.sort((a, b) => a - b);
    for (let i = 1; i < chapterNumbers.length; i++) {
      const current = chapterNumbers[i];
      const previous = chapterNumbers[i - 1];
      if (current === undefined || previous === undefined) continue;
      const gap = current - previous;
      if (gap > 10) {
        logger.warn(
          `[ComicVine Scraper] Large gap in chapter numbers: ${previous} to ${current} (gap of ${gap})`
        );
      }
    }
  }

  // Now add Final Chapter if it exists
  // Remove isFinalChapter flag after assigning numeric number to prevent downstream re-processing
  if (finalChapter) {
    const finalChapterNumber = String(highestRegularChapter + 1);
    // Destructure to omit isFinalChapter flag - prevents downstream re-processing
    const { isFinalChapter: _ignored, ...restOfFinalChapter } = finalChapter;
    allChapters.set(finalChapterNumber, {
      ...restOfFinalChapter,
      number: finalChapterNumber,
    });
    highestRegularChapter++;
    logger.info(
      `[ComicVine Scraper] Assigned Final Chapter as chapter ${finalChapterNumber}`
    );
  }

  // Add epilogue chapters after the final chapter
  // Remove isEpilogue and epilogueNumber flags after assigning numeric number to prevent downstream re-processing
  epilogueChapters.sort((a, b) => (a.epilogueNumber ?? 0) - (b.epilogueNumber ?? 0));
  epilogueChapters.forEach((epilogue, index) => {
    const epilogueChapterNumber = String(highestRegularChapter + index + 1);
    // Destructure to omit isEpilogue and epilogueNumber flags - prevents downstream re-processing
    const { isEpilogue: _ignoredEpilogue, epilogueNumber: _ignoredEpNum, ...restOfEpilogue } = epilogue;
    allChapters.set(epilogueChapterNumber, {
      ...restOfEpilogue,
      number: epilogueChapterNumber,
    });
    logger.info(
      `[ComicVine Scraper] Assigned Epilogue ${epilogue.epilogueNumber} as chapter ${epilogueChapterNumber}`
    );
  });

  // Update highest chapter number after epilogues
  highestRegularChapter += epilogueChapters.length;

  // Add special chapters - always assign sequential numbers at end to ensure valid display
  // All special chapters get numeric IDs to prevent NaN issues in frontend
  specialChapters.forEach((special) => {
    highestRegularChapter++;
    const specialChapterNumber = String(highestRegularChapter);
    // Remove isSpecial flag to prevent downstream re-processing
    const { isSpecial: _ignoredSpecial, ...restOfSpecial } = special;
    allChapters.set(specialChapterNumber, {
      ...restOfSpecial,
      number: specialChapterNumber,
    });
    logger.info(
      `[ComicVine Scraper] Assigned Special Chapter as chapter ${specialChapterNumber}: ${special.title}`
    );
  });

  // Convert map to sorted array
  const chapters = Array.from(allChapters.values()).sort((a, b) => {
    const numA = parseInt(a.number);
    const numB = parseInt(b.number);
    return numA - numB;
  });

  logger.info(
    `[ComicVine Scraper] Merged results: ${chaptersFromLists.length} from lists, ${chaptersFromText.length} from text, ${chapters.length} total unique chapters`
  );

  return chapters;
}
