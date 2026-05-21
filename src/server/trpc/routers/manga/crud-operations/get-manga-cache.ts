/**
 * Get Manga Cache Helpers
 *
 * Helper functions for caching operations in the manga get procedure.
 * Extracted to reduce complexity and keep procedures under 100 lines.
 */

import { cache } from '@/server/cache/cache-adapter';
import { hotCacheProvider } from '@/server/cache/HotDataCacheProvider';
import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import {
  createMangaRelationsSlim,
  DEFAULT_CHAPTER_LIMIT,
  type MangaWithRelations
} from '../shared';

import type { PrismaClient } from '@prisma/client';

/**
 * Check cache layers for manga data
 *
 * @returns Cached manga or null if not found
 */
export async function checkMangaCache(
  mangaId: number,
  cacheKey: string
): Promise<MangaWithRelations | null> {
  // 1. Check hot cache first (2-5ms) - fastest path for popular manga
  const hotCached = await hotCacheProvider.getHot<MangaWithRelations>('manga', cacheKey);
  if (hotCached) {
    logger.debug(`Hot cache hit for manga ${mangaId}`);
    return hotCached;
  }

  // 2. Check regular cache (15-30ms) - second fastest path
  const cached = await cacheProvider.get<MangaWithRelations>(cacheKey, 'manga-detail');
  if (cached) {
    logger.debug(`Regular cache hit for manga ${mangaId}`);
    // Auto-promote to hot cache for frequently accessed manga
    hotCacheProvider.setHot('manga', cacheKey, cached, {
      forceHot: false,
      ttl: 600,
      tags: ['manga-detail', `manga-id:${mangaId}`]
    }).catch((err: unknown) =>
      logger.debug('Failed to promote manga to hot cache:', err)
    );
    return cached;
  }

  return null;
}

/**
 * Store manga in both cache layers
 */
export async function storeMangaInCache(
  mangaId: number,
  cacheKey: string,
  manga: MangaWithRelations
): Promise<void> {
  await Promise.all([
    cacheProvider.set(cacheKey, manga, {
      ttl: 600,
      namespace: 'manga-detail',
      tags: ['manga', `manga-id:${mangaId}`]
    }),
    hotCacheProvider.setHot('manga', cacheKey, manga, {
      forceHot: false,
      ttl: 600,
      tags: ['manga-detail', `manga-id:${mangaId}`]
    })
  ]).catch((err: unknown) =>
    logger.warn('Failed to cache manga detail:', err)
  );
}

/**
 * Check if manga needs chapter re-fetch and return updated manga if so
 *
 * Uses slim chapter select for performance (~80% smaller payload).
 * The cast to MangaWithRelations is safe because all consumers only
 * access the fields included in the slim select.
 *
 * @returns Re-fetched manga or null if no re-fetch needed
 */
export async function checkChapterRefetch(
  prisma: PrismaClient,
  manga: MangaWithRelations,
  chapterLimit: number
): Promise<MangaWithRelations | null> {
  // If metadata has chapters but none loaded, check database
  if (!manga.Metadata?.chapters || manga.Chapter.length > 0) {
    return null;
  }

  const actualChapterCount = await prisma.chapter.count({
    where: { mangaId: toNumberId(manga.id) }
  });

  if (actualChapterCount > 0) {
    logger.info(`Manga ${manga.title} has ${actualChapterCount} chapters in database, re-fetching with chapters included`);
    const refetched = await prisma.manga.findUnique({
      where: { id: manga.id },
      include: createMangaRelationsSlim(chapterLimit || DEFAULT_CHAPTER_LIMIT)
    });
    // Safe cast: slim select is a subset of full Chapter fields.
    // All downstream consumers only access the slim fields.
    return refetched as unknown as MangaWithRelations | null;
  }

  // Log that chapters are missing but DO NOT auto-enrich
  logger.debug(`Manga ${manga.title} has Metadata.chapters=${manga.Metadata.chapters} but no actual chapters. Enrichment should only happen during import.`);
  return null;
}

/**
 * Invalidate all cache entries for a deleted manga
 *
 * Clears:
 * - Manga-specific caches (unified + hot cache)
 * - tRPC middleware cache for manga queries (so list views update immediately)
 *
 * @param mangaId - The ID of the deleted manga
 */
export async function invalidateMangaCache(mangaId: number): Promise<void> {
  try {
    const tag = `manga-id:${mangaId}`;

    // Clear from all cache layers including tRPC middleware cache
    const [unifiedCleared, hotCleared] = await Promise.all([
      cacheProvider.clear({ tags: [tag] }),
      hotCacheProvider.clearByTags([tag]),
      // Clear tRPC middleware cache for manga queries so list views update immediately
      cache.clear('trpc:manga.*')
    ]);

    logger.info(`[invalidateMangaCache] Cleared cache for manga ${mangaId} - unified: ${unifiedCleared}, hot: ${hotCleared}, trpc: cleared`);
  } catch (err: unknown) {
    logger.warn(`[invalidateMangaCache] Failed to invalidate cache for manga ${mangaId}:`, err);
  }
}
