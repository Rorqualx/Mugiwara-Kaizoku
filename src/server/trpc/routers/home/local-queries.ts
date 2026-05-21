/**
 * Home Router - Local Database Queries
 *
 * Procedures that query the local database for manga data.
 * These do not call external APIs.
 *
 * Procedures:
 * - hasManga: Check if any manga exists
 * - getContinueReading: Get user reading progress
 * - getRecentlyAdded: Get recently added manga
 * - getRecentlyReleased: Get manga with recent chapters
 *
 * Extracted from: home.ts (lines 517-823)
 *
 * @module server/trpc/routers/home/local-queries
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { hotCacheProvider } from '@/server/cache/HotDataCacheProvider';
import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { prisma } from '@/server/db';
import { publicProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';
import { isObject, hasProperty } from '@/utils/type-guards';

// Import from foundation utils
import { stripHeavyFields, getDaysAgo } from './utils';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Latest chapter info for recently released manga
 */
interface LatestChapterInfo {
  id: number;
  title: string | null;
  index: number | null;
  releaseDate: Date | null;
}

/**
 * Transformed manga for recently added results
 * Using Record to allow flexible Prisma return types
 */
interface RecentlyAddedManga extends Record<string, unknown> {
  metadata: unknown;
  chapterCount: number;
}

/**
 * Transformed manga for recently released results
 * Includes latest chapter information
 */
interface RecentlyReleasedManga extends Record<string, unknown> {
  metadata: unknown;
  chapterCount: number;
  latestChapter: LatestChapterInfo;
}

// ============================================================================
// Router Definition
// ============================================================================

