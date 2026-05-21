/**
 * @module server/queue/download
 * @description Chapter download task management system
 * Provides functionality for:
 * - Processing single and batch chapter downloads
 * - Managing download tasks and queues
 * - Handling download failures and retries
 * - Synchronizing download status with database
 *
 * @example
 * ```ts
 * // Download a single chapter
 * await processDownloadTask({
 *   id: 1,
 *   mangaId: 42,
 *   chapterIndex: 5
 * });
 *
 * // Enqueue a new download
 * await enqueueDownloadTask({
 *   mangaId: 42,
 *   chapterIndex: 5
 * });
 * ```
 */


import { JobStatus, JobType, MangaFileStatus } from '@prisma/client';

import { ValidationError } from '@/utils/errors';
import { toStringId, toNumberId } from '@/utils/id-converters';
import type { JobError as JobError } from '@/utils/job-validation';
import { logger } from '@/utils/logger';


import { prisma } from '../db';
import { eventEmitter } from '../services/eventEmitter';
import { EventType, EventSource } from '../services/events/eventTypes';
import { runIntegrations } from '../utils/integration/index';

import type { Prisma } from '@prisma/client';
/**
 * Extended manga type with chapters and library data
 * @typedef {Prisma.MangaGetPayload} MangaWithChaptersAndLibrary
 */
export type MangaWithChaptersAndLibrary = Prisma.MangaGetPayload<{
  include: {
    Chapter: true;
    library: true;
  };
}>;
/**
 * Download task configuration data
 * @interface IDownloadWorkerData
 */
export interface IDownloadWorkerData {
  mangaId: number;
  chapterIndex?: number;
  /** Chapter DB primary key (for job FK constraint) */
  chapterId?: number;
}
/**
 * Downloads and processes a single manga chapter
 * Creates or updates chapter records in database
 *
 * @param {string} mangaTitle - Title of the manga
 * @param {string} source - Source provider for the manga
 * @param {number} chapterIndex - Index of chapter to download
 * @param {string} libraryPath - Path to library directory
 * @param {number} mangaId - ID of manga in database
 * @returns {Promise<void>}
 * @throws {Error} When download or processing fails
 *
 * @example
 * ```ts
 * await processSingleChapterDownload(
 *   'One Piece',
 *   'mangadex',
 *   42,
 *   '/manga/library',
 *   1
 * );
 * ```
 */
function processSingleChapterDownload(mangaTitle: string, source: string, chapterIndex: number, _libraryPath: string, _mangaId: number): Promise<void> {
  // Mangal service has been deprecated and removed
  logger.error(`Mangal download service is no longer available for ${mangaTitle} chapter ${chapterIndex}`);
  return Promise.reject(new ValidationError('Mangal download service has been deprecated. Please use Prowlarr or direct download methods instead.'));
}
/**
 * Processes a download task for single or multiple chapters
 * Updates manga and task status throughout process
 *
 * @param {{ id: number } & IDownloadWorkerData} task - Task configuration
 * @returns {Promise<void>}
 * @throws {JobError} When processing fails
 *
 * @example
 * ```ts
 * // Download single chapter
 * await processDownloadTask({
 *   id: 1,
 *   mangaId: 42,
 *   chapterIndex: 5
 * });
 *
 * // Download all chapters
 * await processDownloadTask({
 *   id: 1,
 *   mangaId: 42
 * });
 * ```
 */
