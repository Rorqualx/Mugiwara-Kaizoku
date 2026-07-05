/**
 * Home Router - AniList Filtered Queries
 *
 * Procedures that fetch filtered manga from AniList by genre, format, or year.
 * Uses three-tier caching for performance.
 *
 * Procedures:
 * - getByGenre: Filter by genre
 * - getAvailableGenres: List available genres
 * - getByFormat: Filter by format
 * - getNewSeries: Get current year series
 *
 * Extracted from: home.ts (lines 987-1294)
 *
 * @module server/trpc/routers/home/anilist-filtered
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

import { serveStaleAniList } from './anilist-stale';
// Import from foundation utils
import {
  transformAniListMedia,
  applyFormatFilter,
  COMMON_ANILIST_GENRES,
  type TransformedAniListMedia,
  type FormatFilterConfig,
} from './utils';

/**
 * Resolve the effective "include adult" flag for the calling user.
 *
 * The caller's own `anilist.filterAdultContent` override wins (true = hide
 * adult ⇒ includeAdult false). When they have NOT personalised it, fall back
 * to the instance-wide legacy `search.includeAdult` setting so admin defaults
 * still apply. Returns false (filter out) on any error.
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
    // No per-user override → instance default (default false = filter out adult).
    return await configService.get<boolean>('search.includeAdult', false);
  } catch (error) {
    logger.debug('[AniList Filtered] Failed to load adult filter setting, defaulting to filter out', { error });
    return false;
  }
}

/**
 * Get format filter settings, per-user with global fallback (experimental).
 * Both default to false (off). The caller's overrides win; otherwise the
 * admin's global `anilist.filter*` values apply.
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
    logger.debug('[AniList Filtered] Failed to load format filter settings, defaulting to filtering disabled', { error });
    return { filterWebtoons: false, filterKoreanManhwa: false };
  }
}

// ============================================================================
// Helper Functions (to reduce procedure complexity)
// ============================================================================

/**
 * Check hot cache for AniList data
 *
 * @param cacheKey - Cache key to lookup
 * @param logContext - Context for logging (e.g., "Genre Action")
 * @returns Cached data if found, null otherwise
 */
async function checkHotCache(
  cacheKey: string,
  logContext: string
): Promise<TransformedAniListMedia[] | null> {
  const hotCached = await hotCacheProvider.getHot<TransformedAniListMedia[]>('manga', cacheKey);
  if (hotCached) {
    logger.debug(`${logContext} hot cache hit`);
    return hotCached;
  }
  return null;
}

/**
 * Check regular cache and promote to hot cache if found
 *
 * @param cacheKey - Cache key to lookup
 * @param namespace - Cache namespace
 * @param logContext - Context for logging
 * @param promoteOptions - Options for hot cache promotion
 * @returns Cached data if found, null otherwise
 */
async function checkRegularCache(
  cacheKey: string,
  namespace: string,
  logContext: string,
  promoteOptions: { ttl: number; forceHot?: boolean }
): Promise<TransformedAniListMedia[] | null> {
  const cached = await cacheProvider.get<TransformedAniListMedia[]>(cacheKey, namespace);
  if (cached) {
    logger.debug(`${logContext} regular cache hit`);
    // Promote to hot cache if accessed frequently
    hotCacheProvider
      .setHot('manga', cacheKey, cached, promoteOptions)
      .catch((_err) => logger.debug(`Failed to promote ${logContext} to hot cache:`, _err));
    return cached;
  }
  return null;
}

/**
 * Store data in both regular and hot cache
 *
 * @param cacheKey - Cache key
 * @param data - Data to cache
 * @param regularCacheOptions - Options for regular cache
 * @param hotCacheOptions - Options for hot cache
 */
async function storeBothCaches(
  cacheKey: string,
  data: TransformedAniListMedia[],
  regularCacheOptions: { ttl: number; namespace: string; tags: string[] },
  hotCacheOptions: { ttl: number; tags: string[]; forceHot?: boolean }
): Promise<void> {
  // Store in regular cache
  await cacheProvider.set(cacheKey, data, regularCacheOptions);

  // Store in hot cache
  await hotCacheProvider.setHot('manga', cacheKey, data, hotCacheOptions);
}

