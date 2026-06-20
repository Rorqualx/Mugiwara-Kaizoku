
import { JobStatus as PrismaJobStatus, ConversionStatus, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { queryCache } from '@/server/utils/query-optimizer';


import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

import { getUserLibraryMangaIds, isAdmin, requireUserId } from './_shared/library-access';

/**
 * Activity router for handling activity-related API endpoints
 * 
 * This router provides endpoints for retrieving activity statistics
 * such as active, queued, scheduled, failed, and completed tasks,
 * as well as out-of-sync chapters.
 */
export const activityRouter = router({
  /**
   * Query procedure to get activity statistics (OPTIMIZED VERSION)
   * 
   * Uses efficient groupBy queries to avoid COUNT(*) with OFFSET issues.
   * Implements caching to reduce database load.
   * 
   * @returns {Object} Object containing counts for different activity categories
   */
  query: protectedProcedure.
  query(async ({ ctx }) => {
    // Owner-scope so the nav badges reflect the caller's own activity, not the
    // whole instance. Admins see everything. The cache key is per-user — a
    // shared key would leak one user's counts to another.
    const admin = isAdmin(ctx);
    const userId = admin ? null : requireUserId(ctx);
    const cacheKey = `activity-counts:${admin ? 'admin' : userId}`;
    const cached = queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Jobs are scoped by initiator; conversions (no owner column) by library
    // membership via mangaId.
    const jobsWhere: Prisma.jobsWhereInput = admin ? {} : { initiated_by_user_id: userId };
    const conversionMangaWhere: Prisma.ConversionJobWhereInput = admin
      ? {}
      : { mangaId: { in: userId !== null ? await getUserLibraryMangaIds(prisma, userId) : [] } };

    // Use groupBy for efficient counting of job statuses
    const jobStatusGroups = await prisma.jobs.groupBy({
      by: ['status'],
      where: jobsWhere,
      _count: { _all: true }
    });

    // Also get scheduled vs non-scheduled PENDING jobs and conversion jobs count
    const now = new Date();
    const [pendingTotal, pendingScheduled, conversionsCount] = await Promise.all([
    prisma.jobs.count({
      where: { ...jobsWhere, status: PrismaJobStatus.pending }
    }),
    prisma.jobs.count({
      where: {
        ...jobsWhere,
        status: PrismaJobStatus.pending,
        scheduled_for: { gt: now } // Jobs scheduled for future
      }
    }),
    prisma.conversionJob.count({
      where: {
        ...conversionMangaWhere,
        status: { in: [ConversionStatus.PENDING, ConversionStatus.PROCESSING] }
      }
    })]
    );

    // Process grouped results
    const counts = {
      active: 0,
      queued: 0,
      scheduled: 0,
      failed: 0,
      completed: 0,
      outOfSync: 0,
      conversions: conversionsCount
    };

    // Map status groups to counts
    for (const group of jobStatusGroups) {
      const count = group._count._all;

      switch (group["status"]) {
        case PrismaJobStatus.active:
          counts.active = count;
          break;
        case PrismaJobStatus.pending:
          counts.queued = pendingTotal - pendingScheduled;
          counts.scheduled = pendingScheduled;
          break;
        case PrismaJobStatus.failed:
          counts.failed = count;
          break;
        case PrismaJobStatus.completed:
          counts.completed = count;
          break;
        default:
          // No action needed for other statuses
          break;
      }
    }

    // Cache the results for 5 seconds
    queryCache.set(cacheKey, counts, 5000);

    return counts;
  })
});