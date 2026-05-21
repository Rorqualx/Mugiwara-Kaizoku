
import { JobType } from '@prisma/client';

import { toStringId } from '@/utils/id-converters';
/**
 * @module server/queue/fixOutOfSyncChaptersQueue
 * @description Queue processor for fixing out-of-sync manga chapters
 * Provides functionality for:
 * - Processing repair tasks in transaction
 * - Managing filesystem and database cleanup
 * - Handling task state transitions
 * - Rescheduling chapter checks
 *
 * @example
 * ```ts
 * // Process repair task
 * await processFixOutOfSyncChaptersTask(42);
 *
 * // Enqueue new repair task
 * await enqueueFixOutOfSyncChaptersTask(42);
 * ```
 */
import type { JobError } from '@/utils/job-validation';
import { logger } from '@/utils/logger';


import { prisma} from "../db";

import { schedule } from './checkChapters';
import { queueManager } from './queueManager';
/**
 * Configuration data for chapter repair tasks
 * @interface IFixOutOfSyncChaptersWorkerData
 */
interface IFixOutOfSyncChaptersWorkerData {
  mangaId: number;
}
/**
 * Processes a chapter repair task with transaction support
 * Removes out-of-sync chapters and updates database records
 *
 * @param {number} mangaId - ID of manga to process
 * @returns {Promise<void>}
 * @throws {JobError} When processing fails
 *
 * @example
 * ```ts
 * await processFixOutOfSyncChaptersTask(42);
 * ```
 */
export async function processFixOutOfSyncChaptersTask(mangaId: number): Promise<void> {
  try {
    // Use findUnique instead of findUniqueOrThrow to handle missing manga gracefully
    const manga = await prisma.manga.findUnique({
      where: {
        id: mangaId
      },
      include: {
        Library: true,
        Chapter: true,
        Metadata: true
      }
    });
    // Check if manga exists
    if (!manga) {
      logger.warn(`Manga with ID ${mangaId} not found, skipping fix out-of-sync chapters task`);
      return; // Exit early
    }
    // Library is guaranteed by Prisma include: { Library: true }
    // Since OutOfSyncChapter model no longer exists,
    // this function will just trigger a chapter check
    logger.info(`Running chapter sync for manga ID ${mangaId}`);
    await schedule({
      ...manga,
      id: manga.id
    }, true);
    logger.info(`Successfully triggered chapter sync for manga ID ${mangaId}`);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to process fix out-of-sync chapters for manga ID ${mangaId}:`, errorMessage);
    const taskError = new Error(`Failed to fix out-of-sync chapters for manga ${mangaId}`) as JobError;
    taskError.code = 'INVALID_STATE';
    taskError.jobType = JobType.chapter_sync;
    throw taskError;
  }
}
/**
 * Creates a new chapter repair task in the queue
 *
 * @param {number} mangaId - ID of manga to repair
 * @returns {Promise<void>}
 * @throws {JobError} When task creation fails
 *
 * @example
 * ```ts
 * await enqueueFixOutOfSyncChaptersTask(42);
 * ```
 */
export async function enqueueFixOutOfSyncChaptersTask(mangaId: number): Promise<void> {
  try {
    await queueManager.enqueue(JobType.chapter_sync, {
      mangaId
    });
    logger.info(`Task for fixing out-of-sync chapters enqueued for Manga ID ${mangaId}`);
  }
  catch (error: unknown) {
  logger.error(`Failed to enqueue fix out-of-sync task for Manga ID ${mangaId}:`, error instanceof Error ? error.message : String(error));
    const taskError = new Error('Failed to enqueue fix out-of-sync chapters task') as JobError;
    taskError.code = 'INVALID_STATE';
    taskError.taskId = toStringId(mangaId);
    taskError.jobType = JobType.chapter_sync;
    throw taskError;
  }
}
export type { IFixOutOfSyncChaptersWorkerData };