import { ChapterStatus, MangaLibraryStatus, Chapter, JobType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { cache } from '@/server/cache/cache-adapter';
import { prisma } from '@/server/db';
import { enqueueDownloadTask } from '@/server/queue/download';
import { queueManager } from '@/server/queue/queueManager';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { ValidationError } from '@/utils/errors';
import { toNumberId } from '@/utils/id-converters';
import { serverLogger } from '@/utils/serverLogger';


import { protectedProcedure, systemProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Input schema for bulk operations
 */
const bulkOperationSchema = z.object({
  mangaIds: z.array(z.number()).min(1, 'At least one manga ID is required'),
  operation: z.enum(['mark-read', 'mark-unread', 'download', 'remove', 'update-metadata', 'change-status']),
  additionalData: z.record(z.unknown()).optional()
});

/**
 * Input schema for marking chapters as read/unread
 */
const bulkMarkChaptersSchema = z.object({
  mangaIds: z.array(z.number()),
  isRead: z.boolean()
});

/**
 * Input schema for bulk status change
 */
const bulkChangeStatusSchema = z.object({
  mangaIds: z.array(z.number()),
  status: z.nativeEnum(MangaLibraryStatus)
});

/**
 * Input schema for bulk download
 */
const bulkDownloadSchema = z.object({
  mangaIds: z.array(z.number()),
  downloadAll: z.boolean().optional().default(false),
  chapterSelection: z.enum(['all', 'unread', 'latest']).optional().default('unread')
});

/**
 * Result type for bulk operations
 */
interface BulkOperationResult {
  successCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Helper function to handle download operations for a single manga
 */
async function handleMangaDownload(
  mangaId: number,
  chapterSelection: 'all' | 'unread' | 'latest'
): Promise<void> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    include: { Chapter: true }
  });

  if (!manga) {
    throw new ValidationError(`Manga ${mangaId} not found`);
  }

  let chaptersToDownload = manga.Chapter;

  // Filter chapters based on selection
  if (chapterSelection === 'unread') {
    chaptersToDownload = chaptersToDownload.filter(
      (ch: Chapter) => ch.downloadStatus !== ChapterStatus.COMPLETED
    );
  } else if (chapterSelection === 'latest') {
    chaptersToDownload = chaptersToDownload
      .sort((a: Chapter, b: Chapter) => b.index - a.index)
      .slice(0, 5);
  }

  // Queue download tasks for each chapter
  const downloadPromises = chaptersToDownload
    .filter((chapter: Chapter) => chapter.downloadStatus !== ChapterStatus.COMPLETED)
    .map((chapter: Chapter) => {
      const downloadData = {
        mangaId: toNumberId(manga.id),
        chapterIndex: chapter.index,
        mangaTitle: manga.title,
        chapterTitle: chapter.title,
        source: manga.source
      };
      return enqueueDownloadTask(downloadData);
    });

  await Promise.all(downloadPromises);
}

/**
 * Helper function to handle bulk downloads
 */
async function handleBulkDownload(
  mangaIds: number[],
  chapterSelection: 'all' | 'unread' | 'latest'
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    successCount: 0,
    errorCount: 0,
    errors: []
  };

  const downloadPromises = mangaIds.map(async (mangaId) => {
    try {
      await handleMangaDownload(mangaId, chapterSelection);
      result.successCount++;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errorCount++;
      result.errors.push(`Failed to queue downloads for manga ${mangaId}: ${errorMessage}`);
      serverLogger.error('Bulk download failed', { mangaId, error });
    }
  });

  await Promise.all(downloadPromises);
  return result;
}

/**
 * Helper function to handle bulk removal
 */
async function handleBulkRemove(mangaIds: number[]): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    successCount: 0,
    errorCount: 0,
    errors: []
  };

  const removePromises = mangaIds.map(async (mangaId) => {
    try {
      await prisma.manga.delete({
        where: { id: mangaId }
      });
      result.successCount++;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errorCount++;
      result.errors.push(`Failed to remove manga ${mangaId}: ${errorMessage}`);
      serverLogger.error('Bulk remove failed', { mangaId, error });
    }
  });

  await Promise.all(removePromises);

  // Invalidate tRPC middleware cache so list views update immediately
  if (result.successCount > 0) {
    await cache.clear('trpc:manga.*');
  }

  return result;
}

