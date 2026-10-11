/**
 * Cache Maintenance Operations
 *
 * Standalone functions for cache eviction, cleanup, statistics,
 * and bulk operations. Accept a PrismaClient for pool isolation.
 *
 * @module server/cache/UnifiedCacheProvider/maintenance
 */

import { logger } from '@/utils/logger';

import type { CacheDataType, CacheInternalStats, CacheStats } from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Expired rows are kept this long before they are deleted, so callers that
 * read with `allowStale` (stale-while-error) still find last-known-good data
 * during an upstream outage.
 */
export const EXPIRED_RETENTION_DAYS = 7;

/** The size check scans the table, so run it at most this often per client. */
const MAINTENANCE_INTERVAL_MS = 5 * 60 * 1000;

const lastMaintenanceAt = new WeakMap<PrismaClient, number>();

/**
 * Housekeeping run from the write path: remove long-expired rows, then evict
 * if the table is still over capacity (expired rows first, then least used).
 * Throttled so an ordinary `set` does not pay for a table count.
 */
export async function evictIfNeeded(
  db: PrismaClient,
  maxCacheSize: number,
  stats: CacheInternalStats
): Promise<void> {
  const now = Date.now();
  if (now - (lastMaintenanceAt.get(db) ?? 0) < MAINTENANCE_INTERVAL_MS) return;
  lastMaintenanceAt.set(db, now);

  try {
    await clearExpiredEntries(db);

    const count = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM cache_unified
    `;

    const currentCount = Number(count[0]?.count ?? 0);

    if (currentCount >= maxCacheSize) {
      const toEvict = Math.floor(maxCacheSize * 0.1);

      const evicted = await db.$executeRaw`
        DELETE FROM cache_unified
        WHERE cache_key IN (
          SELECT cache_key
          FROM cache_unified
          ORDER BY
            (expires_at IS NOT NULL AND expires_at < NOW()) DESC,
            access_frequency ASC,
            last_accessed_at ASC
          LIMIT ${toEvict}
        )
      `;

      // eslint-disable-next-line no-param-reassign -- Intentional: shared stats object passed by reference
      stats.evictions += evicted;
      logger.info(`Evicted ${evicted} cache entries`);
    }
  } catch (error) {
    logger.error('Cache eviction error:', error);
  }
}

/**
 * Delete entries that expired more than {@link EXPIRED_RETENTION_DAYS} ago.
 */
export async function clearExpiredEntries(db: PrismaClient): Promise<number> {
  try {
    const deleted = await db.$executeRaw`
      DELETE FROM cache_unified
      WHERE expires_at IS NOT NULL
        AND expires_at < NOW() - (${EXPIRED_RETENTION_DAYS} * INTERVAL '1 day')
    `;

    if (deleted > 0) {
      logger.info(`Cleared ${deleted} expired cache entries`);
    }
    return deleted;
  } catch (error) {
    logger.error('Clear expired error:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(db: PrismaClient, stats: CacheInternalStats): Promise<CacheStats> {
  try {
    const dbStats = await db.$queryRaw<unknown[]>`
      SELECT
        namespace,
        COUNT(*) as entries,
        SUM(size_bytes) as total_size,
        SUM(access_count) as total_hits
      FROM cache_unified
      GROUP BY namespace
    `;

    const namespaces: Record<string, unknown> = {};
    let totalEntries = 0;
    let totalSize = 0;
    let totalHits = 0;

    for (const stat of dbStats) {
      const statRecord = stat as Record<string, unknown>;
      namespaces[statRecord["namespace"] as string] = {
        entries: Number(statRecord["entries"]),
        size: Number(statRecord["total_size"]),
        hits: Number(statRecord["total_hits"])
      };
      totalEntries += Number(statRecord["entries"]);
      totalSize += Number(statRecord["total_size"]);
      totalHits += Number(statRecord["total_hits"]);
    }

    const hitRate = totalHits > 0
      ? stats.hits / (stats.hits + stats.misses)
      : 0;

    return {
      totalEntries,
      totalSize,
      hitRate,
      evictions: stats.evictions,
      namespaces: namespaces as Record<string, { entries: number; size: number; hits: number }>
    };
  } catch (error) {
    logger.error('Get stats error:', error);
    return { totalEntries: 0, totalSize: 0, hitRate: 0, evictions: 0, namespaces: {} };
  }
}

/**
 * Clear entire cache or by namespace/tags
 *
 * Security: Uses parameterized queries to prevent SQL injection (OWASP A03:2021)
 */
export async function clearCache(
  db: PrismaClient,
  options?: { namespace?: string; tags?: string[] }
): Promise<number> {
  try {
    if (options?.namespace && options.tags && options.tags.length > 0) {
      const deleted = await db.$executeRaw`
        DELETE FROM cache_unified
        WHERE namespace = ${options.namespace}
          AND tags && ${options.tags}
      `;
      logger.info(`Cleared ${deleted} cache entries`, options);
      return Number(deleted);
    } else if (options?.namespace) {
      const deleted = await db.$executeRaw`
        DELETE FROM cache_unified
        WHERE namespace = ${options.namespace}
      `;
      logger.info(`Cleared ${deleted} cache entries`, options);
      return Number(deleted);
    } else if (options?.tags && options.tags.length > 0) {
      const deleted = await db.$executeRaw`
        DELETE FROM cache_unified
        WHERE tags && ${options.tags}
      `;
      logger.info(`Cleared ${deleted} cache entries`, options);
      return Number(deleted);
    } else {
      const deleted = await db.$executeRaw`
        DELETE FROM cache_unified
      `;
      logger.info(`Cleared ${deleted} cache entries`, options);
      return Number(deleted);
    }
  } catch (error) {
    logger.error('Clear cache error:', error);
    return 0;
  }
}

/**
 * HSET operation - set hash field
 */
export async function hashSet(
  db: PrismaClient,
  normalizedKey: string,
  field: string,
  value: unknown,
  hashDataType: CacheDataType
): Promise<boolean> {
  try {
    await db.$executeRaw`
      INSERT INTO cache_unified (cache_key, cache_value, data_type)
      VALUES (${normalizedKey}, jsonb_build_object(${field}, ${JSON.stringify(value)}::jsonb), ${hashDataType})
      ON CONFLICT (cache_key) DO UPDATE SET
        cache_value = cache_unified.cache_value ?? jsonb_build_object(${field}, ${JSON.stringify(value)}::jsonb),
        access_count = cache_unified.access_count + 1,
        data_type = ${hashDataType}
    `;
    return true;
  } catch (error) {
    logger.error('Cache HSET error:', error);
    return false;
  }
}

/**
 * HGET operation - get hash field
 */
export async function hashGet(
  db: PrismaClient,
  normalizedKey: string,
  field: string,
  hashDataType: CacheDataType
): Promise<unknown> {
  try {
    const result = await db.$queryRaw<{ value: unknown }[]>`
      SELECT cache_value->${field} as value
      FROM cache_unified
      WHERE cache_key = ${normalizedKey}
        AND data_type = ${hashDataType}
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

    if (result.length > 0) {
      await db.$executeRaw`
        UPDATE cache_unified
        SET access_count = access_count + 1,
            last_accessed_at = NOW()
        WHERE cache_key = ${normalizedKey}
      `;
      return result[0]?.value;
    }

    return null;
  } catch (error) {
    logger.error('Cache HGET error:', error);
    return null;
  }
}
