/**
 * Chapter Normalization Module
 *
 * Processes and normalizes chapter data from extracted content.
 * Handles deduplication, merging variants, sorting, and gap filling.
 *
 * Extracted from: DataNormalizer.ts (lines 447-512)
 */

import {
  normalizeChapterNumber,
  normalizeText,
  parseDate,
  mergeChapterData,
  fillChapterGaps,
} from './utils';

import type {
  NormalizedChapter,
  NormalizationOptions,
  ChapterData,
} from './types';

// ============================================================================
// Chapter Normalization
// ============================================================================

/**
 * Normalize an array of chapter data into a consistent format.
 *
 * This function performs:
 * - Normalization of chapter numbers
 * - Deduplication with optional merging of variants
 * - Normalization of text fields (titles)
 * - Date parsing for release dates
 * - Sorting by chapter number (optional)
 * - Gap filling for missing chapters (optional)
 *
 * @param chapters - Array of raw chapter data to normalize
 * @param options - Normalization options controlling behavior
 * @returns Array of normalized chapters
 */
export function normalizeChapters(
  chapters: ChapterData[] | undefined,
  options: NormalizationOptions
): NormalizedChapter[] {
  // Handle undefined chapters gracefully
  if (!chapters || !Array.isArray(chapters)) {
    return [];
  }

  const normalized: NormalizedChapter[] = [];
  const chapterMap = new Map<number, NormalizedChapter>();

  for (const chapter of chapters) {
    const chapterNumber = normalizeChapterNumber(chapter.chapterNumber);

    // Check for duplicates
    if (chapterMap.has(chapterNumber)) {
      if (options.mergeVariants) {
        // Merge data from duplicate into existing
        const existing = chapterMap.get(chapterNumber);
        if (existing) {
          const merged = mergeChapterData(existing, chapter);
          chapterMap.set(chapterNumber, merged);
        }
      }
      continue;
    }

    const normalizedChapter: NormalizedChapter = {
      number: chapterNumber,
    };

    // Add optional fields only if they have values
    if (chapter.title) {
      const title = normalizeText(chapter.title, options);
      if (title) {
        normalizedChapter.title = title;
      }
    }

    if (chapter.volumeNumber) {
      normalizedChapter.volumeNumber = chapter.volumeNumber;
    }

    if (chapter.releaseDate) {
      const releaseDate = parseDate(chapter.releaseDate);
      if (releaseDate !== undefined) {
        normalizedChapter.releaseDate = releaseDate;
      }
    }

    if (chapter.url) {
      normalizedChapter.url = chapter.url;
    }

    chapterMap.set(chapterNumber, normalizedChapter);
    normalized.push(normalizedChapter);
  }

  // Sort if requested
  if (options.sortChapters) {
    normalized.sort((a, b) => a.number - b.number);
  }

  // Fill gaps if requested
  if (options.fillGaps) {
    fillChapterGaps(normalized);
  }

  return normalized;
}