/**
 * Fetch and transform new series from AniList API
 * Extracted to reduce complexity of getNewSeries procedure
 *
 * @param limit - Number of results to fetch
 * @param currentYear - Current year for filtering
 * @param cacheKey - Cache key for storing results
 * @param includeAdult - Whether to include adult content
 * @param formatConfig - Format filter configuration
 * @returns Transformed AniList media array
 */
async function fetchNewSeriesFromAniList(
  limit: number,
  currentYear: number,
  cacheKey: string,
  includeAdult: boolean,
  formatConfig: FormatFilterConfig
): Promise<TransformedAniListMedia[]> {
  // Fetch from AniList API (validated, with priority queue)
  logger.debug(`[AniList New Series Query] Calling validated client with params:`, {
    query: 'GET_MANGA_BY_YEAR',
    variables: { year: currentYear, page: 1, perPage: limit, isAdult: includeAdult },
  });

  const response = await validatedAnilistClient.queryPageWithPriority(
    anilistQueries.GET_MANGA_BY_YEAR,
    {
      year: currentYear,
      page: 1,
      perPage: limit,
      isAdult: includeAdult, // Pass adult filter to AniList
    },
    AniListPriority.MEDIUM,
    `New series ${currentYear} (limit: ${limit})`
  );

  logger.debug(`[AniList New Series Query] Raw response:`, {
    hasResponse: !!response,
    hasData: !!response.data,
    hasPage: !!response.data?.Page,
    hasMedia: !!response.data?.Page?.media,
    mediaCount: response.data?.Page?.media.length ?? 0,
    pageInfo: response.data?.Page?.pageInfo,
  });

  if (!response.data?.Page?.media) {
    logger.warn(`[AniList New Series Query] No new series found from AniList for year ${currentYear}`, {
      response: JSON.stringify(response),
    });
    return [];
  }

  // Apply format filtering (experimental) before transformation
  const filteredMedia = applyFormatFilter(response.data.Page.media, formatConfig);
  const newSeries = filteredMedia.map(transformAniListMedia);
  logger.info(`[AniList New Series Query] Successfully fetched ${newSeries.length} new series from AniList`);

  // Store in both caches
  await storeBothCaches(
    cacheKey,
    newSeries,
    { ttl: 900, namespace: 'anilist-new-series', tags: ['anilist', 'new-series'] },
    { ttl: 900, tags: ['new-series', 'anilist'], forceHot: true }
  );

  return newSeries;
}

// ============================================================================
// Router Definition
// ============================================================================

