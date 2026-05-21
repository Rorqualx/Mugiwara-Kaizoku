/**
 * Prowlarr Search Cache
 *
 * In-memory cache for search results with TTL.
 * Reduces load on Prowlarr by caching recent searches.
 *
 * @module prowlarr/search-cache
 */

import type { ProwlarrSearchResult } from '@/types/prowlarr';
import { logger } from '@/utils/logger';


/**
 * Cache entry structure
 */
interface CacheEntry {
  /** Cached search results */
  results: ProwlarrSearchResult[];
  /** Timestamp when entry was created */
  createdAt: number;
  /** Number of times this entry was accessed */
  hits: number;
}

/**
 * Cache configuration
 */
interface CacheConfig {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttlMs: number;
  /** Maximum number of cached queries (default: 100) */
  maxEntries: number;
  /** Whether caching is enabled (default: true) */
  enabled: boolean;
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 100,
  enabled: true,
};

/**
 * Normalizes a search query for cache key generation
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Generates a cache key from query and options
 */
function generateCacheKey(query: string, categories?: number[], indexers?: number[]): string {
  const normalizedQuery = normalizeQuery(query);
  const categoriesKey = categories?.sort().join(',') ?? 'all';
  const indexersKey = indexers?.sort().join(',') ?? 'all';
  return `${normalizedQuery}|${categoriesKey}|${indexersKey}`;
}

/**
 * Prowlarr Search Cache
 *
 * Singleton cache for Prowlarr search results.
 * Uses LRU-like eviction when maxEntries is reached.
 */
class SearchCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig = DEFAULT_CONFIG;

  /**
   * Configure the cache
   */
  configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Search cache configured', {
      ttlMs: this.config.ttlMs,
      maxEntries: this.config.maxEntries,
      enabled: this.config.enabled,
    });
  }

  /**
   * Get cached results for a query
   */
  get(
    query: string,
    categories?: number[],
    indexers?: number[]
  ): ProwlarrSearchResult[] | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = generateCacheKey(query, categories, indexers);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.createdAt > this.config.ttlMs) {
      this.cache.delete(key);
      logger.debug('Cache entry expired', { query, age: now - entry.createdAt });
      return null;
    }

    // Update hit count
    entry.hits++;
    logger.debug('Cache hit', { query, hits: entry.hits });

    return entry.results;
  }

  /**
   * Store results in cache
   */
  set(
    query: string,
    results: ProwlarrSearchResult[],
    categories?: number[],
    indexers?: number[]
  ): void {
    if (!this.config.enabled) {
      return;
    }

    // Evict old entries if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const key = generateCacheKey(query, categories, indexers);
    this.cache.set(key, {
      results,
      createdAt: Date.now(),
      hits: 0,
    });

    logger.debug('Cached search results', {
      query,
      resultCount: results.length,
      cacheSize: this.cache.size,
    });
  }

  /**
   * Evict oldest/least used entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    let lowestHits = Infinity;

    for (const [key, entry] of this.cache) {
      // Prefer evicting entries with low hits and old age
      // Score calculation: entry.hits * 1000 + (Date.now() - entry.createdAt)
      if (entry.createdAt < oldestTime || (entry.createdAt === oldestTime && entry.hits < lowestHits)) {
        oldestKey = key;
        oldestTime = entry.createdAt;
        lowestHits = entry.hits;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Evicted cache entry', { key: oldestKey });
    }
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.config.ttlMs) {
        this.cache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info('Cleared expired cache entries', { count: cleared });
    }

    return cleared;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cleared all cache entries', { count: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxEntries: number;
    ttlMs: number;
    enabled: boolean;
    entries: Array<{ query: string; age: number; hits: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      query: key.split('|')[0] ?? key,
      age: now - entry.createdAt,
      hits: entry.hits,
    }));

    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      ttlMs: this.config.ttlMs,
      enabled: this.config.enabled,
      entries,
    };
  }
}

/**
 * Singleton search cache instance
 */
export const searchCache = new SearchCache();

/**
 * Create a timeout wrapper for async operations
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = 'Operation'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}

/**
 * Create a cancellable search controller
 */
export interface SearchController {
  /** Abort the search */
  abort: () => void;
  /** Check if aborted */
  isAborted: () => boolean;
  /** Get the abort signal */
  signal: AbortSignal;
}

/**
 * Create a new search controller for cancellation
 */
export function createSearchController(): SearchController {
  const controller = new AbortController();

  return {
    abort: () => controller.abort(),
    isAborted: () => controller.signal.aborted,
    signal: controller.signal,
  };
}
