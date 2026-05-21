/**
 * @module server/queue/checkOutOfSyncChapters
 * @description Chapter synchronization validation system
 * Provides functionality for:
 * - Detecting chapters that are out of sync with source
 * - Managing synchronization status records
 * - Scheduling repair tasks for out-of-sync chapters
 * - Maintaining database consistency
 *
 * @example
 * ```ts
 * // Check chapters for a manga
 * await checkOutOfSyncChapters(42);
 *
 * // Schedule a check task
 * await enqueueCheckOutOfSyncChaptersTask(42);
 * ```
 */

import { JobType} from '@prisma/client';

import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { getMangaLibraryPath } from '@/utils/manga';
import { getChaptersFromLocal } from '@/utils/server/serverHelpers';


import { prisma } from "../db";

import { syncDbWithFiles } from "./checkChapters";

import type { Prisma } from '@prisma/client';
/**
 * Extended manga type with related entities
 * Includes library, metadata, chapters, and sync status
 * @typedef {Prisma.MangaGetPayload} MangaWithIncludes
 */
type MangaWithIncludes = Prisma.MangaGetPayload<{
  include: {
    Library: true;
    Metadata: true;
    Chapter: true;
  };
}>;
/**
 * Checks and records out-of-sync chapters for a manga
 * Performs filesystem and database synchronization checks
 *
 * @param {number} mangaId - ID of manga to check
 * @returns {Promise<void>}
 * @throws {Error} When check fails or manga not found
 *
 * @example
 * ```ts
 * // Check synchronization status
 * await checkOutOfSyncChapters(42);
 * ```
 */
export async function checkOutOfSyncChapters(mangaId: number): Promise<void> {
  try {
    logger.info(`Starting out-of-sync chapter check for Manga ID ${mangaId}`);
    // Use findUnique instead of findUniqueOrThrow to handle missing manga gracefully
    const manga = (await prisma.manga.findUnique({
      where: { id: mangaId },
      include: {
        Library: true,
        Chapter: true,
        Metadata: true
      }
    })) as MangaWithIncludes | null;
    // Check if manga exists
    if (!manga) {
      logger.warn(`Manga with ID ${mangaId} not found, skipping out-of-sync chapter check`);
      return; // Exit early
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Library can be null if relation doesn't exist
    if (!manga.Library) {
      throw new ValidationError(`No library found for Manga ID ${mangaId}`);
    }
    logger.info(`Manga fetched: ${manga["title"]}`);
    await syncDbWithFiles(manga);
    logger.info(`Database synchronized with file system for Manga ID ${mangaId}`);
    // At this point, manga.Library is guaranteed to be non-null due to the check above
    const library = manga.Library;
    const mangaWithLibrary = {
      ...manga,
      library: {
        id: library.id,
        name: library.name,
        path: library.path,
        createdAt: library.createdAt,
        updatedAt: library.createdAt,
        lastScanAt: library.lastScanAt
      }
    };
    const mangaDir = getMangaLibraryPath(mangaWithLibrary);
    // Get local chapters to check sync status
    const localChapters = await getChaptersFromLocal(mangaDir);
    const _dbChapterFilenames = manga.Chapter.map((ch) => ch.fileName).filter(Boolean);
    // Find chapters that exist in DB but not on disk
    const toBeRemovedChapters = manga.Chapter.filter((ch) => {
      if (!ch.fileName)
      return false;
      const existsLocally = localChapters.some((local) => local.fileName === ch.fileName);
      return !existsLocally;
    })
    .map((ch) => ch.fileName)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Type guard needed for TypeScript narrowing after map()
    .filter((fileName): fileName is string => fileName !== null);
    logger.info(`Found ${toBeRemovedChapters.length} out-of-sync chapters for Manga ID ${mangaId}`);

    // Since OutOfSyncChapter model was removed, we'll create jobs for fixing out-of-sync chapters
    if (toBeRemovedChapters.length > 0) {
      const { queueManager } = await import('./queueManager');

      // Create a job to handle the out-of-sync chapters
      const jobId = await queueManager.enqueue(
        JobType.chapter_sync,
        {
          mangaId,
          outOfSyncChapters: toBeRemovedChapters,
          reason: "Chapters exist in database but not on filesystem"
        },
        { mangaId }
      );

      logger.info(`Created job ${jobId} to handle ${toBeRemovedChapters.length} out-of-sync chapters for Manga ID ${mangaId}`);
    } else
    {
      logger.info(`No new out-of-sync chapters found for Manga ID ${mangaId}`);
    }
    logger.info(`Out-of-sync chapter check completed for Manga ID ${mangaId}`);
  }
  catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error(`Error in checking out-of-sync chapters for Manga ID ${mangaId}: ${errorMessage}`);
    throw err;
  }
}
/**
 * Creates a new synchronization check task
 * Configures task with retry settings and metadata
 *
 * @param {number} mangaId - ID of manga to check
 * @returns {Promise<void>}
 * @throws {Error} When task creation fails
 *
 * @example
 * ```ts
 * // Schedule a check
 * await enqueueCheckOutOfSyncChaptersTask(42);
 * ```
 */
export async function enqueueCheckOutOfSyncChaptersTask(mangaId: number): Promise<void> {
  try {
    logger.info(`Enqueueing out-of-sync chapter check for Manga ID ${mangaId}`);
    const { queueManager } = await import('./queueManager');

    const jobId = await queueManager.enqueue(
      JobType.chapter_sync,
      { mangaId },
      { mangaId }
    );

    logger.info(`Job ${jobId} enqueued for Manga ID ${mangaId}`);
  }
  catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error(`Error enqueuing job for Manga ID ${mangaId}: ${errorMessage}`);
    throw err;
  }
}