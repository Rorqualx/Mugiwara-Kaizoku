/**
 * Unified Cache Provider - Core Implementation
 *
 * High-performance caching system using PostgreSQL UNLOGGED tables
 * with Redis-like API. Supports injectable PrismaClient for pool isolation.
 *
 * @module server/cache/UnifiedCacheProvider/core
 */

import crypto from 'crypto';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { checkHotPromotion } from './hot-promotion';
import { clearCache, clearExpiredEntries, evictIfNeeded, getCacheStats, hashGet, hashSet } from './maintenance';
import { CacheDataType, CacheKeySchema, CacheNamespaceSchema, isRecord } from './types';

import type { CacheGetOptions, CacheInternalStats, CacheOptions, CacheStats } from './types';
import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Helpers
// ============================================================================

/** Process a single chunk of keys for getMany */
async function fetchCacheChunk<T>(
  db: PrismaClient,
  chunk: string[],
  namespace: string,
  normalizedToOriginal: Map<string, string>,
  resultMap: Map<string, T>
): Promise<void> {
  const rows = await db.$queryRaw<Array<{ cache_key: string; cache_value: unknown }>>`
    SELECT cache_key, cache_value
    FROM cache_unified
    WHERE cache_key = ANY(${chunk})
      AND namespace = ${namespace}
      AND (expires_at IS NULL OR expires_at > NOW())
  `;

  for (const row of rows) {
    const originalKey = normalizedToOriginal.get(row.cache_key);
    if (originalKey) {
      resultMap.set(originalKey, row.cache_value as T);
    }
  }
}

// ============================================================================
// Unified Cache Provider
// ============================================================================

export class UnifiedCacheProvider {
  private static instance: UnifiedCacheProvider | undefined;

  // Injected database client (defaults to main pool)
  private readonly db: PrismaClient;

  // Configuration
  private readonly defaultTTL: number;
  private readonly defaultNamespace: string;
  private readonly maxCacheSize: number;

  // Deduplication for concurrent requests
  private pendingRequests: Map<string, Promise<unknown>>;

