/**
 * Volume Router - Progress Tracking
 *
 * Procedures:
 * - updateProgress: Update volume reading progress
 * - getProgress: Get progress for a specific volume
 * - getMangaVolumeProgress: Get all volume progress for a manga
 * - syncFromChapters: Compute and sync progress from chapter progress
 *
 * @module server/trpc/routers/volume/progress
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { progressUpdateSchema, getUserId } from './utils';

import type { VolumeProgress, Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

type ProgressWithVolume = Prisma.VolumeProgressGetPayload<{
  include: {
    volume: true;
  };
}>;

interface MangaVolumeProgressSummary {
  volumeId: number;
  volumeNumber: number;
  title: string | null;
  coverImage: string | null;
  totalChapters: number;
  chaptersRead: number;
  percentComplete: number;
  isComplete: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
  lastReadAt: Date;
}

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
}

interface VolumeWithChapters {
  id: number;
  chapters: { id: number }[];
}

interface SyncUpdateOp {
  id: number;
  chaptersRead: number;
  totalChapters: number;
  percentComplete: number;
  completedAt: Date | null;
  lastReadAt: Date;
}

interface SyncCreateOp {
  userId: string;
  mangaId: number;
  volumeId: number;
  chaptersRead: number;
  totalChapters: number;
  percentComplete: number;
  startedAt: Date;
  completedAt: Date | null;
  lastReadAt: Date;
}

interface SyncOperations {
  updates: SyncUpdateOp[];
  creates: SyncCreateOp[];
  syncedCount: number;
}

/**
 * Prepare sync operations for volume progress
 *
 * Calculates which volumes need to be created or updated based on chapter progress.
 */
function prepareSyncOperations(
  volumes: VolumeWithChapters[],
  completedChapterIds: Set<number>,
  existingProgressMap: Map<number, number>,
  userId: string,
  mangaId: number
): SyncOperations {
  const updates: SyncUpdateOp[] = [];
  const creates: SyncCreateOp[] = [];
  let syncedCount = 0;

  for (const volume of volumes) {
    const chapterIds = volume.chapters.map((c) => c.id);
    if (chapterIds.length === 0) continue;

    const readChapterCount = chapterIds.filter((id) => completedChapterIds.has(id)).length;
    const totalChapters = chapterIds.length;
    const percentComplete = (readChapterCount / totalChapters) * 100;
    const isComplete = percentComplete >= 100;
    const now = new Date();

    const existingId = existingProgressMap.get(volume.id);

    if (existingId !== undefined) {
      updates.push({
        id: existingId,
        chaptersRead: readChapterCount,
        totalChapters,
        percentComplete,
        completedAt: isComplete ? now : null,
        lastReadAt: now,
      });
    } else if (readChapterCount > 0) {
      creates.push({
        userId,
        mangaId,
        volumeId: volume.id,
        chaptersRead: readChapterCount,
        totalChapters,
        percentComplete,
        startedAt: now,
        completedAt: isComplete ? now : null,
        lastReadAt: now,
      });
    }

    syncedCount++;
  }

  return { updates, creates, syncedCount };
}

// ============================================================================
// Router
// ============================================================================

