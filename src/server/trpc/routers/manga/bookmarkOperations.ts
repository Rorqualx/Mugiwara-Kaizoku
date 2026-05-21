/**
 * Bookmark operations for manga and volumes
 *
 * This module provides procedures for managing bookmarks across the manga system.
 * Requires authenticated user for all operations.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

// ============================================================================
// Volume Bookmarks
// ============================================================================

/**
 * Get all bookmarked volumes for a manga
 */
const getBookmarkedVolumes = protectedProcedure
  .input(z.object({ mangaId: z.number() }))
  .query(async ({ input, ctx }) => {
    const bookmarks = await ctx.prisma.bookmarkedVolume.findMany({
      where: {
        mangaId: input.mangaId,
        userId: ctx.session.user.id
      }
    });

    return bookmarks.map((b) => b.volumeNumber);
  });

/**
 * Toggle volume bookmark
 */
const toggleVolumeBookmark = protectedProcedure
  .input(z.object({
    mangaId: z.number(),
    volumeNumber: z.number(),
    bookmarked: z.boolean()
  }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.session.user.id;

    if (input.bookmarked) {
      // Add bookmark using upsert to handle race conditions
      const bookmark = await ctx.prisma.bookmarkedVolume.upsert({
        where: {
          userId_mangaId_volumeNumber: {
            userId,
            mangaId: input.mangaId,
            volumeNumber: input.volumeNumber
          }
        },
        create: {
          userId,
          mangaId: input.mangaId,
          volumeNumber: input.volumeNumber
        },
        update: {}
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitBookmarkChange({
        id: bookmark.id,
        type: 'volume',
        action: 'created',
        entityId: input.volumeNumber,
        mangaId: input.mangaId
      });

      return { success: true, bookmarked: true, id: bookmark.id };
    } else {
      // Remove bookmark
      await ctx.prisma.bookmarkedVolume.deleteMany({
        where: {
          userId,
          mangaId: input.mangaId,
          volumeNumber: input.volumeNumber
        }
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitBookmarkChange({
        id: 0,
        type: 'volume',
        action: 'deleted',
        entityId: input.volumeNumber,
        mangaId: input.mangaId
      });

      return { success: true, bookmarked: false };
    }
  });

// ============================================================================
// Manga Bookmarks
// ============================================================================

/**
 * Check if manga is bookmarked
 */
const getMangaBookmark = protectedProcedure
  .input(z.object({ mangaId: z.number() }))
  .query(async ({ input, ctx }) => {
    const bookmark = await ctx.prisma.bookmarkedManga.findFirst({
      where: {
        mangaId: input.mangaId,
        userId: ctx.session.user.id
      }
    });
    return bookmark !== null;
  });

/**
 * Toggle manga bookmark
 */
const toggleMangaBookmark = protectedProcedure
  .input(z.object({
    mangaId: z.number(),
    bookmarked: z.boolean()
  }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.session.user.id;

    if (input.bookmarked) {
      // Add bookmark using upsert to handle race conditions
      const bookmark = await ctx.prisma.bookmarkedManga.upsert({
        where: {
          userId_mangaId: {
            userId,
            mangaId: input.mangaId
          }
        },
        create: {
          userId,
          mangaId: input.mangaId
        },
        update: {}
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitBookmarkChange({
        id: bookmark.id,
        type: 'manga',
        action: 'created',
        entityId: input.mangaId,
        mangaId: input.mangaId
      });

      return { success: true, bookmarked: true, id: bookmark.id };
    } else {
      // Remove bookmark
      await ctx.prisma.bookmarkedManga.deleteMany({
        where: {
          userId,
          mangaId: input.mangaId
        }
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitBookmarkChange({
        id: 0,
        type: 'manga',
        action: 'deleted',
        entityId: input.mangaId,
        mangaId: input.mangaId
      });

      return { success: true, bookmarked: false };
    }
  });

/**
 * Get all bookmarked manga for the current user
 */
const getAllBookmarkedManga = protectedProcedure
  .query(async ({ ctx }) => {
    const bookmarks = await ctx.prisma.bookmarkedManga.findMany({
      where: {
        userId: ctx.session.user.id
      },
      include: {
        manga: {
          select: {
            id: true,
            title: true,
            Metadata: {
              select: {
                cover: true,
                coverMedium: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return bookmarks.map((b) => ({
      mangaId: b.mangaId,
      title: b.manga.title,
      cover: b.manga.Metadata?.coverMedium ?? b.manga.Metadata?.cover ?? null,
      bookmarkedAt: b.createdAt
    }));
  });

// ============================================================================
// Chapter Bookmarks (Placeholder - BookmarkedChapter model not yet implemented)
// ============================================================================

/**
 * Get all bookmarked chapters for a manga
 * Note: BookmarkedChapter model not yet implemented in schema
 */
const getBookmarkedChapters = protectedProcedure
  .input(z.object({ mangaId: z.number() }))
  .query(({ input: _input }) => {
    // BookmarkedChapter model not yet implemented
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Chapter bookmarks are not yet available'
    });
  });

/**
 * Toggle chapter bookmark
 * Note: BookmarkedChapter model not yet implemented in schema
 */
const toggleChapterBookmark = protectedProcedure
  .input(z.object({
    chapterId: z.number(),
    bookmarked: z.boolean()
  }))
  .mutation(({ input: _input }) => {
    // BookmarkedChapter model not yet implemented
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Chapter bookmarks are not yet available'
    });
  });

// ============================================================================
// Router Export
// ============================================================================

export const bookmarkRouter = router({
  getBookmarkedChapters,
  toggleChapterBookmark,
  getBookmarkedVolumes,
  toggleVolumeBookmark,
  getMangaBookmark,
  toggleMangaBookmark,
  getAllBookmarkedManga
});
