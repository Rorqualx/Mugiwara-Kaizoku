/**
 * Reader Router - Progress Tracking Module
 *
 * Procedures:
 * - updateProgress: Update reading progress and analytics
 * - getProgress: Get progress for chapter
 * - getMangaProgress: Get all progress for manga
 *
 * Extracted from: reader.ts (lines 184-298)
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { getUserId } from './utils';

import type { Prisma, ReadingProgress } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Progress with chapter details
 */
type ProgressWithChapter = Prisma.ReadingProgressGetPayload<{
  include: { chapter: true };
}>;

// ============================================================================
// Router
// ============================================================================

export const readerProgressRouter = router({
  /**
   * Update reading progress and analytics
   *
   * Updates the current page for a chapter and increments daily analytics.
   * Automatically marks chapter as completed when reaching the last page.
   */
  updateProgress: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
        currentPage: z.number().min(1),
        totalPages: z.number().min(1),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ReadingProgress> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      // Verify chapter exists
      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.chapterId },
      });

      if (!chapter || chapter.mangaId !== input.mangaId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chapter not found',
        });
      }

      const progress = await ctx.prisma.readingProgress.upsert({
        where: {
          userId_mangaId_chapterId: {
            userId,
            mangaId: input.mangaId,
            chapterId: input.chapterId,
          },
        },
        create: {
          userId,
          mangaId: input.mangaId,
          chapterId: input.chapterId,
          currentPage: input.currentPage,
          totalPages: input.totalPages,
        },
        update: {
          currentPage: input.currentPage,
          lastReadAt: new Date(),
          completedAt:
            input.currentPage === input.totalPages ? new Date() : null,
        },
      });

      // Update analytics
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const updateData: {
        pagesRead: { increment: number };
        chaptersCompleted?: { increment: number };
      } = {
        pagesRead: { increment: 1 },
      };

      if (input.currentPage === input.totalPages) {
        updateData.chaptersCompleted = { increment: 1 };
      }

      await ctx.prisma.readingAnalytics.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        create: {
          userId,
          date: today,
          pagesRead: 1,
          chaptersCompleted: input.currentPage === input.totalPages ? 1 : 0,
        },
        update: updateData,
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitReadingProgress({
        chapterId: input.chapterId,
        mangaId: input.mangaId,
        progress: Math.round((input.currentPage / input.totalPages) * 100),
        pagesRead: input.currentPage,
        totalPages: input.totalPages
      });

      return progress;
    }),

  /**
   * Get progress for specific chapter
   *
   * Retrieves the reading progress record for a user's chapter.
   * Returns null if no progress has been recorded yet.
   */
  getProgress: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<ReadingProgress | null> => {
      const userId = getUserId(ctx);
      if (!userId) return null;

      return ctx.prisma.readingProgress.findUnique({
        where: {
          userId_mangaId_chapterId: {
            userId,
            mangaId: input.mangaId,
            chapterId: input.chapterId,
          },
        },
      });
    }),

  /**
   * Get all progress for a manga
   *
   * Retrieves all reading progress records for a manga, ordered by
   * most recently read. Includes chapter details for each record.
   */
  getMangaProgress: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<ProgressWithChapter[]> => {
      const userId = getUserId(ctx);
      if (!userId) return [];

      return ctx.prisma.readingProgress.findMany({
        where: {
          userId,
          mangaId: input.mangaId,
        },
        include: {
          chapter: true,
        },
        orderBy: {
          lastReadAt: 'desc',
        },
      });
    }),
});
