/**
 * Data Normalizer Utilities Module
 *
 * Helper functions for data normalization operations.
 * Used by volumes, chapters, metadata, and post-processing modules.
 *
 * Extracted from: DataNormalizer.ts (lines 722-865)
 */

import type {
  NormalizedVolume,
  NormalizedChapter,
  NormalizationOptions,
  SourceInfo,
  VolumeData,
  ChapterData,
} from './types';

// ============================================================================
// Number Normalization
// ============================================================================

/**
 * Normalize volume number to an integer.
 * Converts string representations to integer values.
 *
 * @param num - Volume number as string or number
 * @returns Normalized volume number as integer
 */
export function normalizeVolumeNumber(num: number | string): number {
  if (typeof num === 'number') return num;
  const parsed = parseFloat(num.toString());
  return isNaN(parsed) ? 0 : Math.floor(parsed);
}

/**
 * Normalize chapter number to a float.
 * Preserves decimal chapter numbers (e.g., 10.5).
 *
 * @param num - Chapter number as string or number
 * @returns Normalized chapter number as float
 */
export function normalizeChapterNumber(num: string | number): number {
  if (typeof num === 'number') return num;
  const parsed = parseFloat(num.toString());
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================================================
// Text & Date Processing
// ============================================================================

/**
 * Normalize text by cleaning whitespace and standardizing quotes.
 * Only applies normalization if enabled in options.
 *
 * @param text - Text to normalize
 * @param options - Normalization options
 * @returns Normalized text string
 */
export function normalizeText(text: string, options: NormalizationOptions): string {
  if (!options.normalizeText) return text;

  return text
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .trim();
}

/**
 * Parse a date string into a Date object.
 * Attempts standard parsing first, then tries to extract year.
 *
 * @param dateStr - Date string to parse
 * @returns Parsed Date object or undefined if parsing fails
 */
export function parseDate(dateStr: string): Date | undefined {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // Try alternative parsing - extract year
    const match = dateStr.match(/(\d{4})/);
    if (match?.[1]) {
      return new Date(parseInt(match[1], 10), 0, 1);
    }
    return undefined;
  }
  return date;
}

// ============================================================================
// Data Merging
// ============================================================================

/**
 * Merge new volume data into an existing normalized volume.
 * Fills in missing fields from the new data without overwriting existing values.
 *
 * @param existing - Existing normalized volume
 * @param newData - New volume data to merge
 * @returns Merged normalized volume
 */
export function mergeVolumeData(existing: NormalizedVolume, newData: VolumeData): NormalizedVolume {
  const merged = { ...existing };

  if (!merged.title && newData.title) {
    merged.title = newData.title;
  }

  if (!merged.coverImage && newData.coverImage) {
    merged.coverImage = newData.coverImage;
  }

  if (!merged.isbn && newData.isbn) {
    merged.isbn = newData.isbn;
  }

  if (!merged.releaseDate && newData.releaseDate) {
    const releaseDate = parseDate(newData.releaseDate);
    if (releaseDate !== undefined) {
      merged.releaseDate = releaseDate;
    }
  }

  // Merge chapters
  const newChapters = newData.chapters.map((ch) => normalizeChapterNumber(ch.chapterNumber));
  merged.chapters = [...new Set([...merged.chapters, ...newChapters])];

  return merged;
}

/**
 * Merge new chapter data into an existing normalized chapter.
 * Fills in missing fields from the new data without overwriting existing values.
 *
 * @param existing - Existing normalized chapter
 * @param newData - New chapter data to merge
 * @returns Merged normalized chapter
 */
export function mergeChapterData(existing: NormalizedChapter, newData: ChapterData): NormalizedChapter {
  const merged = { ...existing };

  if (!merged.title && newData.title) {
    merged.title = newData.title;
  }

  if (!merged.volumeNumber && newData.volumeNumber) {
    merged.volumeNumber = newData.volumeNumber;
  }

  if (!merged.releaseDate && newData.releaseDate) {
    const releaseDate = parseDate(newData.releaseDate);
    if (releaseDate !== undefined) {
      merged.releaseDate = releaseDate;
    }
  }

  if (!merged.url && newData.url) {
    merged.url = newData.url;
  }

  return merged;
}

// ============================================================================
// Gap Filling
// ============================================================================

/**
 * Fill gaps in a volume sequence by adding placeholder volumes.
 * Modifies the array in place and sorts by volume number.
 *
 * @param volumes - Array of normalized volumes to fill gaps in
 */
export function fillVolumeGaps(volumes: NormalizedVolume[]): void {
  if (volumes.length < 2) return;

  const minVolume = Math.min(...volumes.map((v) => v.number));
  const maxVolume = Math.max(...volumes.map((v) => v.number));

  for (let i = minVolume; i <= maxVolume; i++) {
    if (!volumes.find((v) => v.number === i)) {
      volumes.push({
        number: i,
        chapters: [],
      });
    }
  }

  volumes.sort((a, b) => a.number - b.number);
}

/**
 * Fill small gaps in a chapter sequence by adding placeholder chapters.
 * Only fills gaps of 5 chapters or fewer.
 * Modifies the array in place and sorts by chapter number.
 *
 * @param chapters - Array of normalized chapters to fill gaps in
 */
export function fillChapterGaps(chapters: NormalizedChapter[]): void {
  if (chapters.length < 2) return;

  const minChapter = Math.floor(Math.min(...chapters.map((ch) => ch.number)));
  const maxChapter = Math.floor(Math.max(...chapters.map((ch) => ch.number)));

  // Only fill small gaps (up to 5 chapters)
  const existingNumbers = new Set(chapters.map((ch) => Math.floor(ch.number)));

  for (let i = minChapter; i <= maxChapter; i++) {
    if (!existingNumbers.has(i)) {
      // Check if gap is small
      let gapSize = 1;
      for (let j = i + 1; j <= maxChapter; j++) {
        if (existingNumbers.has(j)) break;
        gapSize++;
      }

      if (gapSize <= 5) {
        chapters.push({ number: i });
      }
    }
  }

  chapters.sort((a, b) => a.number - b.number);
}

// ============================================================================
// Source Detection
// ============================================================================

/**
 * Detect the source type from a format name string.
 * Identifies known sources by substring matching.
 *
 * @param formatName - Format name to analyze
 * @returns Detected source type
 */
export function detectSourceType(formatName: string): SourceInfo['type'] {
  if (formatName.includes('fandom')) return 'fandom';
  if (formatName.includes('wikipedia')) return 'wikipedia';
  if (formatName.includes('mangadex')) return 'mangadex';
  if (formatName.includes('anilist')) return 'anilist';
  return 'other';
}
