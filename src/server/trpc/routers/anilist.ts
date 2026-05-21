/**
 * AniList Router - Rich Manga Detail Fetching with Hot Cache
 *
 * Provides detailed manga information from AniList API with three-tier caching:
 * - Tier 1: hot_data_cache (UNLOGGED) - 2-5ms access to popular manga
 * - Tier 2: cache_unified (UNLOGGED) - 10-20ms with auto-promotion
 * - Tier 3: AniList API - 100-300ms for cache misses
 *
 * Performance:
 * - Hot cache hits: ~2-5ms (95% hit rate for popular manga)
 * - Regular cache hits: ~10-20ms + auto-promotion to hot
 * - API calls: ~100-300ms (only on cache miss)
 *
 * Cache Strategy:
 * - TTL: 600 seconds (10 minutes)
 * - Heat tracking: forceHot = false (popularity-based promotion)
 * - Invalidation: Tag-based (by anilistId)
 *
 * @module server/trpc/routers/anilist
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';


import { hotCacheProvider } from '@/server/cache/HotDataCacheProvider';
import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { anilistClient } from '@/server/services/anilist/client';
import * as anilistQueries from '@/server/services/anilist/queries';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

/**
 * AniList API response structure for manga details
 */
interface AniListMangaDetail {
  Media?: {
    id: number;
    title: {
      romaji?: string | null;
      english?: string | null;
      native?: string | null;
    };
    description?: string | null;
    coverImage?: {
      extraLarge?: string | null;
      large?: string | null;
      medium?: string | null;
      color?: string | null;
    };
    bannerImage?: string | null;
    status?: string | null;
    volumes?: number | null;
    chapters?: number | null;
    genres?: string[];
    synonyms?: string[];
    averageScore?: number | null;
    popularity?: number | null;
    startDate?: {
      year?: number | null;
      month?: number | null;
      day?: number | null;
    };
    endDate?: {
      year?: number | null;
      month?: number | null;
      day?: number | null;
    };
    tags?: Array<{
      id?: number;
      name?: string;
      category?: string;
    }>;
    characters?: {
      edges?: Array<{
        role?: string;
        node?: {
          id?: number;
          name?: {
            full?: string;
          };
        };
      }>;
    };
    staff?: {
      edges?: Array<{
        role?: string;
        node?: {
          id?: number;
          name?: {
            full?: string;
          };
        };
      }>;
    };
  };
}

/**
 * Generate cache key for AniList detail queries
 */
function generateAniListCacheKey(anilistId: number): string {
  return `anilist:detail:${anilistId}`;
}

/**
 * Staff edge type for AniList API
 */
type StaffEdge = {
  role?: string;
  node?: {
    id?: number;
    name?: {
      full?: string;
    };
  };
};

/**
 * Extract the main author from AniList staff data
 * Priority: Original Creator > Story > first staff member
 */
function extractMainAuthor(staff?: { edges?: StaffEdge[] }): string | null {
  if (!staff?.edges || staff.edges.length === 0) return null;

  // Priority 1: Find "Original Creator"
  const originalCreator = staff.edges.find((edge: StaffEdge) =>
    edge.role?.toLowerCase().includes('original creator')
  );
  if (originalCreator?.node?.name?.full) return originalCreator.node.name.full;

  // Priority 2: Find "Story" author
  const storyAuthor = staff.edges.find((edge: StaffEdge) =>
    edge.role?.toLowerCase().includes('story')
  );
  if (storyAuthor?.node?.name?.full) return storyAuthor.node.name.full;

  // Fallback: Return first staff member
  return staff.edges[0]?.node?.name?.full ?? null;
}

/**
 * Transform title data from AniList format
 */
function transformTitleData(title: {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}): { romaji: string | null; english: string | null; native: string | null } {
  return {
    romaji: title.romaji ?? null,
    english: title.english ?? null,
    native: title.native ?? null,
  };
}

/**
 * Transform cover image data from AniList format
 */
function transformCoverImageData(coverImage?: {
  extraLarge?: string | null;
  large?: string | null;
  medium?: string | null;
  color?: string | null;
}): { extraLarge: string | null; large: string | null; medium: string | null; color: string | null } {
  return {
    extraLarge: coverImage?.extraLarge ?? null,
    large: coverImage?.large ?? null,
    medium: coverImage?.medium ?? null,
    color: coverImage?.color ?? null,
  };
}