export const homeLocalQueriesRouter = router({
  /**
   * Check if local manga exists
   * Returns boolean indicating if there is any manga in the local database
   *
   * @returns boolean - true if manga exists, false otherwise
   */
  hasManga: publicProcedure
    .query(async (): Promise<boolean> => {
      try {
        const count = await prisma.manga.count({
          where: {
            libraryStatus: 'ACTIVE',
          },
        });

        logger.info(`Manga count in database: ${count}`);
        return count > 0;
      } catch (error) {
        logger.error('Error checking manga existence:', error);
        // Return false on error to avoid breaking the UI
        return false;
      }
    }),

  /**
   * Get AniList IDs of all manga currently in the active library.
   * Used by the home page to mark cards (trending/popular/etc.) as "In Library".
   *
   * AniList IDs live on Manga.sourceId when source='anilist' (stored as string).
   *
   * @returns Array of AniList IDs (numbers) for active library manga
   */
  getLibraryAnilistIds: publicProcedure
    .query(async (): Promise<number[]> => {
      try {
        const cacheKey = 'library-anilist-ids';
        const cached = await hotCacheProvider.getHot<number[]>('manga', cacheKey);
        if (cached) return cached;

        const rows = await prisma.manga.findMany({
          where: {
            libraryStatus: 'ACTIVE',
            source: 'anilist',
            sourceId: { not: null },
          },
          select: { sourceId: true },
        });

        const ids: number[] = [];
        for (const r of rows) {
          if (r.sourceId === null) continue;
          const parsed = Number.parseInt(r.sourceId, 10);
          if (Number.isFinite(parsed)) ids.push(parsed);
        }

        await hotCacheProvider.setHot('manga', cacheKey, ids, {
          forceHot: true,
          ttl: 60,
          tags: ['library-membership'],
        });

        return ids;
      } catch (error) {
        logger.error('Error fetching library AniList IDs:', error);
        return [];
      }
    }),

  /**
   * Get Continue Reading section
   * Returns manga the user is currently reading but hasn't completed
   *
   * @auth Required - Uses current user session
   * @returns Array of manga with reading progress info
   */
  getContinueReading: protectedProcedure
    .query(({ ctx }): unknown[] => {
      try {
        const user = ctx['user'] as unknown;
        const userId = isObject(user) && hasProperty(user, 'id') && typeof user['id'] === 'string'
          ? user['id']
          : undefined;

        if (!userId) {
          logger.warn('getContinueReading: No user ID in context');
          return [];
        }

        logger.info('Continue Reading feature temporarily disabled (ReadingProgress model not yet implemented)');

        // TODO: Implement ReadingProgress model in Prisma schema
        // The ReadingProgress model needs to be added to track user reading progress
        // Fields needed: userId, mangaId, chapterId, currentPage, totalPages, lastReadAt, completedAt

        // For now, return empty array to prevent errors
        return [];

        /* Original implementation (commented out until ReadingProgress model is added):

        logger.info(`Fetching continue reading for user ${userId}`);

        // Get reading progress with manga and chapter data
        const progressRecords = await prisma.readingProgress.findMany({
          where: {
            userId,
            completedAt: null, // Only incomplete reads
          },
          include: {
            manga: {
              include: {
                Metadata: true,
                _count: {
                  select: { Chapter: true }
                }
              }
            },
            chapter: true,
          },
          orderBy: {
            lastReadAt: 'desc',
          },
          take: 10,
          distinct: ['mangaId'], // One entry per manga
        });

        logger.info(`Found ${progressRecords.length} in-progress manga for user ${userId}`);

        // Transform and strip heavy fields
        return progressRecords.map((progress: typeof progressRecords[number]) => ({
          ...stripHeavyFields(progress.manga),
          metadata: progress.manga.Metadata,
          chapterCount: progress.manga._count.Chapter,
          currentChapter: {
            id: progress.chapter.id,
            title: progress.chapter.title,
            index: progress.chapter.index,
          },
          progress: {
            currentPage: progress.currentPage,
            totalPages: progress.totalPages,
            lastReadAt: progress.lastReadAt,
          },
        }));
        */
      } catch (_error) {
        logger.error('Error in getContinueReading:', _error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch continue reading data',
          cause: _error,
        });
      }
    }),

  /**
   * Get Recently Added section
   * Returns manga recently added to the library
   * Uses three-tier caching for home page performance
   *
   * @input limit - Number of results (default 20)
   * @returns Array of manga sorted by creation date
   */
  getRecentlyAdded: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
    }).optional())
    .query(async ({ input }): Promise<RecentlyAddedManga[]> => {
      try {
        const limit = input?.limit ?? 20;
        const cacheKey = `recently-added:${limit}`;

        logger.info(`Fetching ${limit} recently added manga`);

        // 1. Check hot cache first (2-5ms)
        const hotCached = await hotCacheProvider.getHot<RecentlyAddedManga[]>('manga', cacheKey);
        if (hotCached) {
          logger.debug('Recently added hot cache hit');
          return hotCached;
        }

        // 2. Check regular cache (15-30ms)
        const cached = await cacheProvider.get<RecentlyAddedManga[]>(cacheKey, 'home-recently-added');
        if (cached) {
          logger.debug('Recently added regular cache hit');
          // Promote to hot cache (fire and forget)
          hotCacheProvider.setHot('manga', cacheKey, cached, { forceHot: true, ttl: 300 }).catch(_err =>
            logger.debug('Failed to promote recently added to hot cache:', _err)
          );
          return cached;
        }

        // 3. Fetch from database
        const manga = await prisma.manga.findMany({
          where: {
            libraryStatus: 'ACTIVE',
          },
          include: {
            Metadata: true,
            _count: {
              select: { Chapter: true }
            }
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: limit,
        });

        logger.info(`Found ${manga.length} recently added manga`);

        const result: RecentlyAddedManga[] = manga.map(m => ({
          ...stripHeavyFields(m),
          metadata: m.Metadata,
          chapterCount: m._count.Chapter,
        }));

        // 4. Store in regular cache (15 minutes - fresh content)
        await cacheProvider.set(cacheKey, result, {
          ttl: 900,
          namespace: 'home-recently-added',
          tags: ['recent-additions']
        });

        // 5. Store in hot cache (home page data is always hot)
        await hotCacheProvider.setHot('manga', cacheKey, result, {
          forceHot: true,
          ttl: 900,
          tags: ['recent-additions']
        });

        return result;
      } catch (_error) {
        logger.error('Error in getRecentlyAdded:', _error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recently added manga',
          cause: _error,
        });
      }
    }),

  /**
   * Get Recently Released section
   * Returns manga with chapters released in the last X days
   * Uses three-tier caching for home page performance
   *
   * @input limit - Number of results (default 20)
   * @input days - Number of days to look back (default 7)
   * @returns Array of manga with latest chapter info
   */
  getRecentlyReleased: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      days: z.number().min(1).max(90).default(7),
    }).optional())
    .query(async ({ input }): Promise<RecentlyReleasedManga[]> => {
      try {
        const limit = input?.limit ?? 20;
        const days = input?.days ?? 7;
        const cacheKey = `recently-released:${limit}:${days}`;

        logger.info(`Fetching recently released manga (${days} days, limit ${limit})`);

        // 1. Check hot cache first (2-5ms)
        const hotCached = await hotCacheProvider.getHot<RecentlyReleasedManga[]>('manga', cacheKey);
        if (hotCached) {
          logger.debug('Recently released hot cache hit');
          return hotCached;
        }

        // 2. Check regular cache (15-30ms)
        const cached = await cacheProvider.get<RecentlyReleasedManga[]>(cacheKey, 'home-recently-released');
        if (cached) {
          logger.debug('Recently released regular cache hit');
          // Promote to hot cache (fire and forget)
          hotCacheProvider.setHot('manga', cacheKey, cached, { ttl: 300 }).catch(_err =>
            logger.debug('Failed to promote recently released to hot cache:', _err)
          );
          return cached;
        }

        // 3. Fetch from database
        const cutoffDate = getDaysAgo(days);
        const recentChapters = await prisma.chapter.findMany({
          where: {
            releaseDate: {
              gte: cutoffDate,
            },
            downloadStatus: 'COMPLETED',
          },
          include: {
            Manga: {
              include: {
                Metadata: true,
                _count: {
                  select: { Chapter: true }
                }
              }
            }
          },
          orderBy: {
            releaseDate: 'desc',
          },
          take: limit * 2, // Get more to handle duplicates
        });

        // Group by manga and take first (latest) chapter for each
        // Use explicit typing to fix no-unsafe-return ESLint error
        const mangaMap = new Map<number, RecentlyReleasedManga>();
        for (const chapter of recentChapters) {
          if (!mangaMap.has(chapter.mangaId) && mangaMap.size < limit) {
            mangaMap.set(chapter.mangaId, {
              ...stripHeavyFields(chapter.Manga),
              metadata: chapter.Manga.Metadata,
              chapterCount: chapter.Manga._count.Chapter,
              latestChapter: {
                id: chapter.id,
                title: chapter.title,
                index: chapter.index,
                releaseDate: chapter.releaseDate,
              },
            });
          }
        }

        const result: RecentlyReleasedManga[] = Array.from(mangaMap.values());
        logger.info(`Found ${result.length} recently released manga`);

        // 4. Store in regular cache (15 minutes - fresh content)
        await cacheProvider.set(cacheKey, result, {
          ttl: 900,
          namespace: 'home-recently-released',
          tags: ['recent-releases']
        });

        // 5. Store in hot cache (home page data is always hot)
        await hotCacheProvider.setHot('manga', cacheKey, result, {
          forceHot: true,
          ttl: 900,
          tags: ['recent-releases']
        });

        return result;
      } catch (_error) {
        logger.error('Error in getRecentlyReleased:', _error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recently released manga',
          cause: _error,
        });
      }
    }),
});
