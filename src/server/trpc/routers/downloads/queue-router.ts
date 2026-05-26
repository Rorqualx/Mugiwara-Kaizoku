/**
 * Downloads Queue Router
 *
 * Handles download queue operations including adding, listing,
 * pausing, resuming, and removing downloads.
 *
 * Also includes statistics and history procedures.
 *
 * Procedures:
 * - add: Add download to queue
 * - list: List downloads in queue
 * - pause: Pause download
 * - resume: Resume download
 * - remove: Remove download
 * - clearCompleted: Clear completed downloads
 * - stats: Get download statistics
 * - history: Get download history
 *
 * Extracted from: downloads.ts (lines 295-586)
 *
 * ESLint fixes applied:
 * - no-await-in-loop: Use reduce() instead of filter().length for stats counting
 */

import { DownloadStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { parseVolumeRange } from '@/server/utils/volumeRangeParser';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { getConfiguredClient, getEnabledClients } from './client-config';
import { downloadRequestSchema, isRecord, queueFilterSchema } from './utils';

// ============================================================================
// Helper Types & Functions
// ============================================================================

interface ClientDownloadItem {
  id: string;
  name: string;
  status: string;
  progress: number;
  clientType: string;
  savePath: string;
  size: number;
}

async function fetchDownloadsFromClient(
  clientType: string
): Promise<ClientDownloadItem[]> {
  try {
    const client = await getConfiguredClient(clientType);
    if (!client) {
      logger.debug(`[TrackDownload] No configured client for ${clientType}`);
      return [];
    }
    const itemsResult = await client.getAllItems();
    if (!isSuccess(itemsResult)) {
      logger.warn(`[TrackDownload] Failed to get items from ${clientType}`, {
        error: 'error' in itemsResult ? String(itemsResult.error) : 'unknown',
      });
      return [];
    }
    return itemsResult.data.map((item) => ({
      id: String(item.id),
      name: item.name,
      status: item.status,
      progress: item.progress,
      clientType,
      savePath: item.savePath,
      size: item.size ?? 0,
    }));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`[TrackDownload] Error fetching from ${clientType}: ${msg}`);
    return [];
  }
}

/** Fetch from a client with a 10s timeout to avoid blocking on unresponsive clients */
async function fetchWithTimeout(clientType: string): Promise<ClientDownloadItem[]> {
  const clientStart = Date.now();
  const result = await Promise.race([
    fetchDownloadsFromClient(clientType),
    new Promise<ClientDownloadItem[]>((resolve) => {
      setTimeout(() => {
        logger.warn(`[TrackDownload] Timeout fetching from ${clientType} after 10s`);
        resolve([]);
      }, 10_000);
    }),
  ]);
  logger.debug(`[TrackDownload] ${clientType}: ${result.length} items (${Date.now() - clientStart}ms)`);
  return result;
}

// ============================================================================
// Queue Operations Router
// ============================================================================

/**
 * Queue operations router
 *
 * Handles all queue-related operations for downloads
 */