/**
 * Transform date data from AniList format
 */
function transformDateData(
  date?: { year?: number | null; month?: number | null; day?: number | null } | null
): { year?: number | null; month?: number | null; day?: number | null } | null {
  return date ?? null;
}

/**
 * Transform AniList API response to simplified format
 */
function transformAniListDetail(data: AniListMangaDetail): {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  coverImage: { extraLarge: string | null; large: string | null; medium: string | null; color: string | null };
  bannerImage: string | null;
  status: string | null;
  volumes: number | null;
  chapters: number | null;
  genres: string[];
  synonyms: string[];
  averageScore: number | null;
  popularity: number | null;
  startDate: { year?: number | null; month?: number | null; day?: number | null } | null;
  endDate: { year?: number | null; month?: number | null; day?: number | null } | null;
  tags: Array<{ id?: number; name?: string; category?: string }>;
  author: string | null;
} | null {
  const media = data.Media;

  if (!media) {
    return null;
  }

  return {
    id: media.id,
    title: transformTitleData(media.title),
    description: media.description ?? null,
    coverImage: transformCoverImageData(media.coverImage),
    bannerImage: media.bannerImage ?? null,
    status: media.status ?? null,
    volumes: media.volumes ?? null,
    chapters: media.chapters ?? null,
    genres: media.genres ?? [],
    synonyms: media.synonyms ?? [],
    averageScore: media.averageScore ?? null,
    popularity: media.popularity ?? null,
    startDate: transformDateData(media.startDate),
    endDate: transformDateData(media.endDate),
    tags: media.tags ?? [],
    author: extractMainAuthor(media.staff),
  };
}

/**
 * Check hot cache for manga details
 * @returns Cached data if valid, null if not found or invalid
 */
async function checkHotCache(
  cacheKey: string,
  anilistId: number
): Promise<ReturnType<typeof transformAniListDetail> | null> {
  const hotCached = await hotCacheProvider.getHot<ReturnType<typeof transformAniListDetail>>(
    'anilist_detail',
    cacheKey
  );

  if (hotCached) {
    logger.info(`[AniList Router] HOT CACHE HIT:`, {
      requestedId: anilistId,
      returnedId: hotCached.id,
      returnedTitle: typeof hotCached === 'object' && 'title' in hotCached
        ? (hotCached.title as { english?: string | null; romaji?: string | null }).english ?? (hotCached.title as { english?: string | null; romaji?: string | null }).romaji
        : 'unknown',
      cacheKey,
      dataMatch: hotCached.id === anilistId,
    });

    // CRITICAL VALIDATION: Ensure cached data matches requested ID
    if (hotCached.id !== anilistId) {
      logger.error('[AniList Router] HOT CACHE DATA MISMATCH - Invalidating:', {
        requestedId: anilistId,
        cachedId: hotCached.id,
        cacheKey,
      });
      return null; // Invalid cached data
    }

    return hotCached;
  }

  return null;
}

/**
 * Check regular cache for manga details with auto-promotion to hot cache
 * @returns Cached data if valid, null if not found or invalid
 */
async function checkRegularCacheWithPromotion(
  cacheKey: string,
  anilistId: number
): Promise<ReturnType<typeof transformAniListDetail> | null> {
  const cached = await cacheProvider.get<ReturnType<typeof transformAniListDetail>>(
    cacheKey,
    'anilist'
  );

  if (cached) {
    logger.info(`[AniList Router] REGULAR CACHE HIT:`, {
      requestedId: anilistId,
      returnedId: cached.id,
      returnedTitle: typeof cached === 'object' && 'title' in cached
        ? (cached.title as { english?: string | null; romaji?: string | null }).english ?? (cached.title as { english?: string | null; romaji?: string | null }).romaji
        : 'unknown',
      cacheKey,
      dataMatch: cached.id === anilistId,
    });

    // CRITICAL VALIDATION: Ensure cached data matches requested ID
    if (cached.id !== anilistId) {
      logger.error('[AniList Router] REGULAR CACHE DATA MISMATCH - Invalidating:', {
        requestedId: anilistId,
        cachedId: cached.id,
        cacheKey,
      });
      return null; // Invalid cached data
    }

    // Auto-promote to hot cache for frequently accessed manga
    hotCacheProvider
      .setHot('anilist_detail', cacheKey, cached, {
        forceHot: false, // Use heat score tracking
        ttl: 600, // 10 minutes (AniList data changes less frequently than search)
        tags: ['anilist', 'detail', `anilistId:${anilistId}`],
      })
      .catch((err: unknown) => {
        logger.debug('Failed to promote AniList detail to hot cache:', err);
      });

    return cached;
  }

  return null;
}