export const homeAnilistFilteredRouter = router({
  /**
   * Get By Genre section
   * Returns manga filtered by a specific genre from AniList
   * Uses three-tier caching for genre-specific queries
   *
   * @input genre - Genre to filter by (required)
   * @input limit - Number of results (default 20)
   * @returns Array of manga with the specified genre from AniList
   */
  getByGenre: publicProcedure
    .input(
      z.object({
        genre: z.string().min(1),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }): Promise<TransformedAniListMedia[]> => {
      const namespace = 'anilist-genre';
      let cacheKey = '';
      try {
        const { genre, limit } = input;
        const includeAdult = await getIncludeAdultSetting();
        const formatConfig = await getFormatFilterSettings();
        // Cache key includes adult filter state and format filter state
        cacheKey = `genre:${genre}:${limit}:adult:${includeAdult}:webtoon:${formatConfig.filterWebtoons}:manhwa:${formatConfig.filterKoreanManhwa}`;

        logger.info(`[AniList Genre Query] Starting query for genre: ${genre}, limit: ${limit}, includeAdult: ${includeAdult}, filterWebtoons: ${formatConfig.filterWebtoons}, filterManhwa: ${formatConfig.filterKoreanManhwa}`);

        // 1. Check hot cache first (2-5ms)
        const hotCached = await checkHotCache(cacheKey, `Genre ${genre}`);
        if (hotCached) {
          return hotCached;
        }

        // 2. Check regular cache (15-30ms)
        const cached = await checkRegularCache(cacheKey, 'anilist-genre', `Genre ${genre}`, {
          ttl: 300,
        });
        if (cached) {
          return cached;
        }

        // 3. Fetch from AniList API (validated, with priority queue)
        // Genre sections use LOW priority as they load progressively
        logger.debug(`[AniList Genre Query] Calling validated client with params:`, {
          query: 'GET_MANGA_BY_GENRE',
          variables: { genre, page: 1, perPage: limit, isAdult: includeAdult },
        });

        const response = await validatedAnilistClient.queryPageWithPriority(
          anilistQueries.GET_MANGA_BY_GENRE,
          {
            genre,
            page: 1,
            perPage: limit,
            isAdult: includeAdult, // Pass adult filter to AniList
          },
          AniListPriority.LOW,
          `Genre ${genre} (limit: ${limit})`
        );

        logger.debug(`[AniList Genre Query] Raw response:`, {
          hasResponse: !!response,
          hasData: !!response.data,
          hasPage: !!response.data?.Page,
          hasMedia: !!response.data?.Page?.media,
          mediaCount: response.data?.Page?.media.length ?? 0,
          pageInfo: response.data?.Page?.pageInfo,
        });

        if (!response.data?.Page?.media) {
          logger.warn(`[AniList Genre Query] No manga found for genre: ${genre} from AniList`, {
            response: JSON.stringify(response),
          });
          return await serveStaleAniList(cacheKey, namespace);
        }

        // 4. Apply format filtering (experimental) before transformation
        const filteredMedia = applyFormatFilter(response.data.Page.media, formatConfig);
        const genreManga = filteredMedia.map(transformAniListMedia);
        logger.info(
          `[AniList Genre Query] Successfully fetched ${genreManga.length} manga for genre: ${genre}`
        );

        // 5. Store in both caches
        await storeBothCaches(
          cacheKey,
          genreManga,
          { ttl: 1200, namespace: 'anilist-genre', tags: ['anilist', 'genre', genre] },
          { ttl: 1200, tags: ['genre', genre, 'anilist'] }
        );

        return genreManga;
      } catch (_error) {
        logger.error(`[AniList Genre Query] ERROR for genre ${input.genre}:`, {
          error: _error instanceof Error ? _error.message : String(_error),
          stack: _error instanceof Error ? _error.stack : undefined,
          genre: input.genre,
          limit: input.limit,
        });
        // Serve stale cache if available so genre rows survive AniList outages
        return serveStaleAniList(cacheKey, namespace);
      }
    }),

  /**
   * Get Available Genres
   * Returns common AniList manga genres
   *
   * @returns Array of genre strings from AniList
   */
  getAvailableGenres: publicProcedure.query((): readonly string[] => {
    try {
      logger.info('Returning common AniList genres');

      // Return the predefined list of common AniList genres
      // These are the most popular genres on AniList that work with the API
      return COMMON_ANILIST_GENRES;
    } catch (_error) {
      logger.error('Error in getAvailableGenres:', _error);
      // Return empty array on error to avoid breaking the UI
      return [];
    }
  }),

  /**
   * Get By Format section
   * Returns manga filtered by a specific format from AniList
   * Uses three-tier caching for format-specific queries
   *
   * @input format - Format to filter by (NOVEL, ONE_SHOT, etc.) (required)
   * @input limit - Number of results (default 20)
   * @returns Array of manga with the specified format from AniList
   */
  getByFormat: publicProcedure
    .input(
      z.object({
        format: z.enum(['NOVEL', 'ONE_SHOT', 'MANGA']),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }): Promise<TransformedAniListMedia[]> => {
      try {
        const { format, limit } = input;
        const includeAdult = await getIncludeAdultSetting();
        const formatConfig = await getFormatFilterSettings();
        // Cache key includes adult filter state and format filter state
        const cacheKey = `format:${format}:${limit}:adult:${includeAdult}:webtoon:${formatConfig.filterWebtoons}:manhwa:${formatConfig.filterKoreanManhwa}`;

        logger.info(`[AniList Format Query] Starting query for format: ${format}, limit: ${limit}, includeAdult: ${includeAdult}, filterWebtoons: ${formatConfig.filterWebtoons}, filterManhwa: ${formatConfig.filterKoreanManhwa}`);

        // 1. Check hot cache first (2-5ms)
        const hotCached = await checkHotCache(cacheKey, `Format ${format}`);
        if (hotCached) {
          return hotCached;
        }

        // 2. Check regular cache (15-30ms)
        const cached = await checkRegularCache(cacheKey, 'anilist-format', `Format ${format}`, {
          ttl: 300,
        });
        if (cached) {
          return cached;
        }

        // 3. Fetch from AniList API (validated, with priority queue)
        // Format sections use MEDIUM priority (Light Novels, One Shots)
        logger.debug(`[AniList Format Query] Calling validated client with params:`, {
          query: 'GET_MANGA_BY_FORMAT',
          variables: { format, page: 1, perPage: limit, isAdult: includeAdult },
        });

        const response = await validatedAnilistClient.queryPageWithPriority(
          anilistQueries.GET_MANGA_BY_FORMAT,
          {
            format,
            page: 1,
            perPage: limit,
            isAdult: includeAdult, // Pass adult filter to AniList
          },
          AniListPriority.MEDIUM,
          `Format ${format} (limit: ${limit})`
        );

        logger.debug(`[AniList Format Query] Raw response:`, {
          hasResponse: !!response,
          hasData: !!response.data,
          hasPage: !!response.data?.Page,
          hasMedia: !!response.data?.Page?.media,
          mediaCount: response.data?.Page?.media.length ?? 0,
          pageInfo: response.data?.Page?.pageInfo,
        });

        if (!response.data?.Page?.media) {
          logger.warn(`[AniList Format Query] No manga found for format: ${format} from AniList`, {
            response: JSON.stringify(response),
          });
          return [];
        }

        // 4. Apply format filtering (experimental) before transformation
        const filteredMedia = applyFormatFilter(response.data.Page.media, formatConfig);
        const formatManga = filteredMedia.map(transformAniListMedia);
        logger.info(
          `[AniList Format Query] Successfully fetched ${formatManga.length} manga for format: ${format}`
        );

        // 5. Store in both caches
        await storeBothCaches(
          cacheKey,
          formatManga,
          { ttl: 1200, namespace: 'anilist-format', tags: ['anilist', 'format', format] },
          { ttl: 1200, tags: ['format', format, 'anilist'] }
        );

        return formatManga;
      } catch (_error) {
        logger.error(`[AniList Format Query] ERROR for format ${input.format}:`, {
          error: _error instanceof Error ? _error.message : String(_error),
          stack: _error instanceof Error ? _error.stack : undefined,
          format: input.format,
          limit: input.limit,
        });
        // Return empty array instead of throwing to gracefully handle AniList failures
        return [];
      }
    }),

  /**
   * Get New Series section
   * Returns manga that started recently from AniList
   * Uses three-tier caching for home page performance
   *
   * @input limit - Number of results (default 20)
   * @returns Array of new series from AniList
   */
  getNewSeries: publicProcedure
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
        const currentYear = new Date().getFullYear();
        const includeAdult = await getIncludeAdultSetting();
        const formatConfig = await getFormatFilterSettings();
        // Cache key includes adult filter state and format filter state
        const cacheKey = `new-series:${currentYear}:${limit}:adult:${includeAdult}:webtoon:${formatConfig.filterWebtoons}:manhwa:${formatConfig.filterKoreanManhwa}`;

        logger.info(
          `[AniList New Series Query] Starting query for year: ${currentYear}, limit: ${limit}, includeAdult: ${includeAdult}, filterWebtoons: ${formatConfig.filterWebtoons}, filterManhwa: ${formatConfig.filterKoreanManhwa}`
        );

        // 1. Check hot cache first (2-5ms)
        const hotCached = await checkHotCache(cacheKey, 'New series');
        if (hotCached) {
          return hotCached;
        }

        // 2. Check regular cache (15-30ms)
        const cached = await checkRegularCache(cacheKey, 'anilist-new-series', 'New series', {
          forceHot: true,
          ttl: 300,
        });
        if (cached) {
          return cached;
        }

        // 3. Fetch from AniList API and cache (extracted to reduce complexity)
        return await fetchNewSeriesFromAniList(limit, currentYear, cacheKey, includeAdult, formatConfig);
      } catch (_error) {
        logger.error(`[AniList New Series Query] ERROR:`, {
          error: _error instanceof Error ? _error.message : String(_error),
          stack: _error instanceof Error ? _error.stack : undefined,
          year: new Date().getFullYear(),
          limit: input?.limit ?? 20,
        });
        // Return empty array instead of throwing to gracefully handle AniList failures
        return [];
      }
    }),
});
