import { JobStatus, Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { cache } from '@/server/cache/cache-adapter';
import { prisma } from '@/server/db';
import { syncToDatabase } from '@/server/services/download/tracked-download/db-sync';
import { TrackedDownloadService } from '@/server/services/download/tracked-download/tracked-download-service';
import { TrackedDownloadEvent } from '@/server/services/download/tracked-download/types';
import { createPackImportService } from '@/server/services/packImport/packImportService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { adminProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { assertMembership, isAdmin, requireUserId } from '@/server/trpc/routers/_shared/library-access';
import { router } from '@/server/trpc/trpc';
import { isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { tryRemoveTorrent } from './utils';

async function invalidateJobsAndActivity(): Promise<void> {
  await cache.clear('trpc:jobs.*');
  await cache.clear('trpc:activity.*');
}

/**
 * Throw FORBIDDEN unless the caller may act on this job. Admins may act on any
 * job; everyone else only on jobs they initiated. Keeps a non-admin from
 * retrying/cancelling/deleting another user's job by guessing its id.
 */
async function assertJobAccess(ctx: unknown, jobId: bigint): Promise<void> {
  if (isAdmin(ctx)) return;
  const userId = requireUserId(ctx);
  const job = await prisma.jobs.findFirst({
    where: { id: jobId, initiated_by_user_id: userId },
    select: { id: true },
  });
  if (!job) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This job is not in your account.' });
  }
}

export const jobsMutationsRouter = router({
  /**
   * Reset a failed job to PENDING so it can be attempted again.
   */
  retry: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const jobId = BigInt(input.id);
      await assertJobAccess(ctx, jobId);
      const initiatedByUserId = requireUserId(ctx);
      const updateData: Prisma.jobsUpdateInput = {
        status: JobStatus.pending,
        attempt_count: 0,
        last_error: Prisma.NullableJsonNullValueInput.DbNull,
      };
      const result = await prisma.jobs.update({
        where: { id_partition_key: { id: jobId, partition_key: 'active' } },
        data: updateData,
      });

      void realtimeEmitter.emitJobProgress(input.id, 0, {
        jobType: result.job_type,
        status: 'pending',
      });

      // Flipping job status to pending only puts it back in the queue's eligible
      // pool. Without an active dispatch trigger the chapter(s) the job covers
      // sit idle until the next autoDownloadScheduler poll (1h). Fire the
      // unified search so a new attempt actually launches immediately. Fire-
      // and-forget — Jobs page polling at 2s will surface the new job row.
      if (result.manga_id !== null) {
        const mangaId = result.manga_id;
        void import('@/server/services/library/releaseDispatcher/dispatch')
          .then(({ runUnifiedReleaseSearch }) => runUnifiedReleaseSearch(mangaId, { bypassRuleCheck: true, initiatedByUserId }))
          .catch((err: unknown) => {
            logger.error('Post-retry dispatch failed', {
              jobId: input.id,
              mangaId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }

      return result;
    }),

  /**
   * Cancel a job and remove its associated torrent from the download client.
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const jobId = BigInt(input.id);
      await assertJobAccess(ctx, jobId);

      const job = await prisma.jobs.findFirst({
        where: { id: jobId },
        select: { result: true },
      });
      const torrentRemoved = await tryRemoveTorrent(job?.result, input.id);

      const result = await prisma.jobs.update({
        where: { id_partition_key: { id: jobId, partition_key: 'active' } },
        data: { status: JobStatus.cancelled },
      });

      if (result.manga_id) {
        await prisma.chapter.updateMany({
          where: { mangaId: result.manga_id, downloadStatus: 'DOWNLOADING' },
          data: { downloadStatus: 'PENDING' },
        });
      }

      void realtimeEmitter.emitJobUpdate({
        jobId: input.id,
        jobType: result.job_type,
        status: 'cancelled',
      });

      return { ...result, torrentRemoved };
    }),

  /**
   * Permanently remove a single job from the database (cross-partition).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const jobId = BigInt(input.id);
      await assertJobAccess(ctx, jobId);
      const result = await prisma.jobs.deleteMany({ where: { id: jobId } });
      if (result.count === 0) {
        throw new Error(`Job with id ${input.id} not found`);
      }

      await invalidateJobsAndActivity();

      void realtimeEmitter.emitSystemEvent({
        eventType: 'job:deleted',
        source: 'jobs-router',
        message: `Job ${input.id} deleted`,
      });

      return { deleted: true, id: input.id };
    }),

  /**
   * Permanently remove all completed jobs.
   */
  deleteCompleted: adminProcedure
    .mutation(async () => {
      const result = await prisma.jobs.deleteMany({
        where: { status: JobStatus.completed },
      });

      await invalidateJobsAndActivity();

      void realtimeEmitter.emitSystemEvent({
        eventType: 'jobs:cleanup',
        source: 'jobs-router',
        message: `Deleted ${result.count} completed jobs`,
        data: { count: result.count, status: 'completed' },
      });

      return result;
    }),

  /**
   * Permanently remove all failed jobs.
   */
  deleteFailed: adminProcedure
    .mutation(async () => {
      const result = await prisma.jobs.deleteMany({
        where: { status: JobStatus.failed },
      });

      await invalidateJobsAndActivity();

      void realtimeEmitter.emitSystemEvent({
        eventType: 'jobs:cleanup',
        source: 'jobs-router',
        message: `Deleted ${result.count} failed jobs`,
        data: { count: result.count, status: 'failed' },
      });

      return result;
    }),

  /**
   * Permanently remove multiple jobs by ID.
   */
  deleteByIds: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const jobIds = input.ids.map(id => BigInt(id));

      // Non-admins can only delete jobs they initiated; admins delete any.
      const result = await prisma.jobs.deleteMany({
        where: {
          id: { in: jobIds },
          ...(isAdmin(ctx) ? {} : { initiated_by_user_id: requireUserId(ctx) }),
        },
      });

      await invalidateJobsAndActivity();

      void realtimeEmitter.emitSystemEvent({
        eventType: 'jobs:bulk-deleted',
        source: 'jobs-router',
        message: `Deleted ${result.count} jobs`,
        data: { count: result.count, requestedCount: input.ids.length },
      });

      return { deleted: result.count, requested: input.ids.length };
    }),

  /**
   * Transition an ImportBlocked tracked download back to Importing.
   */
  retryImport: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }): Promise<{ success: boolean }> => {
      await assertJobAccess(ctx, BigInt(input.jobId));
      const service = TrackedDownloadService.getInstance();
      const trackingId = `job:${input.jobId}`;

      const result = service.transitionState(trackingId, TrackedDownloadEvent.RETRY_IMPORT);
      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error ?? 'Cannot retry import',
        });
      }

      const tracked = service.get(trackingId);
      if (tracked) {
        await syncToDatabase(prisma, tracked, result.previousState);
      }

      logger.info('[Jobs] Retry import initiated', { jobId: input.jobId, trackingId });
      return { success: true };
    }),

  /**
   * Transition an ImportBlocked or Failed tracked download to Ignored.
   */
  /**
   * Manual import: bind a user-provided file or directory to a manga
   * (and an optional originating jobId for audit-trail purposes). Used
   * by the job-detail page when a torrent failed and the user has a
   * local copy. Reuses the existing PackImport flow end-to-end by
   * creating a synthetic PackDownload row whose `filePath` points at
   * the user's source — every downstream step (readiness check,
   * extraction, multi-part RAR detection, volume-grouping, chapter
   * linking, auto-conversion) runs untouched.
   *
   * The user provides a server-side path (text input — browsers cannot
   * see server filesystems). The path is validated for existence and
   * readability before any PackDownload row is created. Failure modes
   * surface as TRPCError BAD_REQUEST so the UI can show them inline.
   */
  importPathToVolume: protectedProcedure
    .input(z.object({
      mangaId: z.number().int().positive(),
      sourcePath: z.string().min(1).max(4000),
      jobId: z.string().optional(),
      volumeId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const initiatedByUserId = requireUserId(ctx);
      await assertMembership(ctx.prisma, initiatedByUserId, input.mangaId);
      const fsp = await import('fs/promises');
      try {
        await fsp.access(input.sourcePath);
      } catch {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Source path not found or unreadable: ${input.sourcePath}`,
        });
      }

      const manga = await prisma.manga.findUnique({
        where: { id: input.mangaId },
        select: { id: true, title: true },
      });
      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Manga ${input.mangaId} not found` });
      }

      if (input.volumeId !== undefined) {
        const vol = await prisma.volume.findFirst({
          where: { id: input.volumeId, mangaId: input.mangaId },
          select: { id: true },
        });
        if (!vol) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Volume ${input.volumeId} does not belong to manga ${input.mangaId}`,
          });
        }
      }

      // Synthetic PackDownload: lets us run importPack untouched, gives
      // an audit row, and survives in the table so the same path can't
      // be silently double-imported (the constructor uses a unique
      // (mangaId, downloadId) shape implicitly via downloadId).
      const auditTag = `manual-${Date.now()}`;
      const synthetic = await prisma.packDownload.create({
        data: {
          releaseTitle: `Manual import: ${input.sourcePath}`,
          mangaId: input.mangaId,
          initiatedByUserId,
          jobId: input.jobId !== undefined ? BigInt(input.jobId) : BigInt(0),
          downloadId: auditTag,
          clientType: 'manual',
          protocol: 'manual',
          status: 'COMPLETED',
          filePath: input.sourcePath,
        },
      });

      const importService = createPackImportService(prisma);
      const result = await importService.importPack(Number(synthetic.id));

      if (!isSuccess(result)) {
        const msg = isError(result) ? result.error.message : 'Pack import returned unexpected status';
        logger.warn(`[Jobs] Manual import failed for manga ${input.mangaId} (synthetic pack ${synthetic.id}): ${msg}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
      }

      await invalidateJobsAndActivity();
      logger.info(`[Jobs] Manual import succeeded for manga ${input.mangaId} → ${result.data.chaptersCreated} chapter(s) bound`);

      return {
        chaptersCreated: result.data.chaptersCreated,
        chapterIds: result.data.chapterIds,
        errors: result.data.errors,
        syntheticPackDownloadId: String(synthetic.id),
      };
    }),

  ignoreDownload: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }): Promise<{ success: boolean }> => {
      await assertJobAccess(ctx, BigInt(input.jobId));
      const service = TrackedDownloadService.getInstance();
      const trackingId = `job:${input.jobId}`;

      const result = service.transitionState(trackingId, TrackedDownloadEvent.IGNORED_BY_USER);
      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error ?? 'Cannot ignore download',
        });
      }

      const tracked = service.get(trackingId);
      if (tracked) {
        await syncToDatabase(prisma, tracked, result.previousState);
      }

      logger.info('[Jobs] Download ignored by user', { jobId: input.jobId, trackingId });
      return { success: true };
    }),
});
