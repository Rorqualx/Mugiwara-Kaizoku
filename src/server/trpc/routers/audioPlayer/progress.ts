/**
 * Audio Player Router - Progress Tracking Module
 *
 * Procedures:
 * - updateProgress: Update audio playback progress and analytics
 * - getProgress: Get progress for chapter
 * - getMangaProgress: Get all audio progress for manga
 * - getRecentlyPlayed: Get recently played audiobooks
 *
 * @module server/trpc/routers/audioPlayer/progress
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { getUserId, isNearComplete } from './utils';

import type { AudioPlaybackProgress, Prisma } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Progress with chapter and manga details
 */
type ProgressWithChapterAndManga = Prisma.AudioPlaybackProgressGetPayload<{
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
 * Recently played track data
 */
interface RecentlyPlayedTrackData {
  mangaId: number;
  mangaTitle: string;
  chapterId: number;
  chapterTitle: string;
  coverUrl: string | null;
  progressPercent: number;
  lastPlayedAt: Date;
  remainingTime: number;
}

// ============================================================================
// Router
// ============================================================================

export const audioPlayerProgressRouter = router({
  /**
   * Update audio playback progress and analytics
   *
   * Updates the current position for a chapter and increments daily analytics.
   * Automatically marks chapter as completed when near the end.
   */
  updateProgress: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
        currentTime: z.number().min(0),
        duration: z.number().min(0),
        playbackSpeed: z.number().min(0.5).max(3).optional(),
        volume: z.number().min(0).max(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<AudioPlaybackProgress> => {
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

      const isComplete = isNearComplete(input.currentTime, input.duration);

      const progress = await ctx.prisma.audioPlaybackProgress.upsert({
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
          currentTime: input.currentTime,
          duration: input.duration,
          playbackSpeed: input.playbackSpeed ?? 1.0,
          volume: input.volume ?? 1.0,
        },
        update: {
          currentTime: input.currentTime,
          duration: input.duration,
          lastPlayedAt: new Date(),
          completedAt: isComplete ? new Date() : null,
          ...(input.playbackSpeed !== undefined && { playbackSpeed: input.playbackSpeed }),
          ...(input.volume !== undefined && { volume: input.volume }),
        },
      });

      // Update listening analytics
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await ctx.prisma.listeningAnalytics.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        create: {
          userId,
          date: today,
          minutesListened: 1,
          chaptersCompleted: isComplete ? 1 : 0,
          audiobooksCompleted: 0,
        },
        update: {
          minutesListened: { increment: 1 },
          ...(isComplete && { chaptersCompleted: { increment: 1 } }),
        },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitReadingProgress({
        chapterId: input.chapterId,
        mangaId: input.mangaId,
        progress: input.duration > 0 ? Math.round((input.currentTime / input.duration) * 100) : 0
      });

      return progress;
    }),

  /**
   * Get progress for specific chapter
   *
   * Retrieves the audio playback progress record for a user's chapter.
   * Returns null if no progress has been recorded yet.
   */
  getProgress: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<AudioPlaybackProgress | null> => {
      const userId = getUserId(ctx);
      if (!userId) return null;

      return ctx.prisma.audioPlaybackProgress.findUnique({
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
   * Get all audio progress for a manga
   *
   * Retrieves all audio playback progress records for a manga, ordered by
   * most recently played. Includes chapter details for each record.
   */
  getMangaProgress: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<ProgressWithChapterAndManga[]> => {
      const userId = getUserId(ctx);
      if (!userId) return [];

      return ctx.prisma.audioPlaybackProgress.findMany({
        where: {
          userId,
          mangaId: input.mangaId,
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
          lastPlayedAt: 'desc',
        },
      });
    }),

  /**
   * Get recently played audiobooks
   *
   * Returns a list of recently played audio chapters for "Continue Listening"
   * feature. Excludes completed chapters.
   */
  getRecentlyPlayed: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      }).optional(),
    )
    .query(async ({ ctx, input }): Promise<RecentlyPlayedTrackData[]> => {
      const userId = getUserId(ctx);
      if (!userId) return [];

      const limit = input?.limit ?? 10;

      const progressRecords = await ctx.prisma.audioPlaybackProgress.findMany({
        where: {
          userId,
          completedAt: null, // Exclude completed chapters
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
          lastPlayedAt: 'desc',
        },
        take: limit,
      });

      return progressRecords.map((record) => ({
        mangaId: record.mangaId,
        mangaTitle: record.manga.title,
        chapterId: record.chapterId,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- chapterNumber may be null in DB
        chapterTitle: record.chapter.title ?? `Chapter ${record.chapter.chapterNumber ?? 0}`,
        coverUrl: record.manga.Metadata?.coverLarge ?? null,
        progressPercent: record.duration > 0
          ? Math.round((record.currentTime / record.duration) * 100)
          : 0,
        lastPlayedAt: record.lastPlayedAt,
        remainingTime: Math.max(0, record.duration - record.currentTime),
      }));
    }),

  /**
   * Mark chapter as completed
   *
   * Manually marks a chapter as completed.
   */
  markCompleted: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<AudioPlaybackProgress> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const progress = await ctx.prisma.audioPlaybackProgress.findUnique({
        where: {
          userId_mangaId_chapterId: {
            userId,
            mangaId: input.mangaId,
            chapterId: input.chapterId,
          },
        },
      });

      if (!progress) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Progress record not found',
        });
      }

      const updatedProgress = await ctx.prisma.audioPlaybackProgress.update({
        where: {
          userId_mangaId_chapterId: {
            userId,
            mangaId: input.mangaId,
            chapterId: input.chapterId,
          },
        },
        data: {
          currentTime: progress.duration,
          completedAt: new Date(),
        },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitReadingProgress({
        chapterId: input.chapterId,
        mangaId: input.mangaId,
        progress: 100
      });

      return updatedProgress;
    }),

  /**
   * Reset progress for a chapter
   *
   * Resets playback position to the beginning.
   */
  resetProgress: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<AudioPlaybackProgress> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const resetProgressResult = await ctx.prisma.audioPlaybackProgress.update({
        where: {
          userId_mangaId_chapterId: {
            userId,
            mangaId: input.mangaId,
            chapterId: input.chapterId,
          },
        },
        data: {
          currentTime: 0,
          completedAt: null,
        },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitReadingProgress({
        chapterId: input.chapterId,
        mangaId: input.mangaId,
        progress: 0
      });

      return resetProgressResult;
    }),
});
