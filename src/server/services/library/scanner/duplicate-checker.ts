/**
 * Duplicate Checker Module
 *
 * Handles detection of duplicate manga entries during scanning.
 * Extracted from scanner.ts processMangaGroup method (lines 353-365)
 */

import { prisma } from '@/server/db';

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
  skipExisting: boolean,
  libraryPath?: string,
): Promise<DuplicateCheckResult> {
  if (!skipExisting) {
    return { isDuplicate: false };
  }

  // Primary signal: exact libraryPath match (re-scanning the same folder).
  // Title-fuzzy matching alone misses titles where DB title and parsed
  // cleanTitle diverge by punctuation (Chainsaw Man (Official Colored) vs
  // "Chainsaw Man Color", Strike Witches: 1937 vs "Strike Witches 1937",
  // trailing periods stripped by macOS HFS+, etc).
  if (libraryPath !== undefined && libraryPath.length > 0) {
    const byPath = await prisma.manga.findFirst({
      where: { libraryId, libraryPath },
      include: { Metadata: true },
    });
    if (byPath) {
      return { isDuplicate: true, duplicate: byPath, duplicateScore: 1.0 };
    }
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
