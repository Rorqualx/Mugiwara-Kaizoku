/**
 * Import Validator Module
 *
 * Lightweight post-import validation to detect discrepancies between
 * expected and actual chapter counts, and verify file paths exist on disk.
 */

import * as fs from 'fs/promises';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

/**
 * Result of post-import validation
 */
export interface ImportValidationResult {
  isValid: boolean;
  expectedChapters: number;
  actualChapters: number;
  missingFiles: string[];
  warnings: string[];
}

/**
 * Validate import results by checking chapter count and file existence
 *
 * @param mangaId - The manga ID to validate
 * @param expectedChapterCount - Expected number of chapters created
 * @returns Validation result with discrepancies and missing files
 */
export async function validateImportResult(
  mangaId: number,
  expectedChapterCount: number
): Promise<ImportValidationResult> {
  const warnings: string[] = [];
  const missingFiles: string[] = [];

  // Check actual chapter count in DB
  const chapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { id: true, filePath: true }
  });

  const actualChapters = chapters.length;

  if (actualChapters !== expectedChapterCount) {
    warnings.push(
      `Chapter count mismatch: expected ${expectedChapterCount}, found ${actualChapters} in database`
    );
  }

  // Verify file paths exist on disk (batch check with Promise.allSettled)
  const chaptersWithFiles = chapters.filter(
    (c): c is { id: number; filePath: string } => c.filePath !== null
  );
  const fileChecks = await Promise.allSettled(
    chaptersWithFiles.map(async (c) => {
      try {
        await fs.access(c.filePath);
        return { filePath: c.filePath, exists: true };
      } catch {
        return { filePath: c.filePath, exists: false };
      }
    })
  );

  for (const check of fileChecks) {
    if (check.status === 'fulfilled' && !check.value.exists) {
      missingFiles.push(check.value.filePath);
    }
  }

  if (missingFiles.length > 0) {
    warnings.push(
      `${missingFiles.length} chapter file(s) not found on disk`
    );
  }

  const isValid = warnings.length === 0;

  if (!isValid) {
    logger.warn('Post-import validation found issues', {
      mangaId,
      expectedChapters: expectedChapterCount,
      actualChapters,
      missingFileCount: missingFiles.length,
      warnings
    });
  }

  return {
    isValid,
    expectedChapters: expectedChapterCount,
    actualChapters,
    missingFiles,
    warnings
  };
}
