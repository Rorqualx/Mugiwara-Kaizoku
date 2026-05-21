/**
 * @module server/queue/fixOutOfSyncChapters
 * @description Chapter synchronization repair system
 * Provides functionality for:
 * - Fixing out-of-sync chapter files and database records
 * - Managing repair tasks and queues
 * - Handling file system operations
 * - Rescheduling chapter checks after repairs
 *
 * @example
 * ```ts
 * // Fix chapters for a manga
 * await handleFixOutOfSyncTask({ mangaId: 42 });
 *
 * // Enqueue a repair task
 * const taskId = await enqueueFixOutOfSyncChaptersTask(42);
 * ```
 */
// Import fs/promises and path modules correctly
import * as fs from 'fs/promises';
import * as path from 'path';


import { JobType } from '@prisma/client';

import { sanitizer } from '@/utils/client/frontendHelpers';
import { logger } from '@/utils/logger';


import { prisma } from "../db";
import { realtimeEmitter } from '../services/realtime/RealtimeEventEmitter';

import { schedule } from './checkChapters';
import { queueManager } from './queueManager';

import type { Prisma } from '@prisma/client';
/**
 * Configuration data for chapter repair tasks
 * @interface IFixOutOfSyncChaptersWorkerData
 */
export interface IFixOutOfSyncChaptersWorkerData {
  mangaId: number;
  outOfSyncChapters?: string[];
}

/**
 * Extended manga type with related entities
 * Includes library, metadata, and chapters
 */
type MangaWithIncludes = Prisma.MangaGetPayload<{
  include: {
    Library: true;
    Metadata: true;
    Chapter: true;
  };
}>;
/**
 * Removes a chapter file from the filesystem
 * Handles missing files and logging gracefully
 *
 * @private
 * @param {string} mangaPath - Path to manga directory
 * @param {string | null} fileName - Name of file to remove
 * @returns {Promise<void>}
 * @throws {Error} When file removal fails (except for ENOENT)
 *
 * @example
 * ```ts
 * await removeChapter('/manga/one-piece', 'chapter-42.cbz');
 * ```
 */
async function removeChapter(mangaPath: string, fileName: string | null): Promise<void> {
  if (!fileName) {
    logger.warn('Skipping chapter removal: fileName is null');
    return;
  }
  const filePath = path.resolve(mangaPath, fileName);
  try {
    await fs.unlink(filePath);
    logger.info(`Removed chapter file: ${filePath}`);
  }
  catch (err: unknown) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      logger.warn(`File not found: ${filePath}, skipping...`);
    } else
    {
      logger.error(`Error removing chapter file ${fileName}:`, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}
/**
 * Processes a chapter repair task
 * Removes out-of-sync chapters and reschedules checks
 *
 * @param {IFixOutOfSyncChaptersWorkerData} task - Task configuration
 * @returns {Promise<void>}
 * @throws {Error} When processing fails
 *
 * @example
 * ```ts
 * await processFixOutOfSyncChaptersTask({
 *   mangaId: 42
 * });
 * ```
 */
export async function processFixOutOfSyncChaptersTask(task: IFixOutOfSyncChaptersWorkerData): Promise<void> {
  const { mangaId, outOfSyncChapters } = task;
  try {
    await prisma.$transaction(async (tx) => {
      // Use findUnique instead of findUniqueOrThrow to handle missing manga gracefully
      const mangaInDb = (await tx.manga.findUnique({
        include: {
          Library: true,
          Chapter: true,
          Metadata: true
        },
        where: { id: mangaId }
      })) as MangaWithIncludes | null;
      // Check if manga exists
      if (!mangaInDb) {
        logger.warn(`Manga with ID ${mangaId} not found, skipping fix out-of-sync chapters task`);
        return; // Exit early from the transaction
      }
      // Library is guaranteed by Prisma include: { Library: true }
      const mangaPath = path.resolve(mangaInDb.Library.path, sanitizer(mangaInDb.title));

      // If outOfSyncChapters is provided in the payload, use that list
      const chaptersToRemove = outOfSyncChapters ?? [];

      await Promise.all(chaptersToRemove.map(async (fileName: string) => {
        const chapter = mangaInDb.Chapter.find((curr) => curr.fileName === fileName);
        if (!chapter) {
          logger.warn(`No matching chapter found for filename ${fileName}`);
          return;
        }
        await removeChapter(mangaPath, chapter.fileName);
        await tx.chapter.delete({ where: { id: chapter.id } });
      }));
      await tx.manga.update({
        where: { id: mangaId },
        data: {
          lastChecked: new Date()
        }
      });
      await schedule(mangaInDb, true);
      logger.info(`Successfully processed fix for manga ID ${mangaId}`);

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'chapters:outOfSync:fixed',
        source: 'fixOutOfSyncChapters',
        message: `Fixed out-of-sync chapters for manga ID ${mangaId}`,
        data: { mangaId, chaptersRemoved: chaptersToRemove.length },
      });
    });
  }
  catch (error: unknown) {
  logger.error(`Error processing fix for manga ID ${mangaId}:`, error instanceof Error ? error.message : String(error));
    // Emit error event
    void realtimeEmitter.emitSystemEvent({
      eventType: 'chapters:outOfSync:error',
      source: 'fixOutOfSyncChapters',
      message: `Failed to fix out-of-sync chapters for manga ID ${mangaId}`,
      data: { mangaId, error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
/**
 * Creates a new chapter repair task in the queue
 *
 * @param {number} mangaId - ID of manga to repair
 * @returns {Promise<number>} ID of created task
 * @throws {Error} When task creation fails
 *
 * @example
 * ```ts
 * const taskId = await enqueueFixOutOfSyncChaptersTask(42);
 * logger.info(`Repair task created: ${taskId}`);
 * ```
 */
export async function enqueueFixOutOfSyncChaptersTask(mangaId: number): Promise<bigint> {
  try {
    const taskId = await queueManager.enqueue(JobType.chapter_sync, { mangaId });
    logger.info(`Task enqueued for Manga ID ${mangaId} with task ID ${taskId}`);
    return taskId;
  }
  catch (error: unknown) {
  logger.error(`Error enqueuing fix out-of-sync task for Manga ID ${mangaId}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
/**
 * Main handler for chapter repair tasks
 * Entry point for task processing system
 *
 * @param {IFixOutOfSyncChaptersWorkerData} payload - Task configuration
 * @returns {Promise<void>}
 * @throws {Error} When repair fails
 *
 * @example
 * ```ts
 * await handleFixOutOfSyncTask({
 *   mangaId: 42
 * });
 * ```
 */
export async function handleFixOutOfSyncTask(payload: IFixOutOfSyncChaptersWorkerData): Promise<void> {
  await processFixOutOfSyncChaptersTask(payload);
}