export const downloadsQueueRouter = router({
  /**
   * Add download to queue
   */
  add: protectedProcedure.input(downloadRequestSchema).mutation(async ({ input }) => {
    try {
      const client = await getConfiguredClient();
      if (!client) {
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

      // Create download record data
      const downloadData: {
        downloadId: string;
        mangaId: number;
        chapterId?: number;
        downloadUrl: string;
        title: string;
        status: string;
        downloadClient: string;
        priority: number;
      } = {
        downloadId: String(downloadId),
        mangaId: input.mangaId,
        downloadUrl: input.url,
        title: input.filename,
        status: 'DOWNLOADING',
        downloadClient: 'transmission',
        priority:
          input.priority === 'HIGH' ? 1 : input.priority === 'LOW' ? -1 : 0,
      };

      if (input.chapterId !== undefined) {
        downloadData['chapterId'] = input.chapterId;
      }

      // TODO: Add Download model (separate download tracking)
      // Currently using Chapter.downloadStatus instead

      logger.info(`Download added: ${input.filename}`);

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
   * List downloads in queue
   */
  list: publicProcedure.input(queueFilterSchema.optional()).query(() => {
    // TODO: Add Download model (separate download tracking)
    // Currently using Chapter.downloadStatus instead
    return [];
  }),

  /**
   * Pause download
   */
  pause: protectedProcedure
    .input(
      z.object({
        downloadId: z.string(),
      })
    )
    .mutation(({ input: _input }): Promise<AsyncResult<boolean, Error>> => {
      // TODO: Add Download model (separate download tracking)
      logger.warn(
        'Pause download not implemented - Download model not yet created'
      );
      return Promise.resolve(
        createErrorResult(
          new Error('Download model not implemented - use Chapter.downloadStatus')
        )
      );
    }),

  /**
   * Resume download
   */
  resume: protectedProcedure
    .input(
      z.object({
        downloadId: z.string(),
      })
    )
    .mutation(({ input: _input }): Promise<AsyncResult<boolean, Error>> => {
      // TODO: Add Download model (separate download tracking)
      logger.warn(
        'Resume download not implemented - Download model not yet created'
      );
      return Promise.resolve(
        createErrorResult(
          new Error('Download model not implemented - use Chapter.downloadStatus')
        )
      );
    }),

  /**
   * Remove download
   */
  remove: protectedProcedure
    .input(
      z.object({
        downloadId: z.string(),
        deleteFiles: z.boolean().optional(),
      })
    )
    .mutation(({ input: _input }): Promise<AsyncResult<boolean, Error>> => {
      // TODO: Add Download model (separate download tracking)
      logger.warn(
        'Remove download not implemented - Download model not yet created'
      );
      return Promise.resolve(
        createErrorResult(
          new Error('Download model not implemented - use Chapter.downloadStatus')
        )
      );
    }),

  /**
   * List downloads from all enabled download clients
   */
  listClientDownloads: protectedProcedure.query(async () => {
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
    .mutation(async ({ input }) => {
      // Use raw SQL with NOW() to avoid JS Date/PostgreSQL timezone mismatch
      const resultJson = JSON.stringify({
        downloadId: input.downloadId,
        clientType: input.clientType,
        releaseTitle: input.releaseName,
        startTime: Date.now(),
        mode: 'BULK',
      });
      const payloadJson = JSON.stringify({ mode: 'BULK', method: 'MANUAL_TRACK' });

      const jobRows = await prisma.$queryRaw<Array<{ id: bigint }>>`
        INSERT INTO jobs (
          queue_name, job_type, priority, status, progress,
          started_at, scheduled_for, manga_id, partition_key,
          payload, result
        ) VALUES (
          'default',
          'chapter_download'::"JobType",
          'high'::"JobPriority",
          'active'::"JobStatus",
          0,
          NOW(), NOW(),
          ${input.mangaId}::integer,
          'active',
          ${payloadJson}::jsonb,
          ${resultJson}::jsonb
        ) RETURNING id
      `;

      const job = jobRows[0];
      if (!job) throw new Error('Failed to create tracking job');

      const volumeRange = parseVolumeRange(input.releaseName);
      await prisma.packDownload.create({
        data: {
          releaseTitle: input.releaseName,
          mangaId: input.mangaId,
          jobId: job.id,
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
        jobId: String(job.id),
        downloadId: input.downloadId,
        mangaId: input.mangaId,
      });

      // Fire job:created on jobs:active channel so the Jobs page's WebSocket
      // subscription refetches immediately. Without this the new row only
      // appears after the next 2s poll cycle — the user perceives the click
      // as "failed" because the modal closes with nothing visible in the table.
      void realtimeEmitter.emitJobCreated({
        jobId: String(job.id),
        status: 'running',
        jobType: 'chapter_download',
        metadata: { mangaId: input.mangaId, source: 'manual-track', releaseTitle: input.releaseName },
      });

      return { success: true, jobId: String(job.id) };
    }),

  /**
   * Clear completed downloads
   */
  clearCompleted: protectedProcedure.mutation(() => {
    // TODO: Add Download model (separate download tracking)
    logger.warn(
      'Clear completed downloads not implemented - Download model not yet created'
    );
    return {
      success: false,
      count: 0,
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
   * Get download statistics
   */
  stats: publicProcedure.query(async () => {
    // Temporary zeros until Download model is implemented
    const [total, downloading, completed, failed, paused] = [0, 0, 0, 0, 0];

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
      pending: total - downloading - completed - failed - paused,
      client: clientStats,
    };
  }),

  /**
   * Get download history
   */
  history: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      })
    )
    .query(() => {
      // TODO: Add Download model (separate download tracking)
      return [];
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
