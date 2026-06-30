/**
 * Users Activity Router
 *
 * Admin-only, per-user activity surface for the user-management dashboard.
 * Reuses the existing user-stamped `SystemEvent` audit log and the dedicated
 * reading/download tables rather than introducing new tracking.
 *
 * Procedures (exposed as `users.activity.*`):
 * - getActivitySummary: aggregate counts/sums + derived time-logged-in
 * - getActivityLog: paginated, filterable per-user event timeline
 *
 * @module server/trpc/routers/users/activity
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { eventService } from '@/server/services/events/eventService';
import type { EventFilters, PaginatedEvents } from '@/server/services/events/eventService';
import { EventType } from '@/server/services/events/eventTypes';
import { adminProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { deriveSessionDuration } from './activity/session-duration';

/**
 * Aggregate activity summary for a single user, powering the drawer stat cards.
 */
export interface UserActivitySummary {
  userId: string;
  createdAt: Date;
  lastLogin: Date | null;
  loginCount: number;
  timeLoggedInSeconds: number;
  sessionCount: number;
  lastSessionSeconds: number | null;
  mangaAddedCount: number;
  downloadsCount: number;
  chaptersRead: number;
  pagesRead: number;
  readingTimeSeconds: number;
}

const userIdInput = z.object({ userId: z.string() });

const activityLogInput = z.object({
  userId: z.string(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
  types: z.array(z.string()).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  search: z.string().optional(),
});

export const usersActivityRouter = router({
  /**
   * Aggregate activity counts/sums for a single user.
   * Requires admin role.
   */
  getActivitySummary: adminProcedure
    .input(userIdInput)
    .query(async ({ input }): Promise<UserActivitySummary> => {
      const { userId } = input;

      const [
        user,
        loginCount,
        sessionEvents,
        mangaAddedCount,
        downloadsCount,
        readingAgg,
        readingTimeAgg,
      ] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, createdAt: true, lastLogin: true },
        }),
        prisma.systemEvent.count({
          where: { userId, type: EventType.USER_LOGGED_IN },
        }),
        prisma.systemEvent.findMany({
          where: {
            userId,
            type: { in: [EventType.USER_LOGGED_IN, EventType.USER_LOGGED_OUT] },
          },
          select: { type: true, timestamp: true },
          orderBy: { timestamp: 'asc' },
        }),
        prisma.systemEvent.count({
          where: { userId, type: EventType.MANGA_ADDED },
        }),
        prisma.downloadHistory.count({
          where: { initiatedByUserId: userId },
        }),
        prisma.readingAnalytics.aggregate({
          where: { userId },
          _sum: { pagesRead: true, chaptersCompleted: true },
        }),
        prisma.readingHistory.aggregate({
          where: { userId },
          _sum: { totalTime: true },
        }),
      ]);

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const session = deriveSessionDuration(sessionEvents);

      return {
        userId,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        loginCount,
        timeLoggedInSeconds: session.totalSeconds,
        sessionCount: session.sessionCount,
        lastSessionSeconds: session.lastSessionSeconds,
        mangaAddedCount,
        downloadsCount,
        chaptersRead: readingAgg._sum.chaptersCompleted ?? 0,
        pagesRead: readingAgg._sum.pagesRead ?? 0,
        readingTimeSeconds: readingTimeAgg._sum.totalTime ?? 0,
      };
    }),

  /**
   * Paginated, filterable per-user event timeline.
   * Thin wrapper over `eventService.getEvents`, owner-scoped to the target user.
   * Requires admin role.
   */
  getActivityLog: adminProcedure
    .input(activityLogInput)
    .query(async ({ input }): Promise<PaginatedEvents> => {
      const filters: EventFilters = {};

      if (input.types?.length) {
        filters.types = input.types.filter((type) =>
          Object.values(EventType).includes(type as EventType),
        ) as EventType[];
      }
      if (input.startDate !== undefined) filters.startDate = input.startDate;
      if (input.endDate !== undefined) filters.endDate = input.endDate;
      if (input.search !== undefined) filters.search = input.search;

      return eventService.getEvents(filters, input.page, input.pageSize, input.userId);
    }),
});
