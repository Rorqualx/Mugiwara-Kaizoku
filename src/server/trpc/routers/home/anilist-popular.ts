/**
 * Home Router - AniList Popular/Trending Queries
 *
 * Procedures that fetch popular and trending manga from AniList.
 * Uses three-tier caching for home page performance.
 *
 * Procedures:
 * - getPopular: Most popular manga
 * - getTop100: Top 100 popular manga
 * - getTrending: Currently trending manga
 *
 * Extracted from: home.ts (lines 834-900, 910-976, 1304-1370)
 *
 * @module server/trpc/routers/home/anilist-popular
 */

import { z } from 'zod';

import { hotCacheProvider } from '@/server/cache/HotDataCacheProvider';
import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { getRequestUserId } from '@/server/context/request-user-context';
import * as anilistQueries from '@/server/services/anilist/queries';
import {
  validatedAnilistClient,
  AniListPriority,
} from '@/server/services/anilist/validated-client';
import { configService } from '@/server/services/config/configService';
import {
  getUserConfigOverride,
  getUserConfigValue,
} from '@/server/services/config/user-config-service';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

// Import from foundation utils
import {
  transformAniListMedia,
  applyFormatFilter,
  type TransformedAniListMedia,
  type FormatFilterConfig
} from './utils';

/**
 * Resolve the effective "include adult" flag for the calling user. The caller's
 * own `anilist.filterAdultContent` override wins (true = hide ⇒ includeAdult
 * false); otherwise fall back to the instance-wide `search.includeAdult`.
 */
async function getIncludeAdultSetting(): Promise<boolean> {
  try {
    // Initialize the configuration service if needed
    if (!configService.isInitialized()) {
      await configService.initialize();
    }
    const userId = getRequestUserId();
    const filterOverride = await getUserConfigOverride<boolean>(userId, 'anilist.filterAdultContent');
    if (filterOverride !== undefined) {
      return !filterOverride;
    }
    return await configService.get<boolean>('search.includeAdult', false);
  } catch (error) {
    logger.debug('[AniList Popular] Failed to load adult filter setting, defaulting to filter out', { error });
    return false;
  }
}

/**
 * Get format filter settings, per-user with global fallback (experimental).
 * The caller's overrides win; otherwise the admin's global values apply.
 */
async function getFormatFilterSettings(): Promise<FormatFilterConfig> {
  try {
    // Initialize the configuration service if needed
    if (!configService.isInitialized()) {
      await configService.initialize();
    }
    const userId = getRequestUserId();
    const filterWebtoons = await getUserConfigValue<boolean>(userId, 'anilist.filterWebtoons', false);
    const filterKoreanManhwa = await getUserConfigValue<boolean>(userId, 'anilist.filterKoreanManhwa', false);
    return { filterWebtoons, filterKoreanManhwa };
  } catch (error) {
    logger.debug('[AniList Popular] Failed to load format filter settings, defaulting to filtering disabled', { error });
    return { filterWebtoons: false, filterKoreanManhwa: false };
  }
}

// ============================================================================
// AniList Popular/Trending Router
// ============================================================================

