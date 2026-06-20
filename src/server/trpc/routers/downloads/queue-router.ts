/**
 * Downloads Queue Router
 *
 * Handles download queue operations including adding, listing,
 * pausing, resuming, and removing downloads.
 *
 * Also includes statistics and history procedures.
 *
 * Queue state is persisted in the existing PackDownload + jobs tables (no
 * separate Download model by design); live transfer state and pause/resume
 * come from the configured download clients.
 *
 * Procedures:
 * - add: Add download to client + create tracking job/PackDownload
 * - list: List tracked downloads
 * - pause/resume/remove: Operate on the owning download client
 * - clearCompleted: Remove completed items from clients (files kept)
 * - stats: Tracked-download counts + live client stats
 * - history: Finished tracked downloads
 */

import { DownloadStatus, PackDownloadStatus, Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { adminProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { parseVolumeRange } from '@/server/utils/volumeRangeParser';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { isAdmin, requireUserId } from '../_shared/library-access';

import { getConfiguredClient, getEnabledClients, getPrimaryEnabledClient } from './client-config';
import {
  QUEUE_STATUS_MAP,
  clearCompletedFromClients,
  createDownloadTrackingJob,
  fetchWithTimeout,
  protocolForClientType,
  runClientOperation,
} from './queue-operations';
import { downloadRequestSchema, isRecord, queueFilterSchema } from './utils';

// ============================================================================
// Queue Operations Router
// ============================================================================

/**
 * Owner-scope fragment for pack_download reads. Admins see every download;
 * everyone else only the ones they initiated (NULL-owned/system rows stay
 * admin-only). See _shared/library-access.ts.
 */
function packOwnerWhere(ctx: unknown): Prisma.PackDownloadWhereInput {
  return isAdmin(ctx) ? {} : { initiatedByUserId: requireUserId(ctx) };
}

/**
 * Guard pause/resume/remove by client `downloadId`: a non-admin may only act on
 * a download they initiated. Admins are unrestricted. Throws FORBIDDEN when a
 * non-admin targets a download that isn't theirs (or has no tracking row).
 */
async function assertDownloadAccess(ctx: unknown, downloadId: string): Promise<void> {
  if (isAdmin(ctx)) return;
  const userId = requireUserId(ctx);
  const owned = await prisma.packDownload.findFirst({
    where: { downloadId, initiatedByUserId: userId },
    select: { id: true },
  });
  if (!owned) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This download is not in your account.' });
  }
}

/**
 * Queue operations router
 *
 * Handles all queue-related operations for downloads
 */
export const downloadsQueueRouter = router({
  /**
   * Add download to queue: hand the URL to the configured client and create
   * the tracking job + PackDownload row the download monitor resolves.
   */
  add: protectedProcedure.input(downloadRequestSchema).mutation(async ({ input, ctx }) => {
    try {
      const initiatedByUserId = requireUserId(ctx);
      const primary = await getPrimaryEnabledClient();
      const client = primary ? await getConfiguredClient(primary.type) : null;
      if (!primary || !client) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No download client configured',
        });
      }

      // Add to client first to get the download ID
      const downloadId = await client.addUrl({
        url: input.url,
        category: 'manga',
        paused: false,
      });

      const jobId = await createDownloadTrackingJob({
        mangaId: input.mangaId,
        initiatedByUserId,
        payload: { mode: 'BULK', method: 'QUEUE_ADD' },
        result: {
          downloadId: String(downloadId),
          clientType: primary.type,
          releaseTitle: input.filename,
          startTime: Date.now(),
          mode: 'BULK',
        },
      });

      const volumeRange = parseVolumeRange(input.filename);
      await prisma.packDownload.create({
        data: {
          releaseTitle: input.filename,
          mangaId: input.mangaId,
          jobId,
          initiatedByUserId,
          downloadId: String(downloadId),
          clientType: primary.type,
          protocol: protocolForClientType(primary.type),
          status: 'DOWNLOADING',
          downloadUrl: input.url,
          volumeStart: volumeRange?.start ?? null,
          volumeEnd: volumeRange?.end ?? null,
        },
      });

      logger.info(`Download added: ${input.filename}`, {
        jobId: String(jobId),
        downloadId: String(downloadId),
        clientType: primary.type,
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'download:added',
        source: 'queue-router',
        message: `Download added: ${input.filename}`,
        data: {
          downloadId: String(downloadId),
          mangaId: input.mangaId,
          filename: input.filename,
        },
      });

      return {
        success: true,
        downloadId: String(downloadId),
        externalId: downloadId,
        jobId: String(jobId),
      };
    } catch (error: unknown) {
      logger.error('Failed to add download', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to add download',
      });
    }
  }),

  /**
   * List tracked downloads in the queue
   */
  list: protectedProcedure.input(queueFilterSchema.optional()).query(async ({ input, ctx }) => {
    const statusFilter = input?.status !== undefined ? QUEUE_STATUS_MAP[input.status] ?? [] : null;
    if (statusFilter !== null && statusFilter.length === 0) {
      return []; // PAUSED has no persisted state — pause lives in the client only
    }
    const downloads = await prisma.packDownload.findMany({
      where: {
        ...packOwnerWhere(ctx),
        ...(statusFilter !== null ? { status: { in: statusFilter } } : {}),
        ...(input?.mangaId !== undefined ? { mangaId: input.mangaId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: input?.limit ?? 50,
      skip: input?.offset ?? 0,
      include: { manga: { select: { id: true, title: true } } },
    });
    return downloads.map((d) => ({
      id: String(d.id),
      downloadId: d.downloadId,
      jobId: String(d.jobId),
      title: d.releaseTitle,
      mangaId: d.mangaId,
      mangaTitle: d.manga.title,
      status: d.status,
      clientType: d.clientType,
      protocol: d.protocol,
      volumeStart: d.volumeStart,
      volumeEnd: d.volumeEnd,
      errorMessage: d.errorMessage,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
    }));
  }),

  /**
   * Pause download on the owning client
   */
  pause: protectedProcedure
    .input(
      z.object({
        downloadId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<boolean> => {
      await assertDownloadAccess(ctx, input.downloadId);
      const ok = await runClientOperation(input.downloadId, 'pause');
      if (!ok) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No client accepted pause for download ${input.downloadId}`,
        });
      }
      return true;
    }),

  /**
   * Resume download on the owning client
   */
  resume: protectedProcedure
    .input(
      z.object({
        downloadId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<boolean> => {
      await assertDownloadAccess(ctx, input.downloadId);
      const ok = await runClientOperation(input.downloadId, 'resume');
      if (!ok) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No client accepted resume for download ${input.downloadId}`,
        });
      }
      return true;
    }),

  /**
   * Remove download from the owning client and cancel its tracking rows
   */
  remove: protectedProcedure
    .input(
      z.object({
        downloadId: z.string(),
        deleteFiles: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<boolean> => {
      await assertDownloadAccess(ctx, input.downloadId);
      const ok = await runClientOperation(input.downloadId, 'remove', input.deleteFiles);
      // Mark in-flight tracking rows cancelled even if the client no longer knows the item
      await prisma.packDownload.updateMany({
        where: { downloadId: input.downloadId, status: PackDownloadStatus.DOWNLOADING },
        data: { status: PackDownloadStatus.CANCELLED },
      });
      if (!ok) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No client accepted remove for download ${input.downloadId}`,
        });
      }
      return true;
    }),

  /**
   * List downloads from all enabled download clients
   */
  // Admin-only: surfaces the raw shared download-client queue (all users'
  // transfers), used by the manual-track modal. Not per-user attributable.
  listClientDownloads: adminProcedure.query(async () => {
    const start = Date.now();
    try {
      const enabledClients = await getEnabledClients();
      logger.debug(`[TrackDownload] Querying ${enabledClients.length} clients: ${enabledClients.map(c => c.type).join(', ')}`);
      const allItems = await Promise.all(enabledClients.map((ec) => fetchWithTimeout(ec.type)));
      const flat = allItems.flat();
      logger.info(`[TrackDownload] Listed ${flat.length} downloads in ${Date.now() - start}ms`);
      return flat;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to list client downloads:', msg);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
    }
  }),

  /**
   * Create a tracking job for an existing download in a client
   */
  trackExistingDownload: protectedProcedure
    .input(z.object({
      downloadId: z.string(),
      clientType: z.string(),
      mangaId: z.number(),
      releaseName: z.string(),
      savePath: z.string().optional(),
      downloadUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const initiatedByUserId = requireUserId(ctx);
      const jobId = await createDownloadTrackingJob({
        mangaId: input.mangaId,
        initiatedByUserId,
        payload: { mode: 'BULK', method: 'MANUAL_TRACK' },
        result: {
          downloadId: input.downloadId,
          clientType: input.clientType,
          releaseTitle: input.releaseName,
          startTime: Date.now(),
          mode: 'BULK',
        },
      });

      const volumeRange = parseVolumeRange(input.releaseName);
      await prisma.packDownload.create({
        data: {
          releaseTitle: input.releaseName,
          mangaId: input.mangaId,
          jobId,
          initiatedByUserId,
          downloadId: input.downloadId,
          clientType: input.clientType,
          protocol: 'torrent',
          status: 'DOWNLOADING',
          downloadUrl: input.downloadUrl ?? null,
          volumeStart: volumeRange?.start ?? null,
          volumeEnd: volumeRange?.end ?? null,
        },
      });

      logger.info(`Manual download tracking created for "${input.releaseName}"`, {
        jobId: String(jobId),
        downloadId: input.downloadId,
        mangaId: input.mangaId,
      });

      // Fire job:created on jobs:active channel so the Jobs page's WebSocket
      // subscription refetches immediately. Without this the new row only
      // appears after the next 2s poll cycle — the user perceives the click
      // as "failed" because the modal closes with nothing visible in the table.
      void realtimeEmitter.emitJobCreated({
        jobId: String(jobId),
        status: 'running',
        jobType: 'chapter_download',
        metadata: { mangaId: input.mangaId, source: 'manual-track', releaseTitle: input.releaseName },
      });

      return { success: true, jobId: String(jobId) };
    }),

  /**
   * Clear completed downloads from the clients (downloaded files are kept)
   */
  // Admin-only: clears completed items from the shared download client(s).
  clearCompleted: adminProcedure.mutation(async () => {
    const count = await clearCompletedFromClients();
    logger.info(`Cleared ${count} completed downloads from clients`);
    return {
      success: true,
      count,
    };
  }),
});

// ============================================================================
// Statistics Router
// ============================================================================

/**
 * Statistics router - provides download statistics
 */
export const downloadsStatsRouter = router({
  /**
   * Get download statistics (tracked downloads + live client state)
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const grouped = await prisma.packDownload.groupBy({
      by: ['status'],
      where: packOwnerWhere(ctx),
      _count: true,
    });
    const countFor = (statuses: PackDownloadStatus[]): number =>
      grouped
        .filter((g) => statuses.includes(g.status))
        .reduce((sum, g) => sum + g._count, 0);

    const total = grouped.reduce((sum, g) => sum + g._count, 0);
    const downloading = countFor([PackDownloadStatus.DOWNLOADING]);
    const completed = countFor([
      PackDownloadStatus.COMPLETED,
      PackDownloadStatus.IMPORTING,
      PackDownloadStatus.IMPORTED,
    ]);
    const failed = countFor([PackDownloadStatus.FAILED]);
    const paused = 0; // Pause state lives in the clients, surfaced via clientStats

    // Get client stats if available
    let clientStats: {
      active: number;
      paused: number;
      completed: number;
      failed: number;
    } | null = null;

    try {
      const client = await getConfiguredClient();
      if (client) {
        const result = await client.getAllItems();

        // Check if result is an array directly (NzbgetClient) or an AsyncResult (others)
        let items: unknown[] = [];
        if (Array.isArray(result)) {
          items = result;
        } else if (isSuccess(result)) {
          items = result.data;
        }

        if (items.length > 0) {
          // Use reduce() to count statuses without await in loop
          // This avoids the no-await-in-loop ESLint violation
          // Return new objects to avoid no-param-reassign violation
          clientStats = items.reduce<{
            active: number;
            paused: number;
            completed: number;
            failed: number;
          }>(
            (acc, item) => {
              if (!isRecord(item)) return acc;

              const status = item['status'];

              if (
                status === DownloadStatus.DOWNLOADING ||
                status === 'downloading'
              ) {
                return { ...acc, active: acc.active + 1 };
              }
              if (status === DownloadStatus.PAUSED || status === 'paused') {
                return { ...acc, paused: acc.paused + 1 };
              }
              if (
                status === DownloadStatus.COMPLETED ||
                status === 'complete' ||
                status === 'completed'
              ) {
                return { ...acc, completed: acc.completed + 1 };
              }
              if (status === DownloadStatus.ERROR || status === 'error') {
                return { ...acc, failed: acc.failed + 1 };
              }

              return acc;
            },
            { active: 0, paused: 0, completed: 0, failed: 0 }
          );
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to get client stats', errorMessage);
    }

    return {
      total,
      downloading,
      completed,
      failed,
      paused,
      pending: Math.max(0, total - downloading - completed - failed - paused),
      client: clientStats,
    };
  }),

  /**
   * Get download history (finished tracked downloads, newest first)
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const downloads = await prisma.packDownload.findMany({
        where: {
          ...packOwnerWhere(ctx),
          status: {
            in: [
              PackDownloadStatus.COMPLETED,
              PackDownloadStatus.IMPORTING,
              PackDownloadStatus.IMPORTED,
              PackDownloadStatus.FAILED,
              PackDownloadStatus.CANCELLED,
            ],
          },
        },
        orderBy: [{ completedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: input.limit ?? 50,
        skip: input.offset ?? 0,
        include: { manga: { select: { id: true, title: true } } },
      });
      return downloads.map((d) => ({
        id: String(d.id),
        downloadId: d.downloadId,
        title: d.releaseTitle,
        mangaId: d.mangaId,
        mangaTitle: d.manga.title,
        status: d.status,
        clientType: d.clientType,
        protocol: d.protocol,
        fileSize: d.fileSize !== null ? String(d.fileSize) : null,
        errorMessage: d.errorMessage,
        createdAt: d.createdAt,
        completedAt: d.completedAt,
      }));
    }),
});

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Type export for the queue router
 */
export type DownloadsQueueRouter = typeof downloadsQueueRouter;

/**
 * Type export for the stats router
 */
export type DownloadsStatsRouter = typeof downloadsStatsRouter;
