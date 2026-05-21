/**
 * Library Path Cleanup Utility
 *
 * Detects and fixes duplicate libraryPath values that cause
 * chapters from one manga to appear on another manga's page.
 *
 * @module server/services/library/path-cleanup
 */

import path from 'path';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

/** Result of duplicate path detection */
export interface DuplicatePathReport {
  libraryId: number;
  libraryPath: string;
  mangaIds: number[];
  mangaTitles: string[];
}

/** Result of a single manga path fix */
export interface MangaPathFixResult {
  mangaId: number;
  title: string;
  oldPath: string;
  newPath: string;
}

/** Result of duplicate path fix operation */
export interface PathFixResult {
  fixed: MangaPathFixResult[];
  errors: Array<{ mangaId: number; error: string }>;
}

/**
 * Detect manga with duplicate libraryPath values within the same library
 * @returns Array of duplicate reports grouped by libraryPath
 */
export async function detectDuplicateLibraryPaths(): Promise<DuplicatePathReport[]> {
  // Find all library paths that have more than one manga
  const duplicates = await prisma.$queryRaw<
    Array<{ libraryId: number; libraryPath: string; count: bigint }>
  >`
    SELECT "libraryId", "libraryPath", COUNT(*) as count
    FROM "Manga"
    WHERE "libraryPath" IS NOT NULL
    GROUP BY "libraryId", "libraryPath"
    HAVING COUNT(*) > 1
  `;

  const reports: DuplicatePathReport[] = [];

  for (const dup of duplicates) {
    // eslint-disable-next-line no-await-in-loop -- Sequential DB queries to avoid connection pool exhaustion
    const manga = await prisma.manga.findMany({
      where: {
        libraryId: dup.libraryId,
        libraryPath: dup.libraryPath
      },
      select: { id: true, title: true }
    });

    reports.push({
      libraryId: dup.libraryId,
      libraryPath: dup.libraryPath,
      mangaIds: manga.map((m) => m.id),
      mangaTitles: manga.map((m) => m.title)
    });
  }

  return reports;
}

/**
 * Generate a unique path for a manga within its library
 */
async function generateUniquePathForManga(
  libraryId: number,
  libraryBasePath: string,
  mangaTitle: string,
  excludeMangaId: number
): Promise<string> {
  const sanitizedTitle = mangaTitle.replace(/[<>:"/\\|?*]/g, '_').trim();
  let newPath = path.join(libraryBasePath, sanitizedTitle);
  let suffix = 1;
  const maxIterations = 100;

  while (suffix <= maxIterations) {
    // eslint-disable-next-line no-await-in-loop -- Sequential collision detection required
    const existingManga = await prisma.manga.findFirst({
      where: {
        libraryId,
        libraryPath: newPath,
        id: { not: excludeMangaId }
      },
      select: { id: true }
    });

    if (!existingManga) {
      return newPath;
    }

    newPath = path.join(libraryBasePath, `${sanitizedTitle} (${suffix})`);
    suffix++;
  }

  throw new Error(`Cannot generate unique path for "${mangaTitle}" - too many conflicts`);
}

/**
 * Fix a single manga's duplicate path by assigning a unique subfolder
 */
async function fixSingleMangaPath(
  mangaId: number,
  libraryId: number,
  libraryBasePath: string,
  currentPath: string
): Promise<MangaPathFixResult> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { id: true, title: true }
  });

  if (!manga) {
    throw new Error(`Manga ${mangaId} not found`);
  }

  const newPath = await generateUniquePathForManga(libraryId, libraryBasePath, manga.title, mangaId);

  await prisma.manga.update({
    where: { id: mangaId },
    data: { libraryPath: newPath }
  });

  logger.info('Fixed duplicate library path', {
    mangaId,
    title: manga.title,
    oldPath: currentPath,
    newPath
  });

  return {
    mangaId,
    title: manga.title,
    oldPath: currentPath,
    newPath
  };
}

/**
 * Process a single duplicate report and fix affected manga
 */
async function processDuplicateReport(
  dup: DuplicatePathReport,
  libraryBasePath: string
): Promise<{ fixed: MangaPathFixResult[]; errors: Array<{ mangaId: number; error: string }> }> {
  const fixed: MangaPathFixResult[] = [];
  const errors: Array<{ mangaId: number; error: string }> = [];

  // Keep the first manga at the current path, move others
  const mangaToMove = dup.mangaIds.slice(1);

  const results = await Promise.all(
    mangaToMove.map(async (mangaId) => {
      try {
        const result = await fixSingleMangaPath(mangaId, dup.libraryId, libraryBasePath, dup.libraryPath);
        return { success: true as const, mangaId, result };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to fix duplicate path', { mangaId, error: errorMessage });
        return { success: false as const, mangaId, error: errorMessage };
      }
    })
  );

  for (const res of results) {
    if (res.success) {
      fixed.push(res.result);
    } else {
      errors.push({ mangaId: res.mangaId, error: res.error });
    }
  }

  return { fixed, errors };
}

/**
 * Fix all duplicate library paths by assigning unique subfolders
 * Keeps the first manga at the original path, moves duplicates to new paths
 * @returns Results of the fix operation
 */
export async function fixDuplicateLibraryPaths(): Promise<PathFixResult> {
  const duplicates = await detectDuplicateLibraryPaths();

  if (duplicates.length === 0) {
    logger.info('No duplicate library paths found');
    return { fixed: [], errors: [] };
  }

  logger.info('Found duplicate library paths', { count: duplicates.length });

  const allFixed: MangaPathFixResult[] = [];
  const allErrors: Array<{ mangaId: number; error: string }> = [];

  // Fetch all libraries in parallel
  const libraryMap = new Map<number, string>();
  const libraries = await Promise.all(
    duplicates.map((dup) =>
      prisma.library.findUnique({
        where: { id: dup.libraryId },
        select: { id: true, path: true }
      })
    )
  );

  for (const lib of libraries) {
    if (lib) {
      libraryMap.set(lib.id, lib.path);
    }
  }

  // Process all duplicates in parallel
  const results = await Promise.all(
    duplicates.map(async (dup) => {
      const libraryPath = libraryMap.get(dup.libraryId);
      if (!libraryPath) {
        logger.warn('Library not found for duplicate report', { libraryId: dup.libraryId });
        return { fixed: [], errors: [] };
      }
      return processDuplicateReport(dup, libraryPath);
    })
  );

  for (const result of results) {
    allFixed.push(...result.fixed);
    allErrors.push(...result.errors);
  }

  logger.info('Duplicate path fix complete', {
    fixedCount: allFixed.length,
    errorCount: allErrors.length
  });

  return { fixed: allFixed, errors: allErrors };
}
