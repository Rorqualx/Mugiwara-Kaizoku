/**
 * Chapter operations for manga
 *
 * This module provides procedures for managing chapters, including fetching,
 * checking for new chapters, and handling out-of-sync chapters.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { schedule as scheduleChapterCheck } from '@/server/queue/checkChapters';
import { checkOutOfSyncChapters as checkOutOfSyncChaptersJob } from '@/server/queue/checkOutOfSyncChapters';
import { enqueueFixOutOfSyncChaptersTask } from '@/server/queue/fixOutOfSyncChapters';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createSuccessResult } from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { logInfo, EventType, EventSource } from '@/utils/system-event-logger';


import { idSchema, mangaIdSchema } from './helpers';

// ============================================================================
// Chapter Retrieval
// ============================================================================

/**
 * Get all chapters for a manga
 */
const getAllChapters = publicProcedure
  .input(idSchema)
  .query(async ({ input, ctx }) => {
    try {
      const chapters = await ctx.prisma.chapter.findMany({
        where: {
          mangaId: input.id
        },
        orderBy: {
          index: 'asc'
        }
      });

      logger.debug(`Fetched ${chapters.length} chapters for manga ID ${input.id}`);
      return chapters;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error fetching chapters for manga ${input.id}: ${errorMessage}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch chapters'
      });
    }
  });

// ============================================================================
// Chapter Checking & Sync
// ============================================================================

/**
 * Check for new chapters
 *
 * Schedules a background task to check for new chapters from the manga source
 */
const checkForNewChapters = protectedProcedure
  .input(z.object({
    id: z.number()
  }))
  .mutation(async ({ input }) => {
    const { id } = input;

    try {
      // Get manga with necessary relations
      const manga = await prisma.manga.findUnique({
        where: { id },
        include: {
          Library: true,
          Metadata: true,
          Chapter: true
        }
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found'
        });
      }

      // Schedule chapter check (force=true bypasses interval checks)
      await scheduleChapterCheck(manga, true);

      logger.info(`[checkForNewChapters] Scheduled chapter check for manga: ${manga.title}`);

      await logInfo(
        `Scheduled chapter check for ${manga.title}`,
        EventType.TASK_STARTED,
        EventSource.SYSTEM,
        {
          relatedEntityId: toStringId(id),
          relatedEntityType: 'manga',
          details: {
            mangaTitle: manga.title,
            forced: true
          }
        }
      );

      return createSuccessResult({
        message: `Chapter check scheduled for ${manga.title}`
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[checkForNewChapters] Failed to schedule chapter check for manga ID ${id}: ${errorMessage}`);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to schedule chapter check: ${errorMessage}`
      });
    }
  });

/**
 * Check for out-of-sync chapters
 *
 * Identifies chapters that are out of sync with the filesystem
 */
const checkOutOfSyncChapters = protectedProcedure
  .input(mangaIdSchema)
  .mutation(async ({ input, ctx }) => {
    const { mangaId } = input;
    logger.info(`Checking for out of sync chapters for manga ID ${mangaId}`);

    const manga = await ctx.prisma.manga.findUnique({
      where: {
        id: mangaId
      },
      include: {
        Chapter: true,
      }
    });

    if (!manga) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Manga not found.'
      });
    }

    try {
      // Check for out of sync chapters
      await checkOutOfSyncChaptersJob(mangaId);

      const _updatedManga = await ctx.prisma.manga.findUnique({
        where: {
          id: mangaId
        },
        include: {
          Metadata: true,
          Library: true,
          Chapter: true
        }
      });

      const outOfSyncCount = 0; // OutOfSyncChapter model removed

      logger.info(`Successfully checked for out of sync chapters for manga ID ${mangaId}, found ${outOfSyncCount}`);

      return {
        success: true,
        message: `Found ${outOfSyncCount} out of sync chapters for ${manga.title}`,
        outOfSyncCount: outOfSyncCount
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error checking for out of sync chapters for manga ID ${mangaId}: ${errorMessage}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to check for out of sync chapters: ${errorMessage}`
      });
    }
  });

/**
 * Fix out-of-sync chapters
 *
 * Attempts to fix chapters that are out of sync with the filesystem
 */
const fixOutOfSyncChapters = protectedProcedure
  .input(idSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;
    logger.info(`Fixing out of sync chapters for manga ID ${id}`);

    const manga = await ctx.prisma.manga.findUnique({
      where: {
        id
      },
      include: {
      }
    });

    if (!manga) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Manga not found.'
      });
    }

    // Out-of-sync is now tracked via Job system - always proceed with fix attempt
    // Check if there are any pending FIX_OUT_OF_SYNC jobs for this manga
    try {
      // Enqueue the task to fix out of sync chapters
      await enqueueFixOutOfSyncChaptersTask(id);

      logger.info(`Successfully enqueued fix out of sync chapters task for manga ID ${id}`);

      return {
        success: true,
        message: `Started fixing out of sync chapters for ${manga.title}`
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error fixing out of sync chapters for manga ID ${id}: ${errorMessage}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fix out of sync chapters: ${errorMessage}`
      });
    }
  });

// ============================================================================
// Router Export
// ============================================================================

export const chapterRouter = router({
  getAllChapters,
  checkForNewChapters,
  checkOutOfSyncChapters,
  fixOutOfSyncChapters
});