export const volumeProgressRouter = router({
  /**
   * Update volume reading progress
   *
   * Updates or creates a progress record for a volume.
   */
  updateProgress: protectedProcedure
    .input(progressUpdateSchema)
    .mutation(async ({ ctx, input }): Promise<VolumeProgress> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      // Get volume to validate it exists and get mangaId
      const volume = await ctx.prisma.volume.findUnique({
        where: { id: input.volumeId },
        select: { id: true, mangaId: true, totalChapters: true },
      });

      if (!volume) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Volume with ID ${input.volumeId} not found`,
        });
      }

      const chaptersRead = input.chaptersRead ?? 0;
      const totalChapters = input.totalChapters;
      const percentComplete = input.percentComplete ?? (chaptersRead / totalChapters) * 100;
      const isComplete = percentComplete >= 100;

      const progress = await ctx.prisma.volumeProgress.upsert({
        where: {
          userId_mangaId_volumeId: {
            userId,
            mangaId: volume.mangaId,
            volumeId: input.volumeId,
          },
        },
        create: {
          userId,
          mangaId: volume.mangaId,
          volumeId: input.volumeId,
          chaptersRead,
          totalChapters,
          percentComplete,
          startedAt: input.startedAt ?? new Date(),
          completedAt: isComplete ? (input.completedAt ?? new Date()) : null,
          lastReadAt: new Date(),
        },
        update: {
          chaptersRead,
          totalChapters,
          percentComplete,
          ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
          completedAt: isComplete ? (input.completedAt ?? new Date()) : null,
          lastReadAt: new Date(),
        },
      });

      // Emit WebSocket event for volume progress update
      void realtimeEmitter.emitSystemEvent({
        eventType: 'reading:progress:updated',
        source: 'volumeProgressRouter',
        message: `Volume progress updated: ${percentComplete.toFixed(0)}%`,
        data: {
          volumeId: input.volumeId,
          mangaId: volume.mangaId,
          percentComplete,
          chaptersRead,
          totalChapters,
          isComplete
        }
      });

      return progress;
    }),

  /**
   * Get progress for a specific volume
   *
   * Returns the progress record for the authenticated user on a specific volume.
   */
  getProgress: protectedProcedure
    .input(z.object({ volumeId: z.number().int().positive() }))
    .query(async ({ ctx, input }): Promise<ProgressWithVolume | null> => {
      const userId = getUserId(ctx);
      if (!userId) return null;

      return ctx.prisma.volumeProgress.findFirst({
        where: {
          userId,
          volumeId: input.volumeId,
        },
        include: {
          volume: true,
        },
      });
    }),

  /**
   * Get all volume progress for a manga
   *
   * Returns progress summaries for all volumes of a manga for the
   * authenticated user.
   */
  getMangaVolumeProgress: protectedProcedure
    .input(z.object({ mangaId: z.number().int().positive() }))
    .query(async ({ ctx, input }): Promise<MangaVolumeProgressSummary[]> => {
      const userId = getUserId(ctx);
      if (!userId) return [];

      // Get all volumes for the manga with progress
      const volumes = await ctx.prisma.volume.findMany({
        where: { mangaId: input.mangaId },
        orderBy: { number: 'asc' },
        include: {
          progress: {
            where: { userId },
          },
        },
      });

      return volumes.map((volume) => {
        const progress = volume.progress[0];
        const totalChapters = volume.totalChapters ?? 0;
        const chaptersRead = progress?.chaptersRead ?? 0;
        const percentComplete = progress?.percentComplete ?? 0;

        return {
          volumeId: volume.id,
          volumeNumber: volume.number,
          title: volume.title,
          coverImage: volume.coverImage,
          totalChapters,
          chaptersRead,
          percentComplete,
          isComplete: percentComplete >= 100,
          startedAt: progress?.startedAt ?? null,
          completedAt: progress?.completedAt ?? null,
          lastReadAt: progress?.lastReadAt ?? new Date(0),
        };
      });
    }),

  /**
   * Sync progress from chapter progress
   *
   * Computes volume progress from existing chapter progress entries.
   * Creates or updates VolumeProgress records based on which chapters
   * in each volume have been read.
   */
  syncFromChapters: protectedProcedure
    .input(z.object({ mangaId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }): Promise<SyncResult> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      // Fetch all required data in parallel
      const [volumes, readingProgress, existingProgressList] = await Promise.all([
        ctx.prisma.volume.findMany({
          where: { mangaId: input.mangaId },
          include: { chapters: { select: { id: true } } },
        }),
        ctx.prisma.readingProgress.findMany({
          where: { userId, mangaId: input.mangaId, completedAt: { not: null } },
          select: { chapterId: true },
        }),
        ctx.prisma.volumeProgress.findMany({
          where: { userId, mangaId: input.mangaId },
          select: { id: true, volumeId: true },
        }),
      ]);

      const completedChapterIds = new Set(readingProgress.map((p) => p.chapterId));
      const existingProgressMap = new Map(existingProgressList.map((p) => [p.volumeId, p.id]));

      // Calculate which operations need to be performed
      const { updates, creates, syncedCount } = prepareSyncOperations(
        volumes,
        completedChapterIds,
        existingProgressMap,
        userId,
        input.mangaId
      );

      // Execute all database operations in parallel
      await Promise.all([
        ...updates.map((op) =>
          ctx.prisma.volumeProgress.update({
            where: { id: op.id },
            data: {
              chaptersRead: op.chaptersRead,
              totalChapters: op.totalChapters,
              percentComplete: op.percentComplete,
              completedAt: op.completedAt,
              lastReadAt: op.lastReadAt,
            },
          })
        ),
        ...creates.map((data) => ctx.prisma.volumeProgress.create({ data })),
      ]);

      const result = { synced: syncedCount, created: creates.length, updated: updates.length };

      // Emit WebSocket event for volume progress sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'reading:progress:synced',
        source: 'volumeProgressRouter',
        message: `Volume progress synced: ${creates.length} created, ${updates.length} updated`,
        data: {
          mangaId: input.mangaId,
          ...result
        }
      });

      return result;
    }),

  /**
   * Mark volume as complete
   *
   * Marks a volume as 100% complete.
   */
  markComplete: protectedProcedure
    .input(z.object({ volumeId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }): Promise<VolumeProgress> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const volume = await ctx.prisma.volume.findUnique({
        where: { id: input.volumeId },
        select: { id: true, mangaId: true, totalChapters: true },
      });

      if (!volume) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Volume with ID ${input.volumeId} not found`,
        });
      }

      const totalChapters = volume.totalChapters ?? 1;

      const progress = await ctx.prisma.volumeProgress.upsert({
        where: {
          userId_mangaId_volumeId: {
            userId,
            mangaId: volume.mangaId,
            volumeId: input.volumeId,
          },
        },
        create: {
          userId,
          mangaId: volume.mangaId,
          volumeId: input.volumeId,
          chaptersRead: totalChapters,
          totalChapters,
          percentComplete: 100,
          startedAt: new Date(),
          completedAt: new Date(),
          lastReadAt: new Date(),
        },
        update: {
          chaptersRead: totalChapters,
          percentComplete: 100,
          completedAt: new Date(),
          lastReadAt: new Date(),
        },
      });

      // Emit WebSocket event for volume marked complete
      void realtimeEmitter.emitSystemEvent({
        eventType: 'reading:progress:completed',
        source: 'volumeProgressRouter',
        message: `Volume ${input.volumeId} marked as complete`,
        data: {
          volumeId: input.volumeId,
          mangaId: volume.mangaId,
          percentComplete: 100,
          isComplete: true
        }
      });

      return progress;
    }),
});