export const homeAnilistPopularRouter = router({
  /**
   * Get Popular section
   * Returns most popular manga from AniList
   * Uses three-tier caching: hot_data_cache -> cache_unified -> AniList API
   *
   * @input limit - Number of results (default 20, max 50)
   * @returns Array of popular manga from AniList
   */
  getPopular: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(20),
        })
        .optional()
    )
    .query(async ({ input }): Promise<TransformedAniListMedia[]> => {
      try {
        const limit = input?.limit ?? 20;
        const includeAdult = await getIncludeAdultSetting();
        const formatConfig = await getFormatFilterSettings();
        // Cache key includes adult filter state and format filter state
        const cacheKey = `popular:${limit}:adult:${includeAdult}:webtoon:${formatConfig.filterWebtoons}:manhwa:${formatConfig.filterKoreanManhwa}`;

        logger.info(`Fetching ${limit} popular manga from AniList (includeAdult: ${includeAdult}, filterWebtoons: ${formatConfig.filterWebtoons}, filterManhwa: ${formatConfig.filterKoreanManhwa})`);

        // 1. Check hot cache first (2-5ms)
        const hotCached = await hotCacheProvider.getHot<TransformedAniListMedia[]>('manga', cacheKey);
        if (hotCached) {
          logger.debug('Popular hot cache hit');
          return hotCached;
        }

        // 2. Check regular cache (15-30ms)
        const cached = await cacheProvider.get<TransformedAniListMedia[]>(cacheKey, 'anilist-popular');
        if (cached) {
          logger.debug('Popular regular cache hit');
          // Promote to hot cache (fire and forget)
          hotCacheProvider
            .setHot('manga', cacheKey, cached, { forceHot: true, ttl: 300 })
            .catch((_err) => logger.debug('Failed to promote popular to hot cache:', _err));
          return cached;
        }

        // 3. Fetch from AniList API (validated, with priority queue)
        const response = await validatedAnilistClient.queryPageWithPriority(
          anilistQueries.GET_POPULAR_MANGA,
          {
            page: 1,
            perPage: limit,
            isAdult: includeAdult, // Pass adult filter to AniList
          },
          AniListPriority.HIGH,
          `Popular manga (limit: ${limit})`
        );

        if (!response.data?.Page?.media) {
          logger.warn('No popular manga found from AniList');
          return [];
        }

        // 4. Apply format filtering (experimental) before transformation
        const filteredMedia = applyFormatFilter(response.data.Page.media, formatConfig);
        const popularManga = filteredMedia.map(transformAniListMedia);
        logger.info(`Found ${popularManga.length} popular manga from AniList`);

        // 5. Store in regular cache (30 minutes - critical/stable content)
        await cacheProvider.set(cacheKey, popularManga, {
          ttl: 1800,
          namespace: 'anilist-popular',
          tags: ['anilist', 'popular'],
        });

        // 6. Store in hot cache (home page data is always hot)
        await hotCacheProvider.setHot('manga', cacheKey, popularManga, {
          forceHot: true,
          ttl: 1800,
          tags: ['popular', 'anilist'],
        });

        return popularManga;
      } catch (_error) {
        logger.error('Error in getPopular:', _error);
        // Return empty array instead of throwing to gracefully handle AniList failures
        return [];
      }
    }),

  /**
   * Get Top 100 section
   * Returns top 100 most popular manga from AniList
   * Uses three-tier caching: hot_data_cache -> cache_unified -> AniList API
   *
   * @input limit - Number of results (default 100, max 100)
   * @returns Array of top popular manga from AniList
   */
  getTop100: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(100),
        })
        .optional()
    )
    .query(async ({ input }): Promise<TransformedAniListMedia[]> => {
      try {
        const limit = input?.limit ?? 100;
        const includeAdult = await getIncludeAdultSetting();
        const formatConfig = await getFormatFilterSettings();
        // Cache key includes adult filter state and format filter state
        const cacheKey = `top100:${limit}:adult:${includeAdult}:webtoon:${formatConfig.filterWebtoons}:manhwa:${formatConfig.filterKoreanManhwa}`;

        logger.info(`Fetching top ${limit} popular manga from AniList (includeAdult: ${includeAdult}, filterWebtoons: ${formatConfig.filterWebtoons}, filterManhwa: ${formatConfig.filterKoreanManhwa})`);

        // 1. Check hot cache first (2-5ms)
        const hotCached = await hotCacheProvider.getHot<TransformedAniListMedia[]>('manga', cacheKey);
        if (hotCached) {
          logger.debug('Top 100 hot cache hit');
          return hotCached;
        }

        // 2. Check regular cache (15-30ms)
        const cached = await cacheProvider.get<TransformedAniListMedia[]>(cacheKey, 'anilist-top100');
        if (cached) {
          logger.debug('Top 100 regular cache hit');
          // Promote to hot cache (fire and forget)
          hotCacheProvider
            .setHot('manga', cacheKey, cached, { forceHot: true })
            .catch((_err) => logger.debug('Failed to promote top100 to hot cache:', _err));
          return cached;
        }

        // 3. Fetch from AniList API (validated, with priority queue)
        const response = await validatedAnilistClient.queryPageWithPriority(
          anilistQueries.GET_TOP_RATED_MANGA,
          {
            page: 1,
            perPage: limit,
            isAdult: includeAdult, // Pass adult filter to AniList
          },
          AniListPriority.HIGH,
          `Top 100 manga (limit: ${limit})`
        );

        if (!response.data?.Page?.media) {
          logger.warn('No top 100 manga found from AniList');
          return [];
        }

        // 4. Apply format filtering (experimental) before transformation
        const filteredMedia = applyFormatFilter(response.data.Page.media, formatConfig);
        const top100Manga = filteredMedia.map(transformAniListMedia);
        logger.info(`Found ${top100Manga.length} top manga from AniList`);

        // 5. Store in regular cache (30 minutes - critical/stable content)
        await cacheProvider.set(cacheKey, top100Manga, {
          ttl: 1800,
          namespace: 'anilist-top100',
          tags: ['anilist', 'popular'],
        });

        // 6. ALWAYS store top 100 in hot cache (highest priority data)
        await hotCacheProvider.setHot('manga', cacheKey, top100Manga, {
          forceHot: true,
          ttl: 1800,
          tags: ['top100', 'popular'],
        });

        return top100Manga;
      } catch (_error) {
        logger.error('Error in getTop100:', _error);
        // Return empty array instead of throwing to gracefully handle AniList failures
        return [];
      }
    }),

  /**
   * Get Trending section
   * Returns currently trending manga from AniList
   * Uses three-tier caching: hot_data_cache -> cache_unified -> AniList API
   *
   * @input limit - Number of results (default 20, max 50)
   * @returns Array of trending manga from AniList
   */
  getTrending: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(20),
        })
        .optional()
    )
    .query(async ({ input }): Promise<TransformedAniListMedia[]> => {
      try {
        const limit = input?.limit ?? 20;
        const includeAdult = await getIncludeAdultSetting();
        const formatConfig = await getFormatFilterSettings();
        // Cache key includes adult filter state and format filter state
        const cacheKey = `trending:${limit}:adult:${includeAdult}:webtoon:${formatConfig.filterWebtoons}:manhwa:${formatConfig.filterKoreanManhwa}`;

        logger.info(`Fetching ${limit} trending manga from AniList (includeAdult: ${includeAdult}, filterWebtoons: ${formatConfig.filterWebtoons}, filterManhwa: ${formatConfig.filterKoreanManhwa})`);

        // 1. Check hot cache first (2-5ms)
        const hotCached = await hotCacheProvider.getHot<TransformedAniListMedia[]>('manga', cacheKey);
        if (hotCached) {
          logger.debug('Trending hot cache hit');
          return hotCached;
        }

        // 2. Check regular cache (15-30ms)
        const cached = await cacheProvider.get<TransformedAniListMedia[]>(cacheKey, 'anilist-trending');
        if (cached) {
          logger.debug('Trending regular cache hit');
          // Promote to hot cache (fire and forget)
          hotCacheProvider
            .setHot('manga', cacheKey, cached, { forceHot: true, ttl: 300 })
            .catch((_err) => logger.debug('Failed to promote trending to hot cache:', _err));
          return cached;
        }

        // 3. Fetch from AniList API (validated, with priority queue)
        // Trending uses CRITICAL priority as it powers the hero banner
        const response = await validatedAnilistClient.queryPageWithPriority(
          anilistQueries.GET_TRENDING_MANGA,
          {
            page: 1,
            perPage: limit,
            isAdult: includeAdult, // Pass adult filter to AniList
          },
          AniListPriority.CRITICAL,
          `Trending manga (limit: ${limit})`
        );

        if (!response.data?.Page?.media) {
          logger.warn('No trending manga found from AniList');
          return [];
        }

        // 4. Apply format filtering (experimental) before transformation
        const filteredMedia = applyFormatFilter(response.data.Page.media, formatConfig);
        const trendingManga = filteredMedia.map(transformAniListMedia);
        logger.info(`Found ${trendingManga.length} trending manga from AniList`);

        // 5. Store in regular cache (30 minutes - critical/stable content)
        await cacheProvider.set(cacheKey, trendingManga, {
          ttl: 1800,
          namespace: 'anilist-trending',
          tags: ['anilist', 'trending'],
        });

        // 6. Store in hot cache (home page data is always hot)
        await hotCacheProvider.setHot('manga', cacheKey, trendingManga, {
          forceHot: true,
          ttl: 1800,
          tags: ['trending', 'anilist'],
        });

        return trendingManga;
      } catch (_error) {
        logger.error('Error in getTrending:', _error);
        // Return empty array instead of throwing to gracefully handle AniList failures
        return [];
      }
    }),
});
