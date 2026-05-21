/**
 * Audio Player Router - Bookmarks Module
 *
 * Procedures:
 * - addBookmark: Add bookmark at timestamp
 * - updateBookmark: Update bookmark note/label/color
 * - removeBookmark: Delete bookmark
 * - getBookmarks: Get all bookmarks for manga
 * - getBookmarksByChapter: Get bookmarks for specific chapter
 *
 * @module server/trpc/routers/audioPlayer/bookmarks
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { getUserId, BOOKMARK_COLORS } from './utils';

import type { AudioBookmark, Prisma } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extended AudioBookmark with chapter relation
 */
type BookmarkWithChapter = Prisma.AudioBookmarkGetPayload<{
  include: { chapter: true };
}>;

// ============================================================================
// Validation Schemas
// ============================================================================

const bookmarkColorSchema = z.enum(BOOKMARK_COLORS as unknown as [string, ...string[]]);

// ============================================================================
// Router
// ============================================================================

export const audioPlayerBookmarksRouter = router({
  /**
   * Add bookmark at timestamp
   *
   * Creates a new audio bookmark for a specific timestamp in a chapter.
   * Requires authentication.
   */
  addBookmark: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
        timestamp: z.number().min(0),
        note: z.string().max(500).optional(),
        label: z.string().max(50).optional(),
        color: bookmarkColorSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<AudioBookmark> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      // Verify chapter exists and belongs to manga
      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.chapterId },
      });

      if (!chapter || chapter.mangaId !== input.mangaId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chapter not found',
        });
      }

      const bookmark = await ctx.prisma.audioBookmark.create({
        data: {
          userId,
          mangaId: input.mangaId,
          chapterId: input.chapterId,
          timestamp: input.timestamp,
          note: input.note ?? null,
          label: input.label ?? null,
          color: input.color ?? null,
        },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'audioPlayer:bookmark:created',
        source: 'audioPlayer-bookmarks',
        message: `Bookmark created for chapter ${input.chapterId}`,
        data: { bookmarkId: bookmark.id, mangaId: input.mangaId, chapterId: input.chapterId }
      });

      return bookmark;
    }),

  /**
   * Update bookmark
   *
   * Updates a bookmark's note, label, or color.
   * Verifies ownership before updating.
   */
  updateBookmark: protectedProcedure
    .input(
      z.object({
        bookmarkId: z.number(),
        note: z.string().max(500).optional(),
        label: z.string().max(50).optional(),
        color: bookmarkColorSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<AudioBookmark> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      // Verify bookmark belongs to user
      const bookmark = await ctx.prisma.audioBookmark.findUnique({
        where: { id: input.bookmarkId },
      });

      if (bookmark?.userId !== userId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bookmark not found',
        });
      }

      const updatedBookmark = await ctx.prisma.audioBookmark.update({
        where: { id: input.bookmarkId },
        data: {
          ...(input.note !== undefined && { note: input.note }),
          ...(input.label !== undefined && { label: input.label }),
          ...(input.color !== undefined && { color: input.color }),
        },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'audioPlayer:bookmark:updated',
        source: 'audioPlayer-bookmarks',
        message: `Bookmark ${input.bookmarkId} updated`,
        data: { bookmarkId: input.bookmarkId }
      });

      return updatedBookmark;
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
    .mutation(async ({ ctx, input }): Promise<AudioBookmark> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      // Verify bookmark belongs to user
      const bookmark = await ctx.prisma.audioBookmark.findUnique({
        where: { id: input.bookmarkId },
      });

      if (bookmark?.userId !== userId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bookmark not found',
        });
      }

      const deletedBookmark = await ctx.prisma.audioBookmark.delete({
        where: { id: input.bookmarkId },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'audioPlayer:bookmark:deleted',
        source: 'audioPlayer-bookmarks',
        message: `Bookmark ${input.bookmarkId} deleted`,
        data: { bookmarkId: input.bookmarkId, mangaId: bookmark.mangaId, chapterId: bookmark.chapterId }
      });

      return deletedBookmark;
    }),

  /**
   * Get all bookmarks for manga
   *
   * Retrieves all audio bookmarks for a specific manga belonging to the
   * authenticated user. Includes chapter details and is sorted by
   * chapter and timestamp.
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

      return ctx.prisma.audioBookmark.findMany({
        where: {
          userId,
          mangaId: input.mangaId,
        },
        include: {
          chapter: true,
        },
        orderBy: [{ chapterId: 'asc' }, { timestamp: 'asc' }],
      });
    }),

  /**
   * Get bookmarks for specific chapter
   *
   * Retrieves all audio bookmarks for a specific chapter belonging to the
   * authenticated user. Sorted by timestamp.
   */
  getBookmarksByChapter: protectedProcedure
    .input(
      z.object({
        chapterId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<AudioBookmark[]> => {
      const userId = getUserId(ctx);
      if (!userId) return [];

      return ctx.prisma.audioBookmark.findMany({
        where: {
          userId,
          chapterId: input.chapterId,
        },
        orderBy: {
          timestamp: 'asc',
        },
      });
    }),

  /**
   * Get bookmark count for manga
   *
   * Returns the total number of bookmarks for a manga.
   */
  getBookmarkCount: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<number> => {
      const userId = getUserId(ctx);
      if (!userId) return 0;

      return ctx.prisma.audioBookmark.count({
        where: {
          userId,
          mangaId: input.mangaId,
        },
      });
    }),
});
