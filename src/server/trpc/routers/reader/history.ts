/**
 * Reader Router - History & Analytics Module
 *
 * Procedures:
 * - addHistory: Add reading history entry
 * - getHistory: Get reading history with pagination
 * - getAnalytics: Get reading analytics by date range
 *
 * Extracted from: reader.ts (lines 489-564)
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { EventType, EventSource, EventLevel } from '@/server/services/events/eventTypes';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { CHANNEL_PATTERNS } from '@/types/api/v1/websocket';
import { logSystemEvent } from '@/utils/system-event-logger';

import { getUserId } from './utils';

import type { ReadingHistory, ReadingAnalytics, Prisma } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Reading history with related manga and chapter data
 */
interface HistoryWithRelations extends ReadingHistory {
  manga: {
    id: number;
    title: string;
  };
  chapter: {
    id: number;
    chapterNumber: number | null;
    title: string | null;
  };
}

/**
 * Paginated history response
 */
interface PaginatedHistoryResponse {
  items: HistoryWithRelations[];
  total: number;
}

// ============================================================================
// Router Definition
// ============================================================================

export const readerHistoryRouter = router({
  /**
   * Add a reading history entry
   *
   * Records when a user reads a chapter, including pages read and time spent.
   *
   * @input mangaId - The manga ID
   * @input chapterId - The chapter ID
   * @input pagesRead - Number of pages read (minimum 0)
   * @input totalTime - Total reading time in seconds (minimum 0)
   * @returns The created reading history record
   * @throws UNAUTHORIZED - If user is not authenticated
   */
  addHistory: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
        pagesRead: z.number().min(0),
        totalTime: z.number().min(0), // in seconds
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ReadingHistory> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const history = await ctx.prisma.readingHistory.create({
        data: {
          userId,
          mangaId: input.mangaId,
          chapterId: input.chapterId,
          pagesRead: input.pagesRead,
          totalTime: input.totalTime,
          endedAt: new Date(),
        },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emit(
        CHANNEL_PATTERNS.READER_HISTORY,
        'history:created',
        { chapterId: input.chapterId, mangaId: input.mangaId }
      );

      // Persist a user-stamped audit event so reads appear in the per-user
      // actions log alongside logins/downloads/manga-adds. Fire-and-forget:
      // a logging hiccup must not fail the read.
      void logSystemEvent({
        type: EventType.CHAPTER_READ,
        source: EventSource.READER,
        level: EventLevel.INFO,
        message: `Read chapter (${input.pagesRead} pages, ${input.totalTime}s)`,
        relatedEntityId: String(input.mangaId),
        relatedEntityType: 'manga',
        userId,
        details: {
          mangaId: input.mangaId,
          chapterId: input.chapterId,
          pagesRead: input.pagesRead,
          totalTime: input.totalTime,
        },
      });

      return history;
    }),

  /**
   * Get reading history with pagination
   *
   * Retrieves the user's reading history ordered by most recent first.
   * Includes related manga and chapter information.
   *
   * @input limit - Maximum number of items to return (1-100, default 20)
   * @input offset - Number of items to skip for pagination (default 0)
   * @returns Paginated history with items and total count
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }): Promise<PaginatedHistoryResponse> => {
      const userId = getUserId(ctx);
      if (!userId) return { items: [], total: 0 };

      const [items, total] = await ctx.prisma.$transaction([
        ctx.prisma.readingHistory.findMany({
          where: { userId },
          include: {
            manga: true,
            chapter: true,
          },
          orderBy: { startedAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.readingHistory.count({
          where: { userId },
        }),
      ]);

      return { items, total };
    }),

  /**
   * Get reading analytics by date range
   *
   * Retrieves aggregated reading analytics for a user, optionally filtered
   * by start and end dates. Analytics are ordered by most recent date first.
   *
   * @input startDate - Optional start date filter (inclusive)
   * @input endDate - Optional end date filter (inclusive)
   * @returns Array of reading analytics records
   */
  getAnalytics: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }): Promise<ReadingAnalytics[]> => {
      const userId = getUserId(ctx);
      if (!userId) return [];

      const where: Prisma.ReadingAnalyticsWhereInput = {
        userId,
        ...(input.startDate || input.endDate ? {
          date: {
            ...(input.startDate && { gte: input.startDate }),
            ...(input.endDate && { lte: input.endDate }),
          }
        } : {})
      };

      return ctx.prisma.readingAnalytics.findMany({
        where,
        orderBy: { date: 'desc' },
      });
    }),
});
