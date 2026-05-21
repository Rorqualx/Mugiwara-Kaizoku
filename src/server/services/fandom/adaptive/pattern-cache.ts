/**
 * Pattern Cache for Fandom Wikis
 *
 * In-memory cache for discovered wiki patterns. Stores URL paths, structure types,
 * and extraction configs per domain to avoid repeated discovery.
 *
 * @module pattern-cache
 */

import { logger } from '@/utils/logger';

import { DEFAULT_CACHE_CONFIG, isCachedPattern } from './types';

import type { CachedPattern, PageStructure, PatternCacheConfig, StructureType } from './types';

/**
 * In-memory pattern cache with TTL and LRU eviction.
 */
export class PatternCache {
  private cache: Map<string, CachedPattern>;
  private config: PatternCacheConfig;

  constructor(config: Partial<PatternCacheConfig> = {}) {
    this.cache = new Map();
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  /**
   * Gets a cached pattern for a domain if it exists and is valid.
   *
   * @param domain - Wiki domain to look up
   * @returns Cached pattern or null if not found/expired
   */
  get(domain: string): CachedPattern | null {
    const normalizedDomain = this.normalizeDomain(domain);
    const entry = this.cache.get(normalizedDomain);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      logger.debug(`Cache expired for ${normalizedDomain}`);
      this.cache.delete(normalizedDomain);
      return null;
    }

    // Check if too many failures
    if (entry.failureCount >= this.config.failureThreshold) {
      logger.debug(`Cache invalidated due to failures for ${normalizedDomain}`);
      this.cache.delete(normalizedDomain);
      return null;
    }

    return entry;
  }

  /**
   * Stores a pattern in the cache.
   *
   * @param pattern - Pattern to cache
   */
  set(pattern: CachedPattern): void {
    const normalizedDomain = this.normalizeDomain(pattern.domain);

    // Enforce max size with LRU eviction
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(normalizedDomain, {
      ...pattern,
      domain: normalizedDomain,
    });

    logger.debug(`Cached pattern for ${normalizedDomain}`);
  }

  /**
   * Creates and stores a new cache entry from discovery results.
   *
   * @param domain - Wiki domain
   * @param urlPath - Discovered URL path
   * @param structureType - Detected structure type
   * @param pageStructure - Full page structure analysis
   * @param canonicalDomain - Canonical domain if redirected
   */
  cacheDiscovery(
    domain: string,
    urlPath: string,
    structureType: StructureType,
    pageStructure: PageStructure,
    canonicalDomain?: string
  ): void {
    const now = new Date();
    const pattern: CachedPattern = {
      domain: this.normalizeDomain(domain),
      urlPath,
      structureType,
      pageStructure,
      discoveredAt: now,
      lastUsedAt: now,
      successCount: 1,
      failureCount: 0,
    };

    if (canonicalDomain) {
      pattern.canonicalDomain = canonicalDomain;
    }

    this.set(pattern);
  }

  /**
   * Records a successful extraction for a domain.
   * Updates lastUsedAt and increments success count.
   *
   * @param domain - Wiki domain
   */
  recordSuccess(domain: string): void {
    const normalizedDomain = this.normalizeDomain(domain);
    const entry = this.cache.get(normalizedDomain);

    if (entry) {
      entry.lastUsedAt = new Date();
      entry.successCount++;
      logger.debug(`Recorded success for ${normalizedDomain} (count: ${entry.successCount})`);
    }
  }

  /**
   * Records a failed extraction for a domain.
   * Increments failure count; entry may be invalidated on next access.
   *
   * @param domain - Wiki domain
   */
  recordFailure(domain: string): void {
    const normalizedDomain = this.normalizeDomain(domain);
    const entry = this.cache.get(normalizedDomain);

    if (entry) {
      entry.failureCount++;
      logger.debug(`Recorded failure for ${normalizedDomain} (count: ${entry.failureCount})`);
    }
  }

  /**
   * Removes a pattern from the cache.
   *
   * @param domain - Wiki domain to remove
   */
  delete(domain: string): boolean {
    return this.cache.delete(this.normalizeDomain(domain));
  }

  /**
   * Clears all cached patterns.
   */
  clear(): void {
    this.cache.clear();
    logger.debug('Pattern cache cleared');
  }

  /**
   * Gets cache statistics.
   */
  getStats(): CacheStats {
    let totalSuccesses = 0;
    let totalFailures = 0;
    let expiredCount = 0;

    for (const entry of this.cache.values()) {
      totalSuccesses += entry.successCount;
      totalFailures += entry.failureCount;
      if (this.isExpired(entry)) {
        expiredCount++;
      }
    }

    const total = totalSuccesses + totalFailures;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      totalSuccesses,
      totalFailures,
      expiredCount,
      hitRate: total > 0 ? totalSuccesses / total : 0,
    };
  }

  /**
   * Gets all cached domains.
   */
  getCachedDomains(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Checks if a domain has a valid cached pattern.
   */
  has(domain: string): boolean {
    return this.get(domain) !== null;
  }

  /**
   * Exports cache data for persistence or debugging.
   */
  export(): CachedPattern[] {
    return Array.from(this.cache.values()).filter((entry) => !this.isExpired(entry));
  }

  /**
   * Imports cache data from persistence.
   */
  import(patterns: unknown[]): number {
    let imported = 0;

    for (const pattern of patterns) {
      const restored = this.restorePattern(pattern);
      if (restored) {
        this.set(restored);
        imported++;
      }
    }

    logger.info(`Imported ${imported} patterns into cache`);
    return imported;
  }

  /**
   * Restores a pattern from serialized data.
   */
  private restorePattern(pattern: unknown): CachedPattern | null {
    if (!isCachedPattern(pattern)) {
      return null;
    }

    const restored: CachedPattern = {
      ...pattern,
      discoveredAt: new Date(pattern.discoveredAt),
      lastUsedAt: new Date(pattern.lastUsedAt),
    };

    return this.isExpired(restored) ? null : restored;
  }

  /**
   * Normalizes domain for consistent cache keys.
   */
  private normalizeDomain(domain: string): string {
    return domain.toLowerCase().replace(/^www\./, '');
  }

  /**
   * Checks if a cache entry has expired.
   */
  private isExpired(entry: CachedPattern): boolean {
    const age = Date.now() - entry.discoveredAt.getTime();
    return age > this.config.ttlMs;
  }

  /**
   * Evicts the oldest entry (LRU).
   */
  private evictOldest(): void {
    let oldest: { key: string; date: Date } | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.lastUsedAt < oldest.date) {
        oldest = { key, date: entry.lastUsedAt };
      }
    }

    if (oldest) {
      this.cache.delete(oldest.key);
      logger.debug(`Evicted oldest cache entry: ${oldest.key}`);
    }
  }
}

/**
 * Cache statistics interface.
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  totalSuccesses: number;
  totalFailures: number;
  expiredCount: number;
  hitRate: number;
}

/**
 * Singleton cache instance for application-wide use.
 */
let globalCache: PatternCache | null = null;

/**
 * Gets the global pattern cache instance.
 * Creates one if it doesn't exist.
 */
export function getPatternCache(config?: Partial<PatternCacheConfig>): PatternCache {
  globalCache ??= new PatternCache(config);
  return globalCache;
}

/**
 * Resets the global cache (useful for testing).
 */
export function resetPatternCache(): void {
  globalCache?.clear();
  globalCache = null;
}