export async function processDownloadTask(task: {
  id: number;
} & IDownloadWorkerData): Promise<void> {
  const { mangaId, chapterIndex } = task;
  try {
    // Fetch manga with required relations
    const manga = await prisma.manga.findUnique({
      where: {
        id: mangaId
      },
      include: {
        Library: true,
        Chapter: {
          orderBy: {
            index: 'asc'
          }
        }
      }
    });
    if (!manga?.Library) {
      const error = new Error(`Manga ${mangaId} not found or has no library`) as JobError;
      error.taskId = toStringId(task["id"]);
      error.jobType = JobType.chapter_check;
      throw error;
    }
    logger.info(`Processing download task for manga: ${manga["title"]}`);
    // Update manga status to in progress
    await prisma.manga.update({
      where: {
        id: mangaId
      },
      data: {
        fileStatus: MangaFileStatus.PROCESSING
      }
    });
    // Emit download started notification
    await eventEmitter.emitWithTracking({
      type: EventType.DOWNLOAD_STARTED,
      source: EventSource.DOWNLOAD,
      mangaId: toStringId(mangaId),
      metadata: {
        taskId: task["id"],
        mangaTitle: manga["title"],
        chapterIndex: chapterIndex,
        totalChapters: chapterIndex === undefined ? manga['Chapter'].length : 1
      }
    });
    if (chapterIndex !== undefined) {
      // Single chapter download
      await processSingleChapterDownload(manga["title"], manga["source"], chapterIndex, manga.Library.path, mangaId);
    } else
    {
      // All chapters download - sequential processing is intentional
      for (const chapter of manga['Chapter']) {
        try {
          // eslint-disable-next-line no-await-in-loop -- Sequential download required
          await processSingleChapterDownload(manga["title"], manga["source"], chapter.index, manga.Library.path, mangaId);
        }
        catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to download chapter ${chapter.index}: ${errorMessage}`);
        }
      }
    }
    // Run integrations after successful download
    await runIntegrations();
    // Update job and manga status
    await Promise.all([updateJobStatus(task["id"], JobStatus.completed), prisma.manga.update({
      where: {
        id: mangaId
      },
      data: {
        fileStatus: MangaFileStatus.COMPLETED,
        lastChecked: new Date()
      }
    })]);
    logger.info(`Download task completed for manga: ${manga["title"]}`);
    // Emit download completed notification
    await eventEmitter.emitWithTracking({
      type: EventType.DOWNLOAD_COMPLETED,
      source: EventSource.DOWNLOAD,
      mangaId: toStringId(mangaId),
      metadata: {
        taskId: task["id"],
        mangaTitle: manga["title"],
        chapterIndex: chapterIndex,
        totalChapters: chapterIndex === undefined ? manga['Chapter'].length : 1
      }
    });
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Download task failed for manga ${mangaId}: ${errorMessage}`);
    await Promise.all([updateJobStatus(task["id"], JobStatus.failed, errorMessage), prisma.manga.update({
      where: {
        id: mangaId
      },
      data: {
        fileStatus: MangaFileStatus.FAILED,
        lastChecked: new Date()
      }
    })]);
    // Emit download error notification
    await eventEmitter.emitWithTracking({
      type: EventType.DOWNLOAD_ERROR,
      source: EventSource.DOWNLOAD,
      mangaId: toStringId(mangaId),
      metadata: {
        taskId: task["id"],
        mangaTitle: `Manga ID ${mangaId}`,
        chapterIndex: chapterIndex,
        error: errorMessage
      }
    });
    throw error;
  }
}
/**
 * Creates a new download task in the queue
 * Configures task with appropriate payload and settings
 *
 * @param {IDownloadWorkerData} data - Download configuration
 * @returns {Promise<void>}
 * @throws {Error} When task creation fails
 *
 * @example
 * ```ts
 * await enqueueDownloadTask({
 *   mangaId: 42,
 *   chapterIndex: 5  // Optional, omit for all chapters
 * });
 * ```
 */
export async function enqueueDownloadTask(data: IDownloadWorkerData): Promise<void> {
  try {
    const { queueManager } = await import('./queueManager');
    const payload = {
      mangaId: data.mangaId,
      chapterIndex: data.chapterIndex,
      chapter: data.chapterIndex !== undefined ? {
        fileName: `chapter_${data.chapterIndex}.cbz`,
        index: data.chapterIndex,
        size: 0,
        title: `Chapter ${data.chapterIndex + 1}`
      } : undefined
    };

    const jobId = await queueManager.enqueue(
      JobType.chapter_check,
      payload,
      {
        mangaId: data.mangaId,
        // chapterId requires a valid Chapter.id (DB primary key), not an ordinal index
        ...(data.chapterId !== undefined && { chapterId: data.chapterId }),
      }
    );

    logger.info(`Download job enqueued for manga ${data.mangaId}${data.chapterIndex !== undefined ? `, chapter ${data.chapterIndex}` : ''}`);

    // Get manga for notification
    const manga = await prisma.manga.findUnique({
      where: { id: data.mangaId },
      select: { title: true }
    });

    // Emit download queued notification
    await eventEmitter.emitWithTracking({
      type: EventType.DOWNLOAD_QUEUED,
      source: EventSource.DOWNLOAD,
      mangaId: toStringId(data.mangaId),
      metadata: {
        taskId: Number(jobId),
        mangaTitle: manga?.title ?? 'Unknown',
        chapterIndex: data.chapterIndex,
        queueLength: await prisma.$queryRaw<[{count: bigint}]>`
          SELECT COUNT(*) as count
          FROM jobs
          WHERE status = 'pending'::"JobStatus"
            AND job_type = ${JobType.chapter_check}
        `.then(result => Number(result[0].count))
      }
    });
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to enqueue download task: ${errorMessage}`);
    throw error;
  }
}
/**
 * Removes all pending download tasks for a manga
 * Cleans up queue for cancelled or completed downloads
 *
 * @param {MangaWithChaptersAndLibrary} manga - Manga with related data
 * @returns {Promise<void>}
 * @throws {Error} When task removal fails
 *
 * @example
 * ```ts
 * await removeDownloadJobs(manga);
 * ```
 */
export async function removeDownloadJobs(manga: MangaWithChaptersAndLibrary): Promise<void> {
  try {
    // Delete all pending jobs for this manga
    await prisma.$executeRaw`
      DELETE FROM jobs
      WHERE manga_id = ${toNumberId(manga["id"])}
        AND status = 'pending'::"JobStatus"
        AND job_type = ${JobType.chapter_check}
    `;
    logger.info(`Removed all download jobs for manga: ${manga["title"]}`);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to remove download jobs for manga ${manga["title"]}: ${errorMessage}`);
    throw error;
  }
}
/**
 * Updates job status and related metadata
 * Handles job state transitions and error tracking
 *
 * @private
 * @param {number} jobId - ID of job to update
 * @param {JobStatus} status - New status to set
 * @param {string} [errorMessage] - Optional error message
 * @returns {Promise<void>}
 * @throws {Error} When status update fails
 *
 * @example
 * ```ts
 * await updateJobStatus(42, JobStatus.completed);
 * await updateJobStatus(42, JobStatus.failed, 'Download failed');
 * ```
 */
async function updateJobStatus(jobId: number, status: JobStatus, errorMessage?: string): Promise<void> {
  try {
    const jobIdBigInt = BigInt(jobId);
    if (status === JobStatus.completed) {
      await prisma.$queryRaw`
        SELECT complete_job(${jobIdBigInt}::BIGINT, NULL::JSONB)
      `;
    } else if (status === JobStatus.failed && errorMessage) {
      await prisma.$queryRaw`
        SELECT fail_job(${jobIdBigInt}::BIGINT, ${errorMessage}::TEXT)
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE jobs
        SET status = ${status},
            updated_at = NOW()
        WHERE id = ${jobIdBigInt}::BIGINT
      `;
    }
    logger.debug(`Updated job ${jobId} status to ${status}`);
  }
  catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to update job ${jobId} status: ${errorMsg}`);
    throw error;
  }
}