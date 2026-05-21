/**
 * Audio Player Router - History & Analytics Module
 *
 * Procedures:
 * - recordSession: Record listening session
 * - getHistory: Get listening history
 * - getStats: Get listening statistics summary
 * - getDailyAnalytics: Get daily analytics for chart
 *
 * @module server/trpc/routers/audioPlayer/history
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { getUserId } from './utils';

import type { ListeningHistory, Prisma, PrismaClient } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Listening history with manga and chapter details
 */
type HistoryWithDetails = Prisma.ListeningHistoryGetPayload<{
  include: {
    chapter: true;
    manga: {
      include: {
        Metadata: true;
      };
    };
  };
}>;

/**
 * Listening statistics summary
 */
interface ListeningStatsSummary {
  totalMinutesAllTime: number;
  totalMinutesThisWeek: number;
  totalMinutesToday: number;
  totalChaptersCompleted: number;
  totalAudiobooksCompleted: number;
  currentStreak: number;
  longestStreak: number;
}

/**
 * Daily analytics data point
 */
interface DailyAnalyticsPoint {
  date: Date;
  minutesListened: number;
  chaptersCompleted: number;
}

// ============================================================================
// Router
// ============================================================================

export const audioPlayerHistoryRouter = router({
  /**
   * Record listening session
   *
   * Records a completed listening session for analytics tracking.
   */
  recordSession: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
        timeListened: z.number().min(0), // seconds
        startTime: z.number().min(0), // start position in seconds
        endTime: z.number().min(0), // end position in seconds
        playbackSpeed: z.number().min(0.5).max(3).default(1),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ListeningHistory> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const session = await ctx.prisma.listeningHistory.create({
        data: {
          userId,
          mangaId: input.mangaId,
          chapterId: input.chapterId,
          timeListened: input.timeListened,
          startTime: input.startTime,
          endTime: input.endTime,
          playbackSpeed: input.playbackSpeed,
          endedAt: new Date(),
        },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'audioPlayer:session:recorded',
        source: 'audioPlayer-history',
        message: `Listening session recorded for chapter ${input.chapterId}`,
        data: { sessionId: session.id, mangaId: input.mangaId, chapterId: input.chapterId, timeListened: input.timeListened }
      });

      return session;
    }),

  /**
   * Get listening history
   *
   * Retrieves listening history for the authenticated user.
   * Supports pagination and filtering by manga.
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        mangaId: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(), // for pagination
      }),
    )
    .query(async ({ ctx, input }): Promise<{
      items: HistoryWithDetails[];
      nextCursor: number | undefined;
    }> => {
      const userId = getUserId(ctx);
      if (!userId) {
        return { items: [], nextCursor: undefined };
      }

      const items = await ctx.prisma.listeningHistory.findMany({
        where: {
          userId,
          ...(input.mangaId !== undefined && { mangaId: input.mangaId }),
        },
        include: {
          chapter: true,
          manga: {
            include: {
              Metadata: true,
            },
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: input.limit + 1,
        ...(input.cursor !== undefined && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
      });

      let nextCursor: number | undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return { items, nextCursor };
    }),

  /**
   * Get listening statistics summary
   *
   * Returns aggregated listening statistics for the authenticated user.
   */
  getStats: protectedProcedure.query(
    async ({ ctx }): Promise<ListeningStatsSummary> => {
      const userId = getUserId(ctx);
      if (!userId) {
        return {
          totalMinutesAllTime: 0,
          totalMinutesThisWeek: 0,
          totalMinutesToday: 0,
          totalChaptersCompleted: 0,
          totalAudiobooksCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
        };
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get all-time stats
      const allTimeStats = await ctx.prisma.listeningHistory.aggregate({
        where: { userId },
        _sum: { timeListened: true },
      });

      // Get this week stats
      const weekStats = await ctx.prisma.listeningHistory.aggregate({
        where: {
          userId,
          startedAt: { gte: weekAgo },
        },
        _sum: { timeListened: true },
      });

      // Get today stats
      const todayStats = await ctx.prisma.listeningHistory.aggregate({
        where: {
          userId,
          startedAt: { gte: today },
        },
        _sum: { timeListened: true },
      });

      // Get chapters completed (from progress)
      const chaptersCompleted = await ctx.prisma.audioPlaybackProgress.count({
        where: {
          userId,
          completedAt: { not: null },
        },
      });

      // Count audiobooks with all chapters completed
      const mangasWithProgress = await ctx.prisma.audioPlaybackProgress.groupBy({
        by: ['mangaId'],
        where: { userId },
      });

      let audiobooksCompleted = 0;
      for (const { mangaId } of mangasWithProgress) {
        // eslint-disable-next-line no-await-in-loop -- Database queries must be sequential to calculate completion per manga
        const totalChapters = await ctx.prisma.chapter.count({
          where: { mangaId },
        });
        // eslint-disable-next-line no-await-in-loop -- Database queries must be sequential to calculate completion per manga
        const completedChapters = await ctx.prisma.audioPlaybackProgress.count({
          where: {
            userId,
            mangaId,
            completedAt: { not: null },
          },
        });
        if (totalChapters > 0 && completedChapters === totalChapters) {
          audiobooksCompleted++;
        }
      }

      // Calculate streaks
      const { currentStreak, longestStreak } = await calculateStreaks(ctx.prisma, userId);

      return {
        totalMinutesAllTime: Math.round((allTimeStats._sum.timeListened ?? 0) / 60),
        totalMinutesThisWeek: Math.round((weekStats._sum.timeListened ?? 0) / 60),
        totalMinutesToday: Math.round((todayStats._sum.timeListened ?? 0) / 60),
        totalChaptersCompleted: chaptersCompleted,
        totalAudiobooksCompleted: audiobooksCompleted,
        currentStreak,
        longestStreak,
      };
    }
  ),

  /**
   * Get daily analytics for chart
   *
   * Returns daily listening analytics for the specified date range.
   */
  getDailyAnalytics: protectedProcedure
    .input(
      z.object({
        days: z.number().min(7).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }): Promise<DailyAnalyticsPoint[]> => {
      const userId = getUserId(ctx);
      if (!userId) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);
      startDate.setHours(0, 0, 0, 0);

      const analytics = await ctx.prisma.listeningAnalytics.findMany({
        where: {
          userId,
          date: { gte: startDate },
        },
        orderBy: {
          date: 'asc',
        },
      });

      return analytics.map((a) => ({
        date: a.date,
        minutesListened: a.minutesListened,
        chaptersCompleted: a.chaptersCompleted,
      }));
    }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate listening streaks
 */
async function calculateStreaks(
  prisma: Prisma.TransactionClient | PrismaClient,
  userId: string
): Promise<{ currentStreak: number; longestStreak: number }> {
  const analytics = await prisma.listeningAnalytics.findMany({
    where: {
      userId,
      minutesListened: { gt: 0 },
    },
    orderBy: {
      date: 'desc',
    },
    select: {
      date: true,
    },
  });

  if (analytics.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if listened today or yesterday for current streak
  const firstDate = new Date(analytics[0]?.date ?? today);
  firstDate.setHours(0, 0, 0, 0);
  const daysSinceFirst = Math.floor(
    (today.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (daysSinceFirst <= 1) {
    currentStreak = 1;
    for (let i = 1; i < analytics.length; i++) {
      const currentDate = new Date(analytics[i]?.date ?? today);
      const prevDate = new Date(analytics[i - 1]?.date ?? today);
      currentDate.setHours(0, 0, 0, 0);
      prevDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (prevDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (daysDiff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  for (let i = 1; i < analytics.length; i++) {
    const currentDate = new Date(analytics[i]?.date ?? today);
    const prevDate = new Date(analytics[i - 1]?.date ?? today);
    currentDate.setHours(0, 0, 0, 0);
    prevDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (prevDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysDiff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return { currentStreak, longestStreak };
}
