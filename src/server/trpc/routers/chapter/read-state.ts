/**
 * Chapter Router - Read State
 *
 * Read state belongs to the calling user (ChapterReadState), never to the
 * shared Chapter row: marking a title read or unread here changes nothing for
 * other users who have the same title.
 *
 * Procedures:
 * - markAllAsRead: mark every chapter of one title read for the caller
 * - markAllAsUnread: mark every chapter of one title unread for the caller
 * - markMangaChapters: the same for several titles at once
 *
 * @module server/trpc/routers/chapter/read-state
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { markMangaRead, markMangaUnread } from '@/server/services/reader/chapter-read-state';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { assertMembership, filterMangaIdsToLibrary, requireUserId } from '@/server/trpc/routers/_shared/library-access';
import { router } from '@/server/trpc/trpc';
import { isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

/** Most titles one bulk call may touch (the library page selects at most a page of them). */
const MAX_BULK_TITLES = 500;

/**
 * Applies a read/unread mark to whole titles for one user and tells that
 * user's open pages to refresh.
 *
 * @returns how many chapters changed state for this user
 */
async function setReadStateForTitles(
  prisma: PrismaClient,
  userId: string,
  mangaIds: readonly number[],
  isRead: boolean,
): Promise<number> {
  const result = isRead
    ? await markMangaRead(prisma, userId, mangaIds)
    : await markMangaUnread(prisma, userId, mangaIds);
  if (!isSuccess(result)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Could not mark chapters as ${isRead ? 'read' : 'unread'}`,
      cause: isError(result) ? result.error : undefined,
    });
  }

  for (const mangaId of mangaIds) {
    void realtimeEmitter.emitChapterUpdate({
      chapterId: 0,
      mangaId,
      action: isRead ? 'read' : 'unread',
      data: { count: result.data },
    });
  }
  return result.data;
}

export const chapterReadStateRouter = router({
  /**
   * Mark all chapters of a manga as read for the calling user
   */
  markAllAsRead: protectedProcedure
    .input(z.object({ mangaId: z.number() }))
    .mutation(async ({ ctx, input }): Promise<{ updatedCount: number; message: string }> => {
      const userId = requireUserId(ctx);
      await assertMembership(ctx.prisma, userId, input.mangaId);

      const count = await setReadStateForTitles(ctx.prisma, userId, [input.mangaId], true);
      logger.info(`Marked ${count} chapters as read for manga ${input.mangaId}`, { userId });

      return { updatedCount: count, message: `Marked ${count} chapters as read` };
    }),

  /**
   * Mark all chapters of a manga as unread for the calling user
   */
  markAllAsUnread: protectedProcedure
    .input(z.object({ mangaId: z.number() }))
    .mutation(async ({ ctx, input }): Promise<{ updatedCount: number; message: string }> => {
      const userId = requireUserId(ctx);
      await assertMembership(ctx.prisma, userId, input.mangaId);

      const count = await setReadStateForTitles(ctx.prisma, userId, [input.mangaId], false);
      logger.info(`Marked ${count} chapters as unread for manga ${input.mangaId}`, { userId });

      return { updatedCount: count, message: `Marked ${count} chapters as unread` };
    }),

  /**
   * Mark all chapters of several titles read or unread for the calling user.
   * Titles that are not in the caller's library are skipped, not rejected, so
   * a stale selection cannot fail the whole action.
   */
  markMangaChapters: protectedProcedure
    .input(z.object({
      mangaIds: z.array(z.number()).min(1).max(MAX_BULK_TITLES),
      isRead: z.boolean(),
    }))
    .mutation(async ({ ctx, input }): Promise<{ success: boolean; count: number; mangaCount: number; message: string }> => {
      const userId = requireUserId(ctx);
      const mangaIds = await filterMangaIdsToLibrary(ctx.prisma, userId, input.mangaIds);

      const count = await setReadStateForTitles(ctx.prisma, userId, mangaIds, input.isRead);
      const state = input.isRead ? 'read' : 'unread';
      logger.info(`Marked ${count} chapters as ${state} across ${mangaIds.length} manga`, { userId });

      return {
        success: true,
        count,
        mangaCount: mangaIds.length,
        message: `Marked ${count} chapters as ${state}`,
      };
    }),
});