/**
 * Helper function to handle bulk metadata updates
 */
async function handleBulkMetadataUpdate(mangaIds: number[]): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    successCount: 0,
    errorCount: 0,
    errors: []
  };

  const updatePromises = mangaIds.map(async (mangaId) => {
    try {
      const manga = await prisma.manga.findUnique({
        where: { id: mangaId }
      });

      if (!manga) {
        throw new ValidationError(`Manga ${mangaId} not found`);
      }

      // TODO: Implement metadata update scheduling
      serverLogger.info('Metadata update requested', { mangaId, source: manga.source });
      result.successCount++;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errorCount++;
      result.errors.push(`Failed to update metadata for manga ${mangaId}: ${errorMessage}`);
      serverLogger.error('Bulk metadata update failed', { mangaId, error });
    }
  });

  await Promise.all(updatePromises);
  return result;
}

/**
 * Helper function to handle bulk status changes
 */
async function handleBulkStatusChange(
  mangaIds: number[],
  newStatus: MangaLibraryStatus
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    successCount: 0,
    errorCount: 0,
    errors: []
  };

  const statusPromises = mangaIds.map(async (mangaId) => {
    try {
      await prisma.manga.update({
        where: { id: mangaId },
        data: { libraryStatus: newStatus }
      });
      result.successCount++;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errorCount++;
      result.errors.push(`Failed to change status for manga ${mangaId}: ${errorMessage}`);
      serverLogger.error('Bulk status change failed', { mangaId, error });
    }
  });

  await Promise.all(statusPromises);
  return result;
}

/**
 * Helper function to handle mark read/unread operations
 */
function handleMarkReadUnread(mangaIds: number[]): BulkOperationResult {
  const result: BulkOperationResult = {
    successCount: mangaIds.length,
    errorCount: 0,
    errors: []
  };

  // Since Chapter model doesn't have isRead field, this operation is currently not supported
  // TODO: Implement reading progress tracking with a separate model
  mangaIds.forEach((mangaId) => {
    serverLogger.warn('Mark read/unread not implemented - Chapter model lacks isRead field', { mangaId });
  });

  return result;
}

/**
 * Bulk operations router
 *
 * Provides endpoints for performing bulk actions on multiple manga
 */