/**
 * Fetch manga details from AniList API and cache the result
 * @throws TRPCError if manga not found or data mismatch
 */
async function fetchFromApiAndCache(
  anilistId: number,
  cacheKey: string
): Promise<NonNullable<ReturnType<typeof transformAniListDetail>>> {
  logger.info(`[AniList Router] CACHE MISS - Querying API:`, {
    requestedId: anilistId,
    cacheKey,
  });

  const response = await anilistClient.query<AniListMangaDetail>(
    anilistQueries.GET_MANGA_DETAILS,
    {
      id: anilistId,
    }
  );

  const transformedData = transformAniListDetail(response);

  if (!transformedData) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Manga with AniList ID ${anilistId} not found`,
    });
  }

  logger.info(`[AniList Router] API RESPONSE:`, {
    requestedId: anilistId,
    returnedId: transformedData.id,
    returnedTitle: transformedData.title.english ?? transformedData.title.romaji,
    dataMatch: transformedData.id === anilistId,
  });

  // Store in both cache layers for future requests (async, non-blocking)
  await Promise.all([
    // Regular cache with 10-minute TTL
    cacheProvider.set(cacheKey, transformedData, {
      ttl: 600, // 10 minutes (AniList data changes less frequently than search)
      namespace: 'anilist',
      tags: ['anilist', 'detail', `anilistId:${anilistId}`],
    }),
    // Hot cache with heat score tracking
    hotCacheProvider.setHot('anilist_detail', cacheKey, transformedData, {
      forceHot: false, // Let heat score decide promotion
      ttl: 600, // 10 minutes
      tags: ['anilist', 'detail', `anilistId:${anilistId}`],
    }),
  ]).catch((err: unknown) => {
    logger.warn('Failed to cache AniList manga details:', err);
  });

  logger.info(`[AniList Router] FINAL RETURN (API):`, {
    requestedId: anilistId,
    returnedId: transformedData.id,
    returnedTitle: transformedData.title.english ?? transformedData.title.romaji,
    dataMatch: transformedData.id === anilistId,
  });

  // CRITICAL VALIDATION: Ensure returned data matches requested ID
  if (transformedData.id !== anilistId) {
    logger.error('[AniList Router] DATA MISMATCH ERROR:', {
      requestedId: anilistId,
      returnedId: transformedData.id,
      returnedTitle: transformedData.title.english ?? transformedData.title.romaji,
      cacheKey,
    });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Data mismatch: requested ${anilistId}, got ${transformedData.id}`,
    });
  }

  return transformedData;
}

/**
 * AniList Router
 *
 * Provides manga detail information from AniList with optimized caching
 */
/**
 * AniList search response structure
 */
interface AniListSearchPage {
  Page?: {
    pageInfo?: {
      total?: number;
      currentPage?: number;
      lastPage?: number;
      hasNextPage?: boolean;
      perPage?: number;
    };
    media?: Array<{
      id: number;
      idMal?: number | null;
      title: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
      };
      description?: string | null;
      coverImage?: {
        extraLarge?: string | null;
        large?: string | null;
        medium?: string | null;
        color?: string | null;
      };
      bannerImage?: string | null;
      format?: string | null;
      status?: string | null;
      countryOfOrigin?: string | null;
      isAdult?: boolean | null;
      volumes?: number | null;
      chapters?: number | null;
      genres?: string[];
      synonyms?: string[];
      averageScore?: number | null;
      meanScore?: number | null;
      popularity?: number | null;
      siteUrl?: string | null;
      startDate?: { year?: number | null; month?: number | null; day?: number | null };
      endDate?: { year?: number | null; month?: number | null; day?: number | null };
      tags?: Array<{ id?: number; name?: string; category?: string; rank?: number; isMediaSpoiler?: boolean }>;
    }>;
  };
}

/** Single media item from AniList search response */
type AniListSearchMediaItem = NonNullable<NonNullable<AniListSearchPage['Page']>['media']>[number];

