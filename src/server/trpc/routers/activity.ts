
import { JobStatus as PrismaJobStatus, ConversionStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { queryCache } from '@/server/utils/query-optimizer';


import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

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
  query(async () => {
    // Check cache first
    const cacheKey = 'activity-counts';
    const cached = queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Use groupBy for efficient counting of job statuses
    const jobStatusGroups = await prisma.jobs.groupBy({
      by: ['status'],
      _count: { _all: true }
    });

    // Also get scheduled vs non-scheduled PENDING jobs and conversion jobs count
    const now = new Date();
    const [pendingTotal, pendingScheduled, conversionsCount] = await Promise.all([
    prisma.jobs.count({
      where: { status: PrismaJobStatus.pending }
    }),
    prisma.jobs.count({
      where: {
        status: PrismaJobStatus.pending,
        scheduled_for: { gt: now } // Jobs scheduled for future
      }
    }),
    prisma.conversionJob.count({
      where: {
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