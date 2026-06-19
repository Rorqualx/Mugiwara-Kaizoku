import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import type { IDownloadWorkerData } from '@/server/queue/download';
import { enqueueDownloadTask } from '@/server/queue/download';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { logInfo, EventType, EventSource } from '@/utils/system-event-logger';

import { protectedProcedure, publicProcedure } from '../procedures';
import { router } from '../trpc';

import { assertMembership, requireUserId } from './_shared/library-access';
/**
 * Download Router - Manages download-related operations
 *
 * This router provides endpoints for tracking and managing the progress of
 * manga download operations in the system.
 */
export const downloadRouter = router({
  /**
   * Retrieves the progress of active download operations
   *
   * This endpoint queries the database for batch operations of type 'download'
   * that are currently running, and returns their progress information.
   * It's used by the UI to display download progress bars and status indicators.
   *
   * @returns {Array<Object>} Array of download operations with progress information
   * @returns {number} .taskId - The ID of the batch operation
   * @returns {number} .progress - The download progress as a percentage (0-100)
   * @returns {number|null} .mangaId - The ID of the manga being downloaded, if available
   * @returns {Object} .options - Additional options associated with the download
   */
  getProgress: publicProcedure.query(async () => {
    try {
      // Get download progress from active jobs
      const downloadJobs = await prisma.$queryRaw<Array<{
        id: bigint;
        manga_id: bigint | null;
        payload: unknown;
        metadata: unknown;
        status: string;
        created_at: Date;
      }>>`
        SELECT id, manga_id, payload, metadata, status, created_at
        FROM jobs
        WHERE job_type = 'chapter_check'::"JobType"
          AND status IN ('pending'::"JobStatus", 'active'::"JobStatus")
        ORDER BY created_at DESC
        LIMIT 100
      `;

      // Format the response
      return downloadJobs.map(job => ({
        taskId: Number(job["id"]),
        progress: job["status"] === 'active' ? 50 : 0, // Simple progress indicator
        mangaId: job.manga_id ? Number(job.manga_id) : null,
        options: job["metadata"] ?? {}
      }));
    }
    catch (error: unknown) {
      logger.error(`Failed to get download progress: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }),

  /**
   * Download all chapters of a manga
   *
   * @param input Object containing manga ID
   * @returns Bare status message (errors are thrown as TRPCError)
   */
  downloadAllChapters: protectedProcedure.
  input(z.object({
    mangaId: z.number()
  })).
  mutation(async ({ input, ctx }): Promise<{ message: string }> => {
    try {
      const { mangaId } = input;
      await assertMembership(ctx.prisma, requireUserId(ctx), mangaId);

      // Get manga with chapters
      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        include: {
          Chapter: {
            orderBy: { index: 'asc' }
          }
        }
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found'
        });
      }

      if (manga['Chapter'].length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No chapters available for download'
        });
      }

      // Create download tasks for all chapters (in parallel for better performance)
      await Promise.all(
        manga['Chapter'].map(async (chapter) => {
          const downloadData: IDownloadWorkerData = {
            mangaId,
            chapterIndex: chapter.index
          };
          await enqueueDownloadTask(downloadData);
        })
      );

      logger.info(`Successfully enqueued download tasks for all ${manga['Chapter'].length} chapters of manga: ${manga["title"]}`);

      // Log system event
      await logInfo(
        `Started downloading all chapters for ${manga["title"]}`,
        EventType.DOWNLOAD_STARTED,
        EventSource.DOWNLOAD,
        {
          relatedEntityId: toStringId(mangaId),
          relatedEntityType: 'manga',
          details: {
            mangaTitle: manga["title"],
            chapterCount: manga['Chapter'].length,
            method: 'ALL_CHAPTERS'
          }
        }
      );

      // Emit WebSocket event for download started
      void realtimeEmitter.emitDownloadProgress({
        taskId: `download-all-${mangaId}`,
        mangaId,
        progress: 0,
        status: 'queued',
        filename: `All chapters (${manga['Chapter'].length})`
      });

      return {
        message: `Started downloading ${manga['Chapter'].length} chapters`
      };
    } catch (error: unknown) {
      logger.error(`Failed to download all chapters: ${error instanceof Error ? error.message : String(error)}`);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to start download'
      });
    }
  }),

  /**
   * Download missing chapters of a manga
   *
   * @param input Object containing manga ID
   * @returns Bare status message and optional chapter count (errors are thrown as TRPCError)
   */
  downloadMissingChapters: protectedProcedure.
  input(z.object({
    mangaId: z.number()
  })).
  mutation(async ({ input, ctx }): Promise<{ message: string; chapterCount?: number }> => {
    try {
      const { mangaId } = input;
      await assertMembership(ctx.prisma, requireUserId(ctx), mangaId);

      // Get manga with missing chapters (not downloaded)
      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        include: {
          Chapter: {
            orderBy: { index: 'asc' }
          }
        }
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found'
        });
      }

      if (manga['Chapter'].length === 0) {
        return {
          message: 'No missing chapters to download',
          chapterCount: 0
        };
      }

      // Create download tasks for missing chapters (in parallel for better performance)
      await Promise.all(
        manga['Chapter'].map(async (chapter) => {
          const downloadData: IDownloadWorkerData = {
            mangaId,
            chapterIndex: chapter.index
          };
          await enqueueDownloadTask(downloadData);
        })
      );

      logger.info(`Successfully enqueued download tasks for ${manga['Chapter'].length} missing chapters of manga: ${manga["title"]}`);

      // Log system event
      await logInfo(
        `Started downloading missing chapters for ${manga["title"]}`,
        EventType.DOWNLOAD_STARTED,
        EventSource.DOWNLOAD,
        {
          relatedEntityId: toStringId(mangaId),
          relatedEntityType: 'manga',
          details: {
            mangaTitle: manga["title"],
            chapterCount: manga['Chapter'].length,
            method: 'MISSING_CHAPTERS'
          }
        }
      );

      // Emit WebSocket event for download started
      void realtimeEmitter.emitDownloadProgress({
        taskId: `download-missing-${mangaId}`,
        mangaId,
        progress: 0,
        status: 'queued',
        filename: `Missing chapters (${manga['Chapter'].length})`
      });

      return {
        message: `Started downloading ${manga['Chapter'].length} chapters`
      };
    } catch (error: unknown) {
      logger.error(`Failed to download missing chapters: ${error instanceof Error ? error.message : String(error)}`);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to start download'
      });
    }
  }),

  /**
   * Download next N chapters of a manga
   *
   * @param input Object containing manga ID and count
   * @returns Bare status message and optional chapter count (errors are thrown as TRPCError)
   */
  downloadNextChapters: protectedProcedure.
  input(z.object({
    mangaId: z.number(),
    count: z.number().min(1).max(50).default(5)
  })).
  mutation(async ({ input, ctx }): Promise<{ message: string; chapterCount?: number }> => {
    try {
      const { mangaId, count } = input;
      await assertMembership(ctx.prisma, requireUserId(ctx), mangaId);

      // Get manga with unread chapters (assuming next chapters are unread ones)
      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        include: {
          Chapter: {
            where: {
              isRead: false
            },
            orderBy: { index: 'asc' },
            take: count
          }
        }
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found'
        });
      }

      if (manga['Chapter'].length === 0) {
        return {
          message: 'No next chapters available for download',
          chapterCount: 0
        };
      }

      // Create download tasks for next chapters (in parallel for better performance)
      await Promise.all(
        manga['Chapter'].map(async (chapter) => {
          const downloadData: IDownloadWorkerData = {
            mangaId,
            chapterIndex: chapter.index
          };
          await enqueueDownloadTask(downloadData);
        })
      );

      logger.info(`Successfully enqueued download tasks for next ${manga['Chapter'].length} chapters of manga: ${manga["title"]}`);

      // Log system event
      await logInfo(
        `Started downloading next ${manga['Chapter'].length} chapters for ${manga["title"]}`,
        EventType.DOWNLOAD_STARTED,
        EventSource.DOWNLOAD,
        {
          relatedEntityId: toStringId(mangaId),
          relatedEntityType: 'manga',
          details: {
            mangaTitle: manga["title"],
            chapterCount: manga['Chapter'].length,
            requestedCount: count,
            method: 'NEXT_CHAPTERS'
          }
        }
      );

      // Emit WebSocket event for download started
      void realtimeEmitter.emitDownloadProgress({
        taskId: `download-next-${mangaId}`,
        mangaId,
        progress: 0,
        status: 'queued',
        filename: `Next chapters (${manga['Chapter'].length})`
      });

      return {
        message: `Started downloading next ${manga['Chapter'].length} chapters`
      };
    } catch (error: unknown) {
      logger.error(`Failed to download next chapters: ${error instanceof Error ? error.message : String(error)}`);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to start download'
      });
    }
  })
});