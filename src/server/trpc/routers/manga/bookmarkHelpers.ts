/**
 * Bookmark Helper Functions
 *
 * Extracted from manga.ts to reduce duplication and improve maintainability.
 * Handles bookmark operations for volumes and manga entries.
 */

import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

/**
 * Type for bookmark result
 */
interface BookmarkResult {
  success: boolean;
  bookmarked: boolean;
  id?: number;
}

/**
 * Type for unknown Prisma client with bookmark models
 * Note: These models are not yet in schema.prisma
 */
type UnknownPrismaWithBookmarks = {
  bookmarkedVolume: {
    upsert: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
  };
  bookmarkedManga: {
    upsert: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
  };
};

/**
 * Toggle volume bookmark
 *
 * @param prisma - Prisma client instance
 * @param mangaId - Manga ID
 * @param volumeNumber - Volume number
 * @param bookmarked - Whether to add or remove bookmark
 * @returns Bookmark operation result
 */
export async function toggleVolumeBookmark(
  prisma: PrismaClient,
  mangaId: number,
  volumeNumber: number,
  bookmarked: boolean
): Promise<BookmarkResult> {
  const prismaWithBookmarks = prisma as unknown as UnknownPrismaWithBookmarks;

  try {
    if (bookmarked) {
      // Add bookmark
      const bookmark = await prismaWithBookmarks.bookmarkedVolume.upsert({
        where: {
          mangaId_volumeNumber_userId: {
            mangaId,
            volumeNumber,
            userId: null
          }
        },
        create: {
          mangaId,
          volumeNumber,
          userId: null
        },
        update: {}
      });

      const bookmarkData = bookmark as { id: number } | null;
      return {
        success: true,
        bookmarked: true,
        id: bookmarkData?.id ?? 0
      };
    } else {
      // Remove bookmark
      await prismaWithBookmarks.bookmarkedVolume.deleteMany({
        where: {
          mangaId,
          volumeNumber,
          userId: null
        }
      });
      return { success: true, bookmarked: false };
    }
  } catch (error) {
    logger.error('Error toggling volume bookmark', { error, mangaId, volumeNumber });
    throw error;
  }
}

/**
 * Toggle manga bookmark
 *
 * @param prisma - Prisma client instance
 * @param mangaId - Manga ID
 * @param bookmarked - Whether to add or remove bookmark
 * @returns Bookmark operation result
 */
export async function toggleMangaBookmark(
  prisma: PrismaClient,
  mangaId: number,
  bookmarked: boolean
): Promise<BookmarkResult> {
  const prismaWithBookmarks = prisma as unknown as UnknownPrismaWithBookmarks;

  try {
    if (bookmarked) {
      // Add bookmark
      const bookmark = await prismaWithBookmarks.bookmarkedManga.upsert({
        where: {
          mangaId_userId: {
            mangaId,
            userId: null
          }
        },
        create: {
          mangaId,
          userId: null
        },
        update: {}
      });

      const bookmarkData = bookmark as { id: number } | null;
      return {
        success: true,
        bookmarked: true,
        id: bookmarkData?.id ?? 0
      };
    } else {
      // Remove bookmark
      await prismaWithBookmarks.bookmarkedManga.deleteMany({
        where: {
          mangaId,
          userId: null
        }
      });
      return { success: true, bookmarked: false };
    }
  } catch (error) {
    logger.error('Error toggling manga bookmark', { error, mangaId });
    throw error;
  }
}

/**
 * Check if manga is bookmarked
 *
 * @param prisma - Prisma client instance
 * @param mangaId - Manga ID
 * @returns True if bookmarked, false otherwise
 */
export async function isMangaBookmarked(
  prisma: PrismaClient,
  mangaId: number
): Promise<boolean> {
  const prismaWithBookmarks = prisma as unknown as UnknownPrismaWithBookmarks;

  try {
    const bookmark = await prismaWithBookmarks.bookmarkedManga.findFirst({
      where: {
        mangaId,
        userId: null
      }
    });
    return bookmark !== null;
  } catch (error) {
    logger.error('Error checking manga bookmark', { error, mangaId });
    return false;
  }
}
