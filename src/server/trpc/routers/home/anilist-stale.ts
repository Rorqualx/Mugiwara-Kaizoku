/**
 * AniList Stale-While-Error Fallback
 *
 * When a live AniList fetch fails (e.g. the API is down / rate-limited / has
 * been disabled upstream), we still want the home page to show last-known-good
 * discovery data instead of an empty section. This helper reads the expired
 * cache entry for a given key and returns it when present.
 *
 * @module server/trpc/routers/home/anilist-stale
 */

import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { logger } from '@/utils/logger';

import { type TransformedAniListMedia } from './utils';

/**
 * Serve the stale (expired) cache entry for an AniList discovery query as a
 * fallback when the live fetch is unavailable.
 *
 * @param cacheKey - The cache key the live path uses to store fresh results
 * @param namespace - The cache namespace (e.g. 'anilist-trending')
 * @returns Last-known-good results, or [] if nothing is cached
 */
export async function serveStaleAniList(
  cacheKey: string,
  namespace: string
): Promise<TransformedAniListMedia[]> {
  if (!cacheKey) return [];

  const stale = await cacheProvider.get<TransformedAniListMedia[]>(cacheKey, namespace, {
    allowStale: true,
    skipAccessTracking: true,
  });

  if (stale && stale.length > 0) {
    logger.warn(
      `[AniList] Serving stale cache for ${namespace} (live fetch unavailable, ${stale.length} items)`
    );
    return stale;
  }

  return [];
}
