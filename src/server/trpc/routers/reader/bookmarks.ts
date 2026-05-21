/**
 * Reader Router - Bookmarks Module
 *
 * Procedures:
 * - addBookmark: Add bookmark to chapter page
 * - removeBookmark: Delete bookmark
 * - getBookmarks: Get all bookmarks for manga
 *
 * Extracted from: reader.ts (lines 300-384)
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { getUserId } from './utils';

import type { ReaderBookmark, Prisma } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extended ReaderBookmark with chapter relation
 */
type BookmarkWithChapter = Prisma.ReaderBookmarkGetPayload<{
  include: { chapter: true };
}>;

// ============================================================================
// Router
// ============================================================================

export const readerBookmarksRouter = router({
  /**
   * Add bookmark to chapter page
   *
   * Creates a new bookmark for a specific page in a chapter.
   * Requires authentication.
   */
  addBookmark: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
        pageNumber: z.number().min(1),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ReaderBookmark> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const bookmarkData: {
        userId: string;
        mangaId: number;
        chapterId: number;
        pageNumber: number;
        note?: string;
      } = {
        userId,
        mangaId: input.mangaId,
        chapterId: input.chapterId,
        pageNumber: input.pageNumber,
      };

      if (input.note !== undefined) {
        bookmarkData.note = input.note;
      }

      const bookmark = await ctx.prisma.readerBookmark.create({
        data: bookmarkData,
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitBookmarkChange({
        id: bookmark.id,
        type: 'reader',
        action: 'created',
        entityId: input.chapterId,
        mangaId: input.mangaId
      });

      return bookmark;
    }),

  /**
   * Remove bookmark
   *
   * Deletes a bookmark. Verifies that the bookmark belongs to the
   * authenticated user before deletion.
   */
  removeBookmark: protectedProcedure
    .input(
      z.object({
        bookmarkId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ReaderBookmark> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      // Verify bookmark belongs to user
      const bookmark = await ctx.prisma.readerBookmark.findUnique({
        where: { id: input.bookmarkId },
      });

      if (bookmark?.userId !== userId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bookmark not found',
        });
      }

      const deleted = await ctx.prisma.readerBookmark.delete({
        where: { id: input.bookmarkId },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitBookmarkChange({
        id: input.bookmarkId,
        type: 'reader',
        action: 'deleted',
        entityId: bookmark.chapterId,
        mangaId: bookmark.mangaId
      });

      return deleted;
    }),

  /**
   * Get all bookmarks for manga
   *
   * Retrieves all bookmarks for a specific manga belonging to the
   * authenticated user. Includes chapter details and is sorted by
   * chapter and page number.
   */
  getBookmarks: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<BookmarkWithChapter[]> => {
      const userId = getUserId(ctx);
      if (!userId) return [];

      return ctx.prisma.readerBookmark.findMany({
        where: {
          userId,
          mangaId: input.mangaId,
        },
        include: {
          chapter: true,
        },
        orderBy: [{ chapterId: 'asc' }, { pageNumber: 'asc' }],
      });
    }),
});