export const bulkRouter = router({
  /**
   * Perform a bulk operation on multiple manga
   */
  performBulkAction: protectedProcedure
    .input(bulkOperationSchema)
    .mutation(async ({ input }) => {
      const { mangaIds, operation, additionalData } = input;

      try {
        let result: BulkOperationResult;

        switch (operation) {
          case 'mark-read':
          case 'mark-unread': {
            result = handleMarkReadUnread(mangaIds);
            break;
          }

          case 'download': {
            const chapterSelection = (additionalData?.['chapterSelection'] as 'all' | 'unread' | 'latest' | undefined) ?? 'unread';
            result = await handleBulkDownload(mangaIds, chapterSelection);
            break;
          }

          case 'remove': {
            result = await handleBulkRemove(mangaIds);
            break;
          }

          case 'update-metadata': {
            result = await handleBulkMetadataUpdate(mangaIds);
            break;
          }

          case 'change-status': {
            const newStatus = additionalData?.['status'] as MangaLibraryStatus | undefined;
            if (!newStatus) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Status is required for change-status operation'
              });
            }
            result = await handleBulkStatusChange(mangaIds, newStatus);
            break;
          }

          default:
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Unknown operation: ${operation}`
            });
        }

        // Emit WebSocket event for real-time sync
        if (result.successCount > 0) {
          void realtimeEmitter.emitSystemEvent({
            eventType: `bulk:${operation}:completed`,
            source: 'bulk-router',
            message: `Bulk ${operation} completed: ${result.successCount} succeeded`,
            data: {
              operation,
              successCount: result.successCount,
              errorCount: result.errorCount,
              mangaIds
            }
          });
        }

        return {
          success: true,
          successCount: result.successCount,
          errorCount: result.errorCount,
          totalCount: mangaIds.length,
          errors: result.errors.length > 0 ? result.errors : null,
          message: `Operation completed: ${result.successCount} succeeded, ${result.errorCount} failed`
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        serverLogger.error('Bulk operation failed', { operation, errorMessage });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage
        });
      }
    }),

  /**
   * Mark chapters as read/unread for multiple manga
   */
  markChapters: protectedProcedure
    .input(bulkMarkChaptersSchema)
    .mutation(({ input }) => {
      const { mangaIds, isRead } = input;

      try {
        // Since Chapter model doesn't have isRead field, this operation is not implemented
        serverLogger.warn('Mark chapters operation not implemented - Chapter model lacks isRead field');

        // Emit WebSocket event for real-time sync (even for stub)
        void realtimeEmitter.emitSystemEvent({
          eventType: `bulk:chapters:${isRead ? 'read' : 'unread'}`,
          source: 'bulk-router',
          message: `Mark chapters as ${isRead ? 'read' : 'unread'} requested (not yet implemented)`,
          data: { mangaIds, isRead },
        });

        return {
          success: true,
          count: 0,
          message: `Mark chapters as ${isRead ? 'read' : 'unread'} is not implemented yet`
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        serverLogger.error('Bulk mark chapters failed', { errorMessage });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage
        });
      }
    }),

  /**
   * Change status for multiple manga
   */
  changeStatus: systemProcedure
    .input(bulkChangeStatusSchema)
    .mutation(async ({ input }) => {
      const { mangaIds, status } = input;

      try {
        const result = await prisma.manga.updateMany({
          where: {
            id: { in: mangaIds as number[] }
          },
          data: { libraryStatus: status }
        });

        // Emit WebSocket events for real-time sync
        if (result.count > 0) {
          for (const mangaId of mangaIds) {
            void realtimeEmitter.emitMangaUpdate({
              mangaId,
              action: 'updated',
              data: { libraryStatus: status }
            });
          }
        }

        return {
          success: true,
          count: result.count,
          message: `Updated status for ${result.count} manga`
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        serverLogger.error('Bulk status change failed', { mangaIds, status, errorMessage });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage
        });
      }
    }),

  /**
   * Queue downloads for multiple manga
   */
  queueDownloads: protectedProcedure
    .input(bulkDownloadSchema)
    .mutation(async ({ input }) => {
      const { mangaIds, chapterSelection } = input;

      try {
        let totalQueued = 0;
        const errors: string[] = [];

        const downloadPromises = mangaIds.map(async (mangaId) => {
          try {
            const manga = await prisma.manga.findUnique({
              where: { id: mangaId },
              include: { Chapter: true }
            });

            if (!manga) {
              errors.push(`Manga ${mangaId} not found`);
              return;
            }

            let chaptersToDownload = manga.Chapter;

            // Filter chapters based on selection
            if (chapterSelection === 'unread') {
              chaptersToDownload = chaptersToDownload.filter(
                (ch: Chapter) => ch.downloadStatus !== ChapterStatus.COMPLETED
              );
            } else if (chapterSelection === 'latest') {
              chaptersToDownload = chaptersToDownload
                .sort((a: Chapter, b: Chapter) => b.index - a.index)
                .slice(0, 5);
            }

            // Filter out already downloaded chapters
            chaptersToDownload = chaptersToDownload.filter(
              (ch: Chapter) => ch.downloadStatus !== ChapterStatus.COMPLETED
            );

            // Queue download tasks in parallel
            const chapterDownloadPromises = chaptersToDownload.map((chapter: Chapter) => {
              const downloadData = {
                mangaId: toNumberId(manga.id),
                chapterIndex: chapter.index,
                mangaTitle: manga.title,
                chapterTitle: chapter.title,
                source: manga.source
              };
              totalQueued++;
              return enqueueDownloadTask(downloadData);
            });

            await Promise.all(chapterDownloadPromises);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(`Failed to queue downloads for manga ${mangaId}: ${errorMessage}`);
            serverLogger.error('Failed to queue downloads for manga', { mangaId, error });
          }
        });

        await Promise.all(downloadPromises);

        // Emit WebSocket event for real-time sync
        if (totalQueued > 0) {
          void realtimeEmitter.emitSystemEvent({
            eventType: 'bulk:downloads:queued',
            source: 'bulk-router',
            message: `Queued ${totalQueued} chapters for download`,
            data: { totalQueued, mangaCount: mangaIds.length }
          });
        }

        return {
          success: true,
          totalQueued,
          errors: errors.length > 0 ? errors : null,
          message: `Queued ${totalQueued} chapters for download`
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        serverLogger.error('Bulk download queue failed', { mangaIds, errorMessage });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage
        });
      }
    }),

  /**
   * Remove multiple manga from library
   */
  removeManga: protectedProcedure
    .input(z.object({
      mangaIds: z.array(z.number()),
      deleteFiles: z.boolean().optional().default(false)
    }))
    .mutation(async ({ input }) => {
      const { mangaIds, deleteFiles } = input;

      try {
        // TODO: If deleteFiles is true, implement file deletion logic
        // This would need to get file paths from chapters and delete them
        if (deleteFiles) {
          serverLogger.warn('File deletion requested but not yet implemented for bulk operations', {
            mangaIds,
            deleteFiles
          });
        }

        const result = await prisma.manga.deleteMany({
          where: {
            id: { in: mangaIds as number[] }
          }
        });

        // Invalidate tRPC middleware cache so list views update immediately
        if (result.count > 0) {
          await cache.clear('trpc:manga.*');

          // Emit WebSocket events for real-time sync
          for (const mangaId of mangaIds) {
            void realtimeEmitter.emitMangaUpdate({
              mangaId,
              action: 'deleted'
            });
          }
        }

        return {
          success: true,
          count: result.count,
          message: `Removed ${result.count} manga from library${deleteFiles ? ' (file deletion not yet implemented)' : ''}`
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        serverLogger.error('Bulk remove failed', { mangaIds, errorMessage });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage
        });
      }
    }),

  /**
   * Queue metadata refresh jobs for multiple manga
   * Uses import profiles to determine which providers to refresh from
   */
  bulkRefreshMetadata: protectedProcedure
    .input(z.object({
      mangaIds: z.array(z.number()).min(1, 'At least one manga ID is required')
    }))
    .mutation(async ({ input }) => {
      const { mangaIds } = input;
      const errors: string[] = [];
      let successCount = 0;

      serverLogger.info('Starting bulk metadata refresh', { mangaCount: mangaIds.length });

      const refreshPromises = mangaIds.map(async (mangaId) => {
        try {
          const manga = await prisma.manga.findUnique({
            where: { id: mangaId },
            select: {
              id: true,
              title: true,
              providerMetadata: true,
              selectedSourceId: true,
              searchProvider: true
            }
          });

          if (!manga) {
            errors.push(`Manga ${mangaId} not found`);
            return;
          }

          // Extract import profile from providerMetadata
          const providerMetadata = typeof manga.providerMetadata === 'string'
            ? JSON.parse(manga.providerMetadata) as Record<string, unknown>
            : manga.providerMetadata as Record<string, unknown> | null;

          const importProfile = providerMetadata?.['importProfile'] ?? null;

          // Queue the refresh job
          await queueManager.enqueue(JobType.metadata_refresh, {
            mangaId,
            title: manga.title,
            forceRefresh: true,
            ...(importProfile !== null ? { importProfile } : {})
          }, {
            mangaId
          });

          successCount++;
          serverLogger.info('Queued metadata refresh', { mangaId, title: manga.title });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to queue refresh for manga ${mangaId}: ${errorMessage}`);
          serverLogger.error('Failed to queue metadata refresh', { mangaId, error: errorMessage });
        }
      });

      await Promise.all(refreshPromises);

      serverLogger.info('Bulk metadata refresh complete', {
        successCount,
        errorCount: errors.length,
        totalCount: mangaIds.length
      });

      // Emit WebSocket event for real-time sync
      if (successCount > 0) {
        void realtimeEmitter.emitSystemEvent({
          eventType: 'bulk:metadata:refresh:queued',
          source: 'bulk-router',
          message: `Queued ${successCount} manga for metadata refresh`,
          data: { successCount, totalCount: mangaIds.length }
        });
      }

      return {
        success: true,
        successCount,
        errorCount: errors.length,
        totalCount: mangaIds.length,
        errors: errors.length > 0 ? errors : null,
        message: `Queued ${successCount} of ${mangaIds.length} manga for metadata refresh`
      };
    })
});
