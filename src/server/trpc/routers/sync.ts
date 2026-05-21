import { z } from 'zod';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logging';

import { publicProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Sync Router - Manages synchronization status between local and external systems
 *
 * This router provides endpoints for tracking and resolving discrepancies between
 * the local database and external systems like metadata providers or download sources.
 */
export const syncRouter = router({
  /**
   * Retrieves information about chapters that are out of sync
   *
   * This endpoint queries the database for chapters that have been marked as out of sync
   * with external systems. It groups the results by manga to provide a hierarchical view
   * of which manga have synchronization issues and what specific chapters are affected.
   *
   * @returns {Array<Object>} Array of manga with out-of-sync chapters
   * @returns {number} .mangaId - The ID of the manga with sync issues
   * @returns {number} .outOfSyncCount - The number of chapters with sync issues for this manga
   * @returns {Array<Object>} .chapters - Details about each out-of-sync chapter
   */
  getOutOfSync: publicProcedure.query(async () => {
    try {
      // Since OutOfSyncChapter model was removed, we'll look for FIX_OUT_OF_SYNC jobs
      const outOfSyncJobs = await prisma.$queryRaw<Array<{
        id: bigint;
        manga_id: bigint;
        payload: unknown;
        status: string;
        created_at: Date;
      }>>`
        SELECT id, manga_id, payload, status, created_at
        FROM jobs
        WHERE job_type = 'fix_out_of_sync'::"JobType"
          AND status IN ('pending'::"JobStatus", 'active'::"JobStatus")
        ORDER BY created_at DESC
        LIMIT 100
      `;

      // Group by manga ID
      const mangaGroups: Record<string, typeof outOfSyncJobs> = {};
      for (const job of outOfSyncJobs) {
        const key = job.manga_id.toString();
        const group = mangaGroups[key] ?? [];
        group.push(job);
        mangaGroups[key] = group;
      }

      // Format the response
      return Object.entries(mangaGroups).map(([mangaId, jobs]) => {
        const outOfSyncChapters = jobs.flatMap(job => {
          const payload = job.payload as { outOfSyncChapters?: string[] } | null | undefined;
          return payload?.outOfSyncChapters ?? [];
        });

        const firstJob = jobs[0];
        const firstPayload = firstJob?.payload as { reason?: string } | null | undefined;

        return {
          mangaId: Number(mangaId),
          outOfSyncCount: outOfSyncChapters.length,
          chapters: outOfSyncChapters.map((fileName: string, index: number) => ({
            id: index,
            fileName,
            reason: firstPayload?.reason ?? 'Out of sync with source',
            status: firstJob?.status ?? 'pending'
          }))
        };
      });
    }
    catch (error: unknown) {
      logger.error(`Failed to get out-of-sync status: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }),
  /**
   * Get the status of a specific sync task
   *
   * This endpoint retrieves the current status and progress of a sync task.
   * Used for polling task progress in the UI.
   *
   * @param {string} taskId - The ID of the sync task
   * @returns {Object} Task status information
   */
  getTaskStatus: publicProcedure.input(z.object({
    taskId: z.string()
  })).query(async ({ input }) => {
    try {
      // Try to parse taskId as a number for database lookup
      const taskIdNum = parseInt(input.taskId, 10);
      if (isNaN(taskIdNum)) {
        // If not a valid number, return a completed status
        return {
          id: input.taskId,
          progress: 100,
          status: 'COMPLETED',
          error: null
        };
      }
      // Query the job from the database
      const job = await prisma.$queryRaw<Array<{
        id: bigint;
        status: string;
        error_message: string | null;
        created_at: Date;
        updated_at: Date;
      }>>`
        SELECT id, status, error_message, created_at, updated_at
        FROM jobs
        WHERE id = ${BigInt(taskIdNum)}
        LIMIT 1
      `;

      if (job.length === 0) {
        // Job not found, return completed status
        return {
          id: input.taskId,
          progress: 100,
          status: 'COMPLETED',
          error: null
        };
      }

      const jobData = job[0];
      if (!jobData) {
        // Should not happen, but handle it safely
        return {
          id: input.taskId,
          progress: 100,
          status: 'COMPLETED',
          error: null
        };
      }

      // Map job status to sync status format
      const statusMap: Record<string, string> = {
        'pending': 'PENDING',
        'active': 'PROCESSING',
        'completed': 'COMPLETED',
        'failed': 'FAILED',
        'cancelled': 'CANCELLED'
      };

      const progress = jobData.status === 'completed' ? 100 :
                      jobData.status === 'active' ? 50 :
                      jobData.status === 'failed' ? 100 : 0;

      return {
        id: input.taskId,
        progress,
        status: statusMap[jobData.status] ?? 'PENDING',
        error: jobData.error_message
      };
    }
    catch (error: unknown) {
      logger.error(`Failed to get task status for ${input.taskId}: ${error instanceof Error ? error.message : String(error)}`);
      // Return a safe default instead of throwing
      return {
        id: input.taskId,
        progress: 0,
        status: 'FAILED',
        error: 'Failed to retrieve task status'
      };
    }
  })
});