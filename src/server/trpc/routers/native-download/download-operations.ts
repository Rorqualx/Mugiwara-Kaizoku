/**
 * Native Download Operations Router
 *
 * Handles manga searching and chapter download operations.
 *
 * Procedures:
 * - searchManga: Search for manga across sources
 * - downloadChapter: Queue chapter download
 * - getDownloads: Get download history/status
 * - cancelDownload: Cancel active download
 * - retryDownload: Retry failed download
 *
 * @module server/trpc/routers/native-download/download-operations
 */

import { NativeDownloadStatus, JobPriority, Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';



import {
  getNativeDownloadManager,
  searchMangaInput,
  downloadChapterInput,
  getDownloadsInput
} from './utils';

// ============================================================================
// Download Operations Router
// ============================================================================

export const nativeDownloadOperationsRouter = router({
  /**
   * Search for manga across native download sources
   */
  searchManga: publicProcedure
    .input(searchMangaInput)
    .query(async ({ input }) => {
      try {
        // Use the NativeDownloadManager service
        const manager = await getNativeDownloadManager();
        const results = await manager.searchManga({
          query: input.query,
          ...(input.sourceIds !== undefined && { sourceIds: input.sourceIds }),
          ...(input.limit !== undefined && { limit: input.limit }),
          offset:
            input.page !== undefined ? (input.page - 1) * (input.limit ?? 20) : 0
        });
        logger.info(`Search completed for query: ${input.query}`);
        return results;
      } catch (error: unknown) {
        logger.error(`Search failed for query: ${input.query}`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Search failed',
          cause: error
        });
      }
    }),

  /**
   * Download a chapter using native download
   */
  downloadChapter: protectedProcedure
    .input(downloadChapterInput)
    .mutation(async ({ input }) => {
      try {
        // Convert mangaId to number
        const mangaId = toNumberId(input.mangaId);

        // Verify manga exists
        const manga = await prisma.manga.findUnique({
          where: {
            id: mangaId
          }
        });

        if (!manga) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Manga not found'
          });
        }

        // Create download record and job in a transaction
        // Note: sourceId is kept for legacy compatibility, sourceType identifies the download source
        const { download, job } = await prisma.$transaction(async (tx) => {
          // Create the download record
          const downloadRecord = await tx.nativeDownload.create({
            data: {
              sourceId: input.sourceId,
              mangaId,
              chapterId: parseInt(input.chapterId, 10),
              chapterNumber: input.chapterNumber ?? 0,
              status: NativeDownloadStatus.QUEUED,
              sourceType: input.sourceId // Use sourceId as sourceType identifier
            }
          });

          // Create a Job record for activity tracking
          const jobRecord = await tx.jobs.create({
            data: {
              job_type: 'native_download',
              queue_name: 'native_download',
              priority: JobPriority.normal,
              status: 'pending',
              manga_id: mangaId,
              payload: {
                downloadId: downloadRecord.id,
                sourceId: input.sourceId,
                chapterId: input.chapterId,
                chapterNumber: input.chapterNumber ?? 0
              } as Prisma.InputJsonValue,
              metadata: {
                downloadType: 'chapter',
                sourceName: input.sourceId
              } as Prisma.InputJsonValue
            }
          });

          return { download: downloadRecord, job: jobRecord };
        });

        // Queue the download with NativeDownloadManager
        const manager = await getNativeDownloadManager();
        await manager.queueDownload(download.id);

        logger.info('Queued chapter download', {
          downloadId: download.id,
          jobId: String(job.id),
          sourceId: input.sourceId,
          mangaId,
          chapterId: input.chapterId
        });

        return download;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error('Failed to queue download', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to queue download',
          cause: error
        });
      }
    }),

  /**
   * Get download history/status
   */
  getDownloads: protectedProcedure
    .input(getDownloadsInput)
    .query(async ({ input }) => {
      try {
        const where: Record<string, unknown> = {};

        if (input.sourceId) {
          where['sourceId'] = input.sourceId;
        }
        if (input.mangaId) {
          where['mangaId'] = toNumberId(input.mangaId);
        }
        if (input.status) {
          where['status'] = input.status;
        }

        const downloads = await prisma.nativeDownload.findMany({
          where,
          ...(input.limit !== undefined && { take: input.limit }),
          ...(input.offset !== undefined && { skip: input.offset }),
          orderBy: {
            startTime: 'desc'
          }
        });

        return downloads;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error('Failed to fetch downloads', errorMessage);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch downloads',
          cause: errorMessage
        });
      }
    }),

  /**
   * Cancel a download
   */
  cancelDownload: publicProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ input }) => {
      try {
        const download = await prisma.nativeDownload.findUnique({
          where: {
            id: input.id
          }
        });

        if (!download) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Download not found'
          });
        }

        if (
          download.status !== NativeDownloadStatus.QUEUED &&
          download.status !== NativeDownloadStatus.DOWNLOADING
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot cancel download in current status'
          });
        }

        const updated = await prisma.nativeDownload.update({
          where: {
            id: input.id
          },
          data: {
            status: NativeDownloadStatus.CANCELLED,
            endTime: new Date()
          }
        });

        // Cancel with NativeDownloadManager if actively downloading
        const manager = await getNativeDownloadManager();
        await manager.cancelDownload(input.id);

        logger.info(`Cancelled download ${input.id}`);
        return updated;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error(`Failed to cancel download ${input.id}`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel download',
          cause: error
        });
      }
    }),

  /**
   * Retry a failed download
   */
  retryDownload: publicProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ input }) => {
      try {
        const download = await prisma.nativeDownload.findUnique({
          where: {
            id: input.id
          }
        });

        if (!download) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Download not found'
          });
        }

        if (
          download.status !== NativeDownloadStatus.FAILED &&
          download.status !== NativeDownloadStatus.CANCELLED
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Can only retry failed or cancelled downloads'
          });
        }

        const updated = await prisma.nativeDownload.update({
          where: {
            id: input.id
          },
          data: {
            status: NativeDownloadStatus.QUEUED,
            progress: 0,
            error: null,
            startTime: new Date(),
            endTime: null
          }
        });

        // Re-queue with NativeDownloadManager
        const manager = await getNativeDownloadManager();
        await manager.queueDownload(input.id);

        logger.info(`Retried download ${input.id}`);
        return updated;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error(`Failed to retry download ${input.id}`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retry download',
          cause: error
        });
      }
    })
});
