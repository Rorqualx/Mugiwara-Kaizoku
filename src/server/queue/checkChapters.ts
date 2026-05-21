/**
 * @module server/queue/checkChapters
 * @description Chapter synchronization and monitoring system
 * Provides functionality for:
 * - Synchronizing local files with database
 * - Scheduling chapter checks
 * - Detecting and processing new chapters
 * - Managing manga status updates
 *
 * @example
 * ```ts
 * // Check for new chapters
 * await checkChapters(manga);
 *
 * // Schedule periodic checks
 * await schedule(manga);
 * ```
 */


import { JobStatus, JobType } from '@prisma/client';
import { MangaFileStatus } from '@prisma/client';

import type { ChapterFromLocal } from '@/utils/client/frontendHelpers';
import { toStringId, toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { getMangaLibraryPath } from '@/utils/manga';
import { findMissingChapterFiles, getChaptersFromLocal } from '@/utils/server/serverHelpers';


import { prisma } from "../db";
import { realtimeEmitter } from '../services/realtime/RealtimeEventEmitter';
import { sendNotification } from "../utils/notification";

import { queueManager } from "./queueManager";

import type { Prisma } from '@prisma/client';
import type { Chapter } from '@prisma/client';
/** Mapping between job and manga file status states */
const statusMap: Record<JobStatus, MangaFileStatus> = {
  [JobStatus.pending]: MangaFileStatus.PENDING,
  [JobStatus.active]: MangaFileStatus.PROCESSING,
  [JobStatus.completed]: MangaFileStatus.COMPLETED,
  [JobStatus.failed]: MangaFileStatus.FAILED,
  [JobStatus.cancelled]: MangaFileStatus.FAILED,
  [JobStatus.retrying]: MangaFileStatus.PROCESSING
};
/**
 * Extended manga type with related entities
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
 * Synchronizes database chapter records with local files
 * Creates, updates, and deletes chapter records to match filesystem
 *
 * @param {MangaWithIncludes} manga - Manga to synchronize
 * @returns {Promise<void>}
 * @throws {Error} When library is not found or sync fails
 *
 * @example
 * ```ts
 * // Sync chapters for a manga
 * await syncDbWithFiles(manga);
 * ```
 */
export async function syncDbWithFiles(manga: MangaWithIncludes): Promise<void> {
  try {
    const title = manga.title;
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
    const [localChapters, dbChapters] = await Promise.all([getChaptersFromLocal(mangaDir), prisma.chapter.findMany({
      where: {
        mangaId: toNumberId(manga.id)
      }
    })]);
    const chaptersToDelete = dbChapters.filter((dbChapter: Chapter) => !localChapters.some((localChapter: ChapterFromLocal) => localChapter.fileName === dbChapter.fileName && localChapter.index === dbChapter.index));
    const chaptersToCreate = localChapters.filter((localChapter: ChapterFromLocal) => !dbChapters.some((dbChapter: Chapter) => dbChapter.fileName === localChapter.fileName && dbChapter.index === localChapter.index));
    if (chaptersToDelete.length > 0 || chaptersToCreate.length > 0) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (chaptersToDelete.length > 0) {
          await tx.chapter.deleteMany({
            where: {
              id: {
                in: chaptersToDelete.map((chapter: Chapter) => chapter.id)
              }
            }
          });
        }
        if (chaptersToCreate.length > 0) {
          // When creating new chapters, preserve volume information if it exists
          // First check if we already have chapters with volume assignments
          const existingChaptersWithVolumes = await tx.chapter.findMany({
            where: {
              mangaId: toNumberId(manga.id),
              volume: { not: null }
            },
            select: {
              index: true,
              volume: true,
              fileName: true
            }
          });

          // Create a map of existing volume assignments by index
          const volumeMap = new Map<number, number>();
          existingChaptersWithVolumes.forEach((ch) => {
            if (ch.volume !== null) {
              volumeMap.set(ch.index, ch.volume);
            }
          });

          await tx.chapter.createMany({
            data: chaptersToCreate.map((chapter: ChapterFromLocal) => {
              // Try to extract volume from filename
              let volume: number | undefined;

              const chapterIndex = chapter.index;

              // Check if we have a volume assignment for this chapter index
              if (volumeMap.has(chapterIndex)) {
                volume = volumeMap.get(chapterIndex);
              }
              if (!volume && chapter.fileName) {
                // Try to extract volume from filename (e.g., "v01c001.cbz" -> volume 1)
                const volumeMatch = chapter.fileName.match(/v(\d+)/i);
                if (volumeMatch?.[1]) {
                  volume = parseInt(volumeMatch[1], 10);
                }
              }

              return {
                fileName: chapter.fileName,
                index: chapterIndex,
                size: chapter.size,
                mangaId: toNumberId(manga.id),
                title: chapter.title ?? `Chapter ${chapterIndex}`,
                updatedAt: new Date(),
                volume: volume || null
              };
            }),
            skipDuplicates: true,
          });
        }
        await tx.manga.update({
          where: {
            id: manga.id
          },
          data: {
            fileStatus: statusMap[JobStatus.active],
            lastChecked: new Date()
          }
        });
      });
      await sendNotification({
        title: "Database Sync Complete",
        body: `${title}: Removed ${chaptersToDelete.length} chapters and added ${chaptersToCreate.length} chapters.`
      }, 'sync_completed');

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'chapters:synced',
        source: 'checkChapters',
        message: `Database sync complete for ${title}`,
        data: {
          mangaId: manga.id,
          mangaTitle: title,
          chaptersDeleted: chaptersToDelete.length,
          chaptersCreated: chaptersToCreate.length,
        },
      });
    }
  }
  catch (error: unknown) {
  logger.error(`Error syncing files for manga ${manga.title}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
/**
 * Schedules periodic chapter checks for a manga
 * Respects monitoring configuration and interval settings
 *
 * @param {MangaWithIncludes} manga - Manga to schedule checks for
 * @param {boolean} [force=false] - Force scheduling regardless of interval
 * @returns {Promise<void>}
 * @throws {Error} When scheduling fails
 *
 * @example
 * ```ts
 * // Normal scheduling
 * await schedule(manga);
 *
 * // Force scheduling
 * await schedule(manga, true);
 * ```
 */
export async function schedule(manga: MangaWithIncludes, force = false): Promise<void> {
  try {
    if (!force && manga.monitoringConfig && typeof manga.monitoringConfig === 'object' && 'interval' in manga.monitoringConfig && manga.monitoringConfig['interval'] === "never") {
      logger.info(`Skipping schedule for ${manga.title} (interval: never)`);
      return;
    }
    await queueManager.enqueue(JobType.chapter_check, {
      mangaId: manga.id
    });
    logger.info(`Scheduled chapter check for ${manga.title}`);

    // Emit WebSocket event for real-time sync
    void realtimeEmitter.emitSystemEvent({
      eventType: 'chapters:check:scheduled',
      source: 'checkChapters',
      message: `Chapter check scheduled for ${manga.title}`,
      data: { mangaId: manga.id, mangaTitle: manga.title },
    });
  }
  catch (error: unknown) {
  logger.error(`Failed to schedule chapter check for ${manga.title}:`, error instanceof Error ? error.message : String(error));
    interface JobErrorWithContext extends Error {
      taskId?: string;
      jobType?: JobType;
    }
    const jobError: JobErrorWithContext = new Error(`Failed to schedule chapter check`);
    jobError.taskId = toStringId(manga.id);
    jobError.jobType = JobType.chapter_check;
    throw jobError;
  }
}
/**
 * Checks for new chapters and updates manga status
 * Performs filesystem scan and database synchronization
 *
 * @param {MangaWithIncludes} manga - Manga to check for updates
 * @returns {Promise<void>}
 * @throws {Error} When check fails
 *
 * @example
 * ```ts
 * // Check for new chapters
 * await checkChapters(manga);
 * ```
 */
export async function checkChapters(manga: MangaWithIncludes): Promise<void> {
  try {
    const title = manga.title;
    logger.info(`Checking for new chapters: ${title}`);
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
    await syncDbWithFiles(manga);
    const source = typeof manga.source === 'string' ? manga.source : 'unknown';
    const missingChapters: ChapterFromLocal[] = await findMissingChapterFiles(mangaDir, source, title);
    if (missingChapters.length === 0) {
      logger.info(`No new chapters found for ${title}`);
      await prisma.manga.update({
        where: {
          id: manga.id
        },
        data: {
          lastChecked: new Date(),
          fileStatus: statusMap[JobStatus.completed]
        }
      });
      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'chapters:check:completed',
        source: 'checkChapters',
        message: `No new chapters found for ${title}`,
        data: { mangaId: manga.id, mangaTitle: title, newChapters: 0 },
      });
      return;
    }
    for (const chapter of missingChapters) {
      chapter.title = chapter.title || "Untitled";
      logger.debug(`Processing chapter: ${JSON.stringify(chapter)}`);
    }
    await prisma.manga.update({
      where: {
        id: manga.id
      },
      data: {
        fileStatus: statusMap[JobStatus.active],
        lastChecked: new Date()
      }
    });
  }
  catch (error: unknown) {
  logger.error(`Error checking chapters for ${manga.title}:`, error instanceof Error ? error.message : String(error));
    await prisma.manga.update({
      where: {
        id: manga.id
      },
      data: {
        fileStatus: statusMap[JobStatus.failed],
        lastChecked: new Date()
      }
    });
    interface JobErrorWithContext extends Error {
      taskId?: string;
      jobType?: JobType;
    }
    const jobError: JobErrorWithContext = new Error(`Failed to check chapters for manga ${manga.id}`);
    jobError.taskId = toStringId(manga.id);
    jobError.jobType = JobType.chapter_check;
    throw jobError;
  }
}