  // Statistics
  private stats: CacheInternalStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    errors: 0
  };

  constructor(options: {
    defaultTTL?: number;
    defaultNamespace?: string;
    maxCacheSize?: number;
    compressionThreshold?: number;
    /** Inject a PrismaClient for pool isolation (defaults to main pool) */
    prismaClient?: PrismaClient;
  } = {}) {
    this.db = options.prismaClient ?? prisma;
    this.defaultTTL = options.defaultTTL ?? 3600;
    this.defaultNamespace = options.defaultNamespace ?? 'default';
    this.maxCacheSize = options.maxCacheSize ?? 100000;
    this.pendingRequests = new Map();

    logger.info('UnifiedCacheProvider initialized', {
      defaultTTL: this.defaultTTL,
      maxCacheSize: this.maxCacheSize,
      pool: options.prismaClient ? 'background' : 'main'
    });
  }

  /** Get singleton instance (uses main DB pool) */
  static getInstance(): UnifiedCacheProvider {
    UnifiedCacheProvider.instance ??= new UnifiedCacheProvider();
    return UnifiedCacheProvider.instance;
  }

  /** Create an instance using a dedicated background DB pool */
  static createForBackground(backgroundPrisma: PrismaClient): UnifiedCacheProvider {
    return new UnifiedCacheProvider({ prismaClient: backgroundPrisma });
  }

  /** Generate cache key from input */
  generateKey(input: string | Record<string, unknown>): string {
    const data = typeof input === 'string' ? input : JSON.stringify(input);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /** Normalize cache key - automatically hash keys exceeding 255 chars */
  private normalizeKey(key: string): string {
    if (key.length <= 255) return key;

    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const normalizedKey = `hash:${hash}`;

    logger.debug('Cache key exceeded 255 chars, auto-hashing', {
      originalLength: key.length,
      originalPrefix: key.substring(0, 50) + '...',
      hashedKey: normalizedKey
    });

    return normalizedKey;
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  /** GET operation - retrieve value from cache */
  async get<T = unknown>(key: string, namespace?: string, options?: CacheGetOptions): Promise<T | null> {
    try {
      const normalizedKey = this.normalizeKey(key);
      const validKey = CacheKeySchema.parse(normalizedKey);
      const validNamespace = CacheNamespaceSchema.parse(namespace ?? this.defaultNamespace);

      const dedupKey = `${validNamespace}:${validKey}`;
      if (this.pendingRequests.has(dedupKey)) {
        return (await this.pendingRequests.get(dedupKey)) as T | null;
      }

      const requestPromise = this._performGet<T>(validKey, validNamespace, options);
      this.pendingRequests.set(dedupKey, requestPromise);

      try {
        return await requestPromise;
      } finally {
        this.pendingRequests.delete(dedupKey);
      }
    } catch (error) {
      logger.error('Cache GET error:', error);
      this.stats.errors++;
      return null;
    }
  }

  private async _performGet<T>(key: string, namespace: string, options?: CacheGetOptions): Promise<T | null> {
    // allowStale drops the freshness filter so callers can serve last-known-good
    // data when the live upstream is down (stale-while-error).
    const result = options?.allowStale
      ? await this.db.$queryRaw<Array<{ cache_value: unknown; expires_at: Date | null; access_count: number }>>`
          SELECT cache_value, expires_at, access_count
          FROM cache_unified
          WHERE cache_key = ${key}
            AND namespace = ${namespace}
        `
      : await this.db.$queryRaw<Array<{ cache_value: unknown; expires_at: Date | null; access_count: number }>>`
          SELECT cache_value, expires_at, access_count
          FROM cache_unified
          WHERE cache_key = ${key}
            AND namespace = ${namespace}
            AND (expires_at IS NULL OR expires_at > NOW())
        `;

    if (result.length === 0) {
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    const firstResult = result[0];
    if (!firstResult || !isRecord(firstResult)) return null;

    // Skip access tracking for bulk reads (enrichment pipeline)
    if (options?.skipAccessTracking) {
      return firstResult['cache_value'] as T;
    }

    // Update access statistics
    const updated = await this.db.$queryRaw<Array<{ access_count: number }>>`
      UPDATE cache_unified
      SET
        access_count = access_count + 1,
        last_accessed_at = NOW(),
        access_frequency = access_frequency * 0.95 + 1.0
      WHERE cache_key = ${key} AND namespace = ${namespace}
      RETURNING access_count
    `;

    // Check for hot promotion (async, don't wait)
    const accessCount = updated[0]?.access_count ?? 0;
    if (accessCount > 0 && accessCount % 10 === 0) {
      checkHotPromotion(key, namespace, firstResult['cache_value'], accessCount).catch(err =>
        logger.debug('Hot promotion check failed:', err)
      );
    }

    return firstResult['cache_value'] as T;
  }

  /**
   * GET MANY operation - batch retrieve values from cache in a single query.
   * Returns a Map of original key -> value for found entries.
   */
  async getMany<T = unknown>(keys: string[], namespace?: string): Promise<Map<string, T>> {
    const resultMap = new Map<string, T>();
    if (keys.length === 0) return resultMap;

    try {
      const validNamespace = CacheNamespaceSchema.parse(namespace ?? this.defaultNamespace);

      const normalizedToOriginal = new Map<string, string>();
      const normalizedKeys: string[] = [];
      for (const key of keys) {
        const normalized = this.normalizeKey(key);
        const valid = CacheKeySchema.parse(normalized);
        normalizedToOriginal.set(valid, key);
        normalizedKeys.push(valid);
      }

      const CHUNK_SIZE = 500;
      for (let i = 0; i < normalizedKeys.length; i += CHUNK_SIZE) {
        const chunk = normalizedKeys.slice(i, i + CHUNK_SIZE);
        // eslint-disable-next-line no-await-in-loop -- Sequential chunks to avoid oversized query
        await fetchCacheChunk<T>(this.db, chunk, validNamespace, normalizedToOriginal, resultMap);
      }

      this.stats.hits += resultMap.size;
      this.stats.misses += keys.length - resultMap.size;

      return resultMap;
    } catch (error) {
      logger.error('Cache GET MANY error:', error);
      this.stats.errors++;
      return resultMap;
    }
  }

  /** SET operation - store value in cache */
  async set<T = unknown>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      if (value === undefined) {
        logger.debug('Cache SET skipped: value is undefined', { key });
        return false;
      }

      const normalizedKey = this.normalizeKey(key);
      const validKey = CacheKeySchema.parse(normalizedKey);
      const ns = options.namespace ?? this.defaultNamespace;
      const ttl = options.ttl ?? this.defaultTTL;
      const tags = options["tags"] ?? [];

      const valueJson = JSON.stringify(value);
      const sizeBytes = Buffer.byteLength(valueJson);
      const expiresAt = ttl > 0 ? new Date(Date.now() + ttl * 1000) : null;

      await evictIfNeeded(this.db, this.maxCacheSize, this.stats);

      await this.db.$executeRaw`
        INSERT INTO cache_unified (
          cache_key, cache_value, namespace, expires_at,
          tags, size_bytes, data_type
        ) VALUES (
          ${validKey}, ${valueJson}::jsonb, ${ns}, ${expiresAt},
          ${tags}, ${sizeBytes}, ${CacheDataType.JSON}
        )
        ON CONFLICT (cache_key) DO UPDATE SET
          cache_value = EXCLUDED.cache_value,
          expires_at = EXCLUDED.expires_at,
          tags = EXCLUDED.tags,
          size_bytes = EXCLUDED.size_bytes,
          access_count = cache_unified.access_count + 1,
          updated_at = NOW()
      `;

      return true;
    } catch (error) {
      logger.error('Cache SET error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /** DEL operation - delete value from cache */
  async del(key: string, namespace?: string): Promise<number> {
    try {
      const normalizedKey = this.normalizeKey(key);
      const validKey = CacheKeySchema.parse(normalizedKey);
      const validNamespace = namespace ?? this.defaultNamespace;

      return await this.db.$executeRaw`
        DELETE FROM cache_unified
        WHERE cache_key = ${validKey}
          AND namespace = ${validNamespace}
      `;
    } catch (error) {
      logger.error('Cache DEL error:', error);
      return 0;
    }
  }

  /** INCR operation - atomic counter increment */
  async incr(key: string, increment: number = 1): Promise<number> {
    try {
      const normalizedKey = this.normalizeKey(key);
      // Postgres `bigint` is signed 64-bit (max 9.2e18). The first 16 hex
      // chars of SHA-256 give an unsigned 64-bit value (max 1.8e19), so
      // ~50% of keys overflow when passed to pg_advisory_xact_lock.
      // BigInt.asIntN(64, …) reinterprets the bytes as signed int64, which
      // is the type pg expects. Lock identity is unchanged — both sides
      // map the same unsigned value to the same signed bit pattern.
      const lockKey = BigInt.asIntN(
        64,
        BigInt('0x' + crypto.createHash('sha256').update(normalizedKey).digest('hex').slice(0, 16)),
      );

      const result = await this.db.$queryRaw<{ count: number }[]>`
        WITH locked AS (
          SELECT pg_advisory_xact_lock(${lockKey})
        ),
        current_val AS (
          SELECT
            COALESCE((cache_value->>'count')::INTEGER, 0) as count
          FROM cache_unified
          WHERE cache_key = ${normalizedKey}
        ),
        new_val AS (
          SELECT COALESCE(MAX(count), 0) + ${increment} as count
          FROM current_val
        )
        INSERT INTO cache_unified (cache_key, cache_value, data_type)
        SELECT
          ${normalizedKey},
          jsonb_build_object('count', new_val.count),
          ${CacheDataType.STRING}
        FROM new_val
        ON CONFLICT (cache_key) DO UPDATE SET
          cache_value = jsonb_build_object('count', (cache_unified.cache_value->>'count')::INTEGER + ${increment}),
          access_count = cache_unified.access_count + 1
        RETURNING (cache_value->>'count')::INTEGER as count
      `;

      return result[0]?.count ?? increment;
    } catch (error) {
      logger.error('Cache INCR error:', error);
      throw error;
    }
  }

  /**
   * EXPIRE operation - set a TTL on an existing key WITHOUT touching its value.
   *
   * This is the Redis `EXPIRE` companion to `incr`: it lets a counter created by
   * INCR get a window TTL without the value-clobbering race that `set` would
   * introduce (set rewrites cache_value, so a concurrent INCR between INCR and
   * SET would be lost). Returns true if a row was updated.
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const normalizedKey = this.normalizeKey(key);
      const expiresAt = ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000) : null;
      const affected = await this.db.$executeRaw`
        UPDATE cache_unified
        SET expires_at = ${expiresAt}
        WHERE cache_key = ${normalizedKey}
      `;
      return affected > 0;
    } catch (error) {
      logger.error('Cache EXPIRE error:', error);
      return false;
    }
  }

  // ============================================================================
  // Hash & Sorted Set Operations (delegates to maintenance module)
  // ============================================================================

  async hset(key: string, field: string, value: unknown): Promise<boolean> {
    return hashSet(this.db, this.normalizeKey(key), field, value, CacheDataType.HASH);
  }

  async hget(key: string, field: string): Promise<unknown> {
    return hashGet(this.db, this.normalizeKey(key), field, CacheDataType.HASH);
  }

  async zadd(key: string, score: number, member: string): Promise<boolean> {
    try {
      const currentSet = await this.get<Record<string, number>>(key) ?? {};
      currentSet[member] = score;
      await this.set(key, currentSet, { namespace: 'zset' });
      return true;
    } catch (error) {
      logger.error('Cache ZADD error:', error);
      return false;
    }
  }

  async zrange(key: string, start: number, stop: number, withScores: boolean = false): Promise<string[] | Array<[string, number]>> {
    try {
      const set = await this.get<Record<string, number>>(key) ?? {};
      const sorted = Object.entries(set).sort(([, a], [, b]) => a - b).slice(start, stop + 1);
      return withScores ? sorted : sorted.map(([member]) => member);
    } catch (error) {
      logger.error('Cache ZRANGE error:', error);
      return [];
    }
  }

  // ============================================================================
  // Maintenance Operations (delegates to maintenance module)
  // ============================================================================

  async clearExpired(): Promise<number> {
    return clearExpiredEntries(this.db);
  }

  async getStats(): Promise<CacheStats> {
    return getCacheStats(this.db, this.stats);
  }

  async warmCache(predictions: Array<{ key: string; value: unknown; ttl?: number }>): Promise<void> {
    logger.info(`Warming cache with ${predictions.length} entries`);
    await Promise.all(
      predictions.map(({ key, value, ttl }) =>
        this.set(key, value, { ...(ttl !== undefined && { ttl }), namespace: 'warm' })
      )
    );
  }

  async clear(options?: { namespace?: string; tags?: string[] }): Promise<number> {
    return clearCache(this.db, options);
  }

  /** Get or compute - cache-aside pattern */
  async getOrCompute<T>(key: string, computeFn: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const cached = await this.get<T>(key, options.namespace);
    if (cached !== null) return cached;

    const value = await computeFn();
    await this.set(key, value, options);
    return value;
  }
}
