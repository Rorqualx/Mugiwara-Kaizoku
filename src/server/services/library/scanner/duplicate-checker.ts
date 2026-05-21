/**
 * Duplicate Checker Module
 *
 * Handles detection of duplicate manga entries during scanning.
 * Extracted from scanner.ts processMangaGroup method (lines 353-365)
 */

import type { DuplicateDetector, DuplicateResult } from '../duplicateDetector';

/**
 * Result of duplicate check operation
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicate?: DuplicateResult['manga'];
  /** Similarity score from duplicate detection (0-1) */
  duplicateScore?: number;
}

/**
 * Check if manga already exists in library
 *
 * Uses similarity threshold to detect potential duplicates.
 *
 * @param cleanTitle - Clean manga title to search for
 * @param libraryId - Target library ID
 * @param duplicateDetector - Duplicate detection service
 * @param skipExisting - Whether to skip existing manga
 * @returns Duplicate check result
 */
export async function checkForDuplicates(
  cleanTitle: string,
  libraryId: number,
  duplicateDetector: DuplicateDetector,
  skipExisting: boolean
): Promise<DuplicateCheckResult> {
  if (!skipExisting) {
    return { isDuplicate: false };
  }

  const duplicates = await duplicateDetector.findDuplicates(cleanTitle, libraryId, {
    minSimilarity: 0.8
  });

  if (duplicates.length > 0) {
    const firstDuplicate = duplicates[0];
    if (firstDuplicate !== undefined) {
      return {
        isDuplicate: true,
        duplicate: firstDuplicate.manga,
        duplicateScore: firstDuplicate.score
      };
    }
  }

  return { isDuplicate: false };
}
