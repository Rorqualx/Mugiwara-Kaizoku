/**
 * Cache Adapter Interface
 *
 * Provides abstraction layer for caching implementations.
 * Allows switching between in-memory, Redis, or other cache backends.
 *
 * @module server/cache/cache-adapter
 */

import { logger } from '@/utils/logger';

/**
 * Cache adapter interface for pluggable cache implementations
 */
export interface CacheAdapter {
  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (default: 3600)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a value from cache
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Clear cache entries
   * @param pattern - Optional pattern to match keys (e.g., "user:*")
   */
  clear(pattern?: string): Promise<void>;
}

/**
 * Extended cache adapter with atomic counter operations
 * Used for security logging and rate limiting
 */
export interface ExtendedCacheAdapter extends CacheAdapter {
  /**
   * Increment a counter atomically
   * @param key - Cache key
   * @returns New counter value
   */
  incr(key: string): Promise<number>;

  /**
   * Decrement a counter atomically
   * @param key - Cache key
   * @returns New counter value
   */
  decr(key: string): Promise<number>;

  /**
   * Set expiration time on a key
   * @param key - Cache key
   * @param seconds - TTL in seconds
   * @returns true if expiration was set
   */
  expire(key: string, seconds: number): Promise<boolean>;

  /**
   * Get TTL for a key
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  ttl(key: string): Promise<number>;

  /**
   * Check if key exists
   * @param key - Cache key
   * @returns true if key exists
   */
  exists(key: string): Promise<boolean>;
}

/**
 * In-memory cache adapter
 *
 * ⚠️  WARNING: Not suitable for production multi-instance deployments
 * - Cache resets on server restart
 * - Not shared across multiple server instances
 * - No persistence
 *
 * Use Redis adapter for production deployments with multiple instances.
 */
export class MemoryCacheAdapter implements CacheAdapter {
  private cache = new Map<string, { data: unknown; expiresAt: number }>();

  get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.data as T);
  }

  set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + (ttl * 1000),
    });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.cache.delete(key);
    return Promise.resolve();
  }

  clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      return Promise.resolve();
    }

    // Simple pattern matching (supports wildcards at end)
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
    return Promise.resolve();
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * PostgreSQL-based cache adapter note
 *
 * For production deployments requiring persistent caching with Redis-like
 * operations, use UnifiedCacheProvider instead which provides:
 * - PostgreSQL UNLOGGED tables for performance
 * - Redis-like operations (GET, SET, INCR, etc.)
 * - LRU eviction and TTL support
 *
 * @see src/server/cache/UnifiedCacheProvider.ts
 */

/**
 * Factory function to create appropriate cache adapter
 *
 * Determines which cache adapter to use based on environment configuration.
 * For production with persistence needs, use UnifiedCacheProvider directly.
 *
 * @returns Cache adapter instance
 */
export function createCacheAdapter(): CacheAdapter {
  // Note: For production multi-instance deployments needing persistence,
  // use UnifiedCacheProvider which provides PostgreSQL-based caching
  if (process.env.NODE_ENV === 'production') {
    logger.info(
      '[CacheAdapter] Using in-memory cache. For persistence, use UnifiedCacheProvider.'
    );
  }

  return new MemoryCacheAdapter();
}

/**
 * Global cache instance
 * Use this for consistent caching across the application
 */
export const cache = createCacheAdapter();