/** Normalize optional scalar fields from an AniList search media item */
function normalizeSearchScalars(item: AniListSearchMediaItem): {
  idMal: number | null;
  description: string | null;
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  volumes: number | null;
  chapters: number | null;
  genres: string[];
  averageScore: number | null;
  popularity: number | null;
  startDate: { year?: number | null; month?: number | null; day?: number | null } | null;
} {
  return {
    idMal: item.idMal ?? null,
    description: item.description ?? null,
    bannerImage: item.bannerImage ?? null,
    format: item.format ?? null,
    status: item.status ?? null,
    volumes: item.volumes ?? null,
    chapters: item.chapters ?? null,
    genres: item.genres ?? [],
    averageScore: item.averageScore ?? null,
    popularity: item.popularity ?? null,
    startDate: item.startDate ?? null,
  };
}

/** Build a normalized search result item from raw AniList media data */
function buildSearchResultItem(item: AniListSearchMediaItem): {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  coverImage: { extraLarge: string | null; large: string | null; medium: string | null; color: string | null };
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  volumes: number | null;
  chapters: number | null;
  genres: string[];
  averageScore: number | null;
  popularity: number | null;
  startDate: { year?: number | null; month?: number | null; day?: number | null } | null;
} {
  return {
    id: item.id,
    title: transformTitleData(item.title),
    coverImage: transformCoverImageData(item.coverImage),
    ...normalizeSearchScalars(item),
  };
}

export const anilistRouter = router({
  /**
   * Search Manga on AniList
   *
   * Searches for manga by title using AniList's GraphQL API.
   * Returns a flat array of results with cover, title, genres, status, etc.
   *
   * @param {string} query - Search query string
   * @param {number} page - Page number (default: 1)
   * @param {number} perPage - Results per page (default: 10)
   * @returns Search results array with page info
   */
  searchManga: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        page: z.number().int().positive().optional().default(1),
        perPage: z.number().int().positive().max(25).optional().default(10),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await anilistClient.query<AniListSearchPage>(
          anilistQueries.SEARCH_MANGA,
          {
            search: input.query,
            page: input.page,
            perPage: input.perPage,
            isAdult: false,
          }
        );

        const media = response.Page?.media ?? [];
        const pageInfo = response.Page?.pageInfo;

        const results = media.map(buildSearchResultItem);

        return {
          results,
          pageInfo: {
            total: pageInfo?.total ?? 0,
            currentPage: pageInfo?.currentPage ?? input.page,
            lastPage: pageInfo?.lastPage ?? 1,
            hasNextPage: pageInfo?.hasNextPage ?? false,
          },
        };
      } catch (error: unknown) {
        logger.error(`Error searching AniList for "${input.query}":`, error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to search AniList: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  /**
   * Get Detailed Manga Information from AniList
   *
   * Fetches rich manga details including title, description, cover, genres,
   * score, popularity, and more. Uses three-tier hot caching for instant
   * performance on popular manga (2-5ms vs 100-300ms).
   *
   * @param {number} anilistId - The AniList manga ID
   * @returns Detailed manga information with all metadata
   *
   * @example
   * ```typescript
   * const manga = await trpc.anilist.getMangaDetails.query({ anilistId: 30013 }); // One Piece
   * ```
   */
  getMangaDetails: publicProcedure
    .input(
      z.object({
        /** AniList manga ID */
        anilistId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const cacheKey = generateAniListCacheKey(input.anilistId);

      // SERVER DEBUG: Track incoming request
      logger.info(`[AniList Router] REQUEST received:`, {
        requestedAnilistId: input.anilistId,
        generatedCacheKey: cacheKey,
        timestamp: Date.now(),
      });

      try {
        // TIER 1: Check hot cache first (2-5ms) - fastest path for popular manga
        const hotResult = await checkHotCache(cacheKey, input.anilistId);
        if (hotResult) return hotResult;

        // TIER 2: Check regular cache (10-20ms) - second fastest path
        const cachedResult = await checkRegularCacheWithPromotion(cacheKey, input.anilistId);
        if (cachedResult) return cachedResult;

        // TIER 3: Fetch from AniList API (100-300ms) - only on cache miss
        return await fetchFromApiAndCache(input.anilistId, cacheKey);
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error(`Error fetching AniList manga details for ID ${input.anilistId}:`, error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch manga details from AniList: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),
});
