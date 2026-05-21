/**
 * Cache Manager Module
 *
 * Manages in-memory caching of aggregated release schedules with TTL support.
 * Provides thread-safe cache operations for schedule data.
 *
 * Extracted from: ReleaseScheduleAggregator.ts (lines 65-68, 74-75, 509-536)
 */

import { toStringId } from '@/utils/id-converters';

import type { AggregatedReleaseSchedule } from './calendar-utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /**
   * Whether caching is enabled (default: true)
   */
  enabled?: boolean;

  /**
   * Cache time-to-live in minutes (default: 60)
   */
  ttl?: number;
}

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  data: AggregatedReleaseSchedule;
  expires: number;
}

// ============================================================================
// Cache Manager
// ============================================================================

/**
 * Cache manager for release schedules
 *
 * Maintains an in-memory cache of aggregated release schedules with TTL-based
 * expiration. Uses string keys for consistent ID handling.
 *
 * @example
 * ```typescript
 * const cache = new ScheduleCacheManager({ enabled: true, ttl: 60 });
 *
 * // Cache a schedule
 * cache.cacheResult(123, schedule);
 *
 * // Retrieve from cache
 * const cached = cache.getFromCache(123);
 *
 * // Clear specific manga
 * cache.clearCache(123);
 *
 * // Clear all
 * cache.clearCache();
 * ```
 */
export class ScheduleCacheManager {
  private readonly cache: Map<string, CacheEntry>;
  private readonly cacheTTL: number; // minutes
  private readonly enabled: boolean;

  /**
   * Create a new cache manager
   *
   * @param config - Cache configuration
   */
  constructor(config: CacheConfig = {}) {
    this.cache = new Map();
    this.enabled = config.enabled ?? true;
    this.cacheTTL = config.ttl ?? 60;
  }

  /**
   * Get cached schedule data for a manga
   *
   * Returns null if:
   * - Caching is disabled
   * - Key not found in cache
   * - Cache entry has expired
   *
   * @param mangaId - Manga ID to lookup
   * @returns Cached schedule or null
   */
  getFromCache(mangaId: number): AggregatedReleaseSchedule | null {
    if (!this.enabled) {
      return null;
    }

    const key = toStringId(mangaId);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check expiration
    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Store schedule data in cache with TTL
   *
   * Calculates expiration time based on configured TTL.
   * No-op if caching is disabled.
   *
   * @param mangaId - Manga ID to cache
   * @param data - Schedule data to store
   */
  cacheResult(mangaId: number, data: AggregatedReleaseSchedule): void {
    if (!this.enabled) {
      return;
    }

    const key = toStringId(mangaId);
    const expires = Date.now() + this.cacheTTL * 60 * 1000;

    this.cache.set(key, {
      data,
      expires
    });
  }

  /**
   * Clear cache for specific manga or all entries
   *
   * @param mangaId - Optional manga ID. If omitted, clears all cache.
   *
   * @example
   * ```typescript
   * // Clear specific manga
   * cache.clearCache(123);
   *
   * // Clear all
   * cache.clearCache();
   * ```
   */
  clearCache(mangaId?: number): void {
    if (mangaId !== undefined) {
      const key = toStringId(mangaId);
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Check if caching is enabled
   *
   * @returns True if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current cache size
   *
   * @returns Number of cached entries
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics including size and expiration info
   */
  getStats(): {
    size: number;
    enabled: boolean;
    ttlMinutes: number;
  } {
    return {
      size: this.cache.size,
      enabled: this.enabled,
      ttlMinutes: this.cacheTTL
    };
  }
}
