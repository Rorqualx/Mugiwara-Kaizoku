/**
 * File Matching Utilities
 *
 * Utilities for matching downloaded files to chapters based on
 * volume numbers and chapter numbers in filenames.
 *
 * @module components/manga/manual-import/hooks/use-file-matching
 */

import { extractChapterNumber } from '@/utils/chapterMatcher';

import type { Chapter, ScannedFile, ChapterFileMapping } from '../types';

/**
 * Extract volume number from filename.
 * Handles patterns like: v01, Vol 1, Volume 01, vol.1, etc.
 */
export function extractVolumeNumber(filename: string): number | null {
  const nameWithoutExt = filename.replace(/\.(cbz|cbr|cbt|cb7|zip|pdf|epub)$/i, '');

  // Try various volume patterns (in order of specificity)
  const patterns = [
    /\bv(?:ol(?:ume)?\.)?\s*(\d+)\b/i,     // v01, vol.1, volume 1
    /\bvolume\s+(\d+)\b/i,                   // volume 1
    /\bvol\s+(\d+)\b/i                       // vol 1
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match?.[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        return num;
      }
    }
  }

  return null;
}

/**
 * Results from the auto-matching operation.
 */
export interface AutoMatchResult {
  /** Mapping of chapter IDs to file paths */
  mapping: ChapterFileMapping;
  /** Number of chapters matched via volume detection */
  volumeMatchCount: number;
  /** Number of chapters matched via chapter number detection */
  chapterMatchCount: number;
  /** Total number of matched chapters */
  totalMatched: number;
  /** Number of chapters that couldn't be matched */
  unmatchedCount: number;
}

/**
 * Auto-match files to chapters using volume and chapter number detection.
 *
 * Uses a two-priority matching system:
 * - PRIORITY 1: Volume-based matching (one file to many chapters)
 * - PRIORITY 2: Chapter number matching (one file to one chapter)
 */
export function autoMatchFiles(
  files: ScannedFile[],
  chapters: Chapter[]
): AutoMatchResult {
  const autoMatched: ChapterFileMapping = {};
  let volumeMatchCount = 0;
  let chapterMatchCount = 0;

  // Track which files have been used for volume matching
  const volumeMatchedFiles = new Set<string>();

  // PRIORITY 1: Volume-based matching (one file to many chapters)
  for (const file of files) {
    const detectedVolume = extractVolumeNumber(file.name);

    if (detectedVolume !== null) {
      // Find all chapters that belong to this volume (exact metadata only)
      const chaptersInVolume = chapters.filter(ch => ch.volume === detectedVolume);

      if (chaptersInVolume.length > 0) {
        // Assign this file to all chapters in this volume
        for (const chapter of chaptersInVolume) {
          autoMatched[chapter.id] = file.path;
          volumeMatchCount++;
        }
        volumeMatchedFiles.add(file.path);
      }
    }
  }

  // PRIORITY 2: Chapter number matching (one file to one chapter)
  for (const file of files) {
    if (volumeMatchedFiles.has(file.path)) {
      continue;
    }

    const detectedChNum = extractChapterNumber(file.name);

    if (detectedChNum !== null) {
      // Only match if chapter hasn't been assigned yet
      const chapter = chapters.find(ch =>
        ch.chapterNumber === detectedChNum &&
        !autoMatched[ch.id]
      );

      if (chapter) {
        autoMatched[chapter.id] = file.path;
        chapterMatchCount++;
      }
    }
  }

  const totalMatched = volumeMatchCount + chapterMatchCount;
  const unmatchedCount = chapters.length - totalMatched;

  return {
    mapping: autoMatched,
    volumeMatchCount,
    chapterMatchCount,
    totalMatched,
    unmatchedCount
  };
}

/**
 * Get list of unmatched chapters from a mapping result.
 */
export function getUnmatchedChapterNumbers(
  chapters: Chapter[],
  mapping: ChapterFileMapping
): number[] {
  return chapters
    .filter(ch => !mapping[ch.id])
    .map(ch => ch.chapterNumber ?? ch.index + 1)
    .sort((a, b) => a - b);
}
