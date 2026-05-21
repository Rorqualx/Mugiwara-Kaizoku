/**
 * Wikipedia Pattern Cache
 *
 * Caches successful Wikipedia URL patterns and page structures
 * to avoid repeated discovery for known manga titles.
 *
 * @module wikipedia/adaptive/pattern-cache
 */

/* eslint-disable no-param-reassign -- Cache intentionally mutates cached pattern objects */

import { logger } from '@/utils/logger';

import {
  type WikipediaCachedPattern,
  type PatternCacheConfig,
  type PatternCacheStats,
  type WikipediaPageType,
  type WikipediaParserType,
  type WikipediaStructureAnalysis,
  WikipediaStructureType,
  DEFAULT_CACHE_CONFIG,
} from './types';
import { getNormalizedCacheKey } from './url-discoverer';

import type { WikipediaMangaData, WikipediaVolume } from '../wikipedia/types';

// ============================================================================
// Cache Implementation
// ============================================================================

/**
 * LRU cache for Wikipedia patterns.
 */
class WikipediaPatternCache {
  private cache: Map<string, WikipediaCachedPattern>;
  private config: PatternCacheConfig;
  private stats: PatternCacheStats;

  constructor(config: Partial<PatternCacheConfig> = {}) {
    this.cache = new Map();
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.stats = createEmptyStats();
  }

  /**
   * Get a cached pattern by title or URL.
   */
  get(titleOrUrl: string): WikipediaCachedPattern | null {
    const key = getNormalizedCacheKey(titleOrUrl);
    const pattern = this.cache.get(key);

    if (!pattern) {
      return this.handleCacheMiss();
    }

    if (this.shouldRemovePattern(pattern, key)) {
      return this.handleCacheMiss();
    }

    return this.handleCacheHit(pattern, key);
  }

  /**
   * Set a cached pattern.
   */
  // eslint-disable-next-line max-params -- Cache set requires all pattern fields
  set(
    titleOrUrl: string,
    listPagePath: string | null,
    mainPagePath: string | null,
    pageType: WikipediaPageType,
    structureType: WikipediaStructureType,
    recommendedParser: WikipediaParserType
  ): void {
    const key = getNormalizedCacheKey(titleOrUrl);
    this.ensureCapacity(key);

    const pattern = createPattern(
      titleOrUrl,
      key,
      listPagePath,
      mainPagePath,
      pageType,
      structureType,
      recommendedParser
    );

    this.cache.set(key, pattern);
    this.updateStats();

    logger.debug('[WikipediaCache] Pattern cached', { key, pageType, structureType });
  }

  /**
   * Record a successful extraction.
   */
  recordSuccess(titleOrUrl: string): void {
    const key = getNormalizedCacheKey(titleOrUrl);
    const pattern = this.cache.get(key);

    if (pattern) {
      pattern.successCount++;
      pattern.lastUsedAt = new Date();
    }
  }

  /**
   * Record a failed extraction.
   */
  recordFailure(titleOrUrl: string): void {
    const key = getNormalizedCacheKey(titleOrUrl);
    const pattern = this.cache.get(key);

    if (!pattern) return;

    pattern.failureCount++;
    pattern.lastUsedAt = new Date();

    if (pattern.failureCount >= this.config.failureThreshold) {
      this.invalidatePattern(key, pattern.failureCount);
    }
  }

  // ============================================================================
  // Extended Cache Methods (Phase 2 Optimization)
  // ============================================================================

  /**
   * Set a cached pattern with full extraction data.
   * Stores analysis results and extracted data for complete cache hits.
   */
  // eslint-disable-next-line max-params -- Cache set with data requires pattern fields + options
  setWithData(
    titleOrUrl: string,
    listPagePath: string | null,
    mainPagePath: string | null,
    pageType: WikipediaPageType,
    structureType: WikipediaStructureType,
    recommendedParser: WikipediaParserType,
    options: {
      analysis?: WikipediaStructureAnalysis;
      extractedVolumes?: WikipediaVolume[];
      extractedChapters?: number;
      extractedMetadata?: Partial<WikipediaMangaData>;
      urlExistsMap?: Record<string, boolean>;
      pageSize?: number;
    } = {}
  ): void {
    const key = getNormalizedCacheKey(titleOrUrl);
    this.ensureCapacity(key);

    const now = new Date();

    // Build base pattern
    const pattern: WikipediaCachedPattern = {
      title: titleOrUrl,
      normalizedTitle: key,
      listPagePath,
      mainPagePath,
      pageType,
      structureType,
      recommendedParser,
      discoveredAt: now,
      lastUsedAt: now,
      successCount: 1,
      failureCount: 0,
    };

    // Add extended fields only if they have values (exactOptionalPropertyTypes)
    if (options.analysis) pattern.analysis = options.analysis;
    if (options.extractedVolumes) pattern.extractedVolumes = options.extractedVolumes;
    if (options.extractedChapters !== undefined) pattern.extractedChapters = options.extractedChapters;
    if (options.extractedMetadata) pattern.extractedMetadata = options.extractedMetadata;
    if (options.urlExistsMap) pattern.urlExistsMap = options.urlExistsMap;
    if (options.pageSize !== undefined) pattern.pageSize = options.pageSize;
    pattern.lastFetchedAt = now;

    this.cache.set(key, pattern);
    this.updateStats();

    logger.debug('[WikipediaCache] Pattern cached with data', {
      key,
      pageType,
      structureType,
      hasAnalysis: !!options.analysis,
      volumeCount: options.extractedVolumes?.length ?? 0,
      chapterCount: options.extractedChapters ?? 0,
    });
  }

  /**
   * Get cached extraction data if available.
   * Returns null if no cached data or data is stale.
   */
  getExtractedData(titleOrUrl: string): {
    volumes: WikipediaVolume[];
    chapters: number;
    metadata: Partial<WikipediaMangaData> | undefined;
  } | null {
    const pattern = this.get(titleOrUrl);
    if (!pattern) return null;

    // Check if we have extraction data
    if (!pattern.extractedVolumes && !pattern.extractedChapters && !pattern.extractedMetadata) {
      return null;
    }

    return {
      volumes: pattern.extractedVolumes ?? [],
      chapters: pattern.extractedChapters ?? 0,
      metadata: pattern.extractedMetadata,
    };
  }

  /**
   * Check if cache has valid extraction data (not just URL patterns).
   */
  hasValidExtraction(titleOrUrl: string): boolean {
    const pattern = this.get(titleOrUrl);
    if (!pattern) return false;

    // Must have volumes or chapters to be considered valid extraction
    const hasVolumes = (pattern.extractedVolumes?.length ?? 0) > 0;
    const hasChapters = (pattern.extractedChapters ?? 0) > 0;

    return hasVolumes || hasChapters;
  }

  /**
   * Update URL existence map for a cached pattern.
   * Used to remember which URLs returned 404s.
   */
  updateUrlExistsMap(titleOrUrl: string, urlExistsMap: Record<string, boolean>): void {
    const key = getNormalizedCacheKey(titleOrUrl);
    const pattern = this.cache.get(key);

    if (pattern) {
      pattern.urlExistsMap = { ...pattern.urlExistsMap, ...urlExistsMap };
      pattern.lastUsedAt = new Date();
    }
  }

  /**
   * Get URL existence map for a title.
   * Returns cached knowledge about which URLs exist/don't exist.
   */
  getUrlExistsMap(titleOrUrl: string): Record<string, boolean> | null {
    const pattern = this.get(titleOrUrl);
    return pattern?.urlExistsMap ?? null;
  }

  /**
   * Update extraction data for an existing pattern.
   */
  updateExtractionData(
    titleOrUrl: string,
    data: {
      volumes?: WikipediaVolume[];
      chapters?: number;
      metadata?: Partial<WikipediaMangaData>;
      analysis?: WikipediaStructureAnalysis;
    }
  ): void {
    const key = getNormalizedCacheKey(titleOrUrl);
    const pattern = this.cache.get(key);

    if (pattern) {
      if (data.volumes) pattern.extractedVolumes = data.volumes;
      if (data.chapters !== undefined) pattern.extractedChapters = data.chapters;
      if (data.metadata) pattern.extractedMetadata = { ...pattern.extractedMetadata, ...data.metadata };
      if (data.analysis) pattern.analysis = data.analysis;
      pattern.lastFetchedAt = new Date();
      pattern.lastUsedAt = new Date();
    }
  }

  /**
   * Clear all cached patterns.
   */
  clear(): void {
    this.cache.clear();
    this.stats = createEmptyStats();
    logger.info('[WikipediaCache] Cache cleared');
  }

  /**
   * Get cache statistics.
   */
  getStats(): PatternCacheStats {
    return { ...this.stats };
  }

  /**
   * Get current cache size.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if cache has a pattern.
   */
  has(titleOrUrl: string): boolean {
    const key = getNormalizedCacheKey(titleOrUrl);
    const pattern = this.cache.get(key);

    if (!pattern) return false;
    if (this.isExpired(pattern)) return false;
    if (this.isInvalidated(pattern)) return false;

    return true;
  }

  /**
   * Remove a specific pattern.
   */
  delete(titleOrUrl: string): boolean {
    const key = getNormalizedCacheKey(titleOrUrl);
    const deleted = this.cache.delete(key);
    if (deleted) this.updateStats();
    return deleted;
  }

  /**
   * Get all cached keys.
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleCacheMiss(): null {
    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  private handleCacheHit(pattern: WikipediaCachedPattern, key: string): WikipediaCachedPattern {
    pattern.lastUsedAt = new Date();
    this.stats.hits++;
    this.updateHitRate();
    logger.debug('[WikipediaCache] Cache hit', { key, title: pattern.title });
    return pattern;
  }

  private shouldRemovePattern(pattern: WikipediaCachedPattern, key: string): boolean {
    if (this.isExpired(pattern)) {
      this.cache.delete(key);
      this.stats.expiredCount++;
      this.updateStats();
      return true;
    }

    if (this.isInvalidated(pattern)) {
      this.cache.delete(key);
      this.updateStats();
      return true;
    }

    return false;
  }

  private ensureCapacity(key: string): void {
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
  }

  private invalidatePattern(key: string, failureCount: number): void {
    logger.warn('[WikipediaCache] Pattern invalidated due to failures', { key, failureCount });
    this.cache.delete(key);
    this.updateStats();
  }

  private isExpired(pattern: WikipediaCachedPattern): boolean {
    const now = Date.now();
    const discoveredAt = pattern.discoveredAt.getTime();
    return now - discoveredAt > this.config.ttlMs;
  }

  private isInvalidated(pattern: WikipediaCachedPattern): boolean {
    return pattern.failureCount >= this.config.failureThreshold;
  }

  private evictLRU(): void {
    const oldestKey = this.findOldestKey();
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictedCount++;
      logger.debug('[WikipediaCache] Evicted LRU pattern', { key: oldestKey });
    }
  }

  private findOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, pattern] of this.cache.entries()) {
      const time = pattern.lastUsedAt.getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function createEmptyStats(): PatternCacheStats {
  return {
    size: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    expiredCount: 0,
    evictedCount: 0,
  };
}

// eslint-disable-next-line max-params -- Pattern creation requires all identifying fields
function createPattern(
  titleOrUrl: string,
  key: string,
  listPagePath: string | null,
  mainPagePath: string | null,
  pageType: WikipediaPageType,
  structureType: WikipediaStructureType,
  recommendedParser: WikipediaParserType
): WikipediaCachedPattern {
  const now = new Date();
  return {
    title: titleOrUrl,
    normalizedTitle: key,
    listPagePath,
    mainPagePath,
    pageType,
    structureType,
    recommendedParser,
    discoveredAt: now,
    lastUsedAt: now,
    successCount: 1,
    failureCount: 0,
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let cacheInstance: WikipediaPatternCache | null = null;

/**
 * Get the Wikipedia pattern cache singleton.
 */
export function getWikipediaCache(
  config?: Partial<PatternCacheConfig>
): WikipediaPatternCache {
  cacheInstance ??= new WikipediaPatternCache(config);
  return cacheInstance;
}

/**
 * Reset the cache singleton (for testing).
 */
export function resetWikipediaCache(): void {
  if (cacheInstance) {
    cacheInstance.clear();
    cacheInstance = null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a cache entry from discovery and analysis results.
 */
// eslint-disable-next-line max-params -- Cache entry creation requires all pattern fields
export function createCacheEntry(
  titleOrUrl: string,
  listPagePath: string | null,
  mainPagePath: string | null,
  pageType: WikipediaPageType,
  structureType: WikipediaStructureType,
  recommendedParser: WikipediaParserType
): WikipediaCachedPattern {
  const key = getNormalizedCacheKey(titleOrUrl);
  return createPattern(
    titleOrUrl,
    key,
    listPagePath,
    mainPagePath,
    pageType,
    structureType,
    recommendedParser
  );
}

/**
 * Warm up the cache with known patterns.
 */
export async function warmCache(
  titles: string[],
  discoverFn: (title: string) => Promise<{
    listPagePath: string | null;
    mainPagePath: string | null;
    pageType: WikipediaPageType;
  }>
): Promise<number> {
  const cache = getWikipediaCache();
  let warmed = 0;

  for (const title of titles) {
    if (cache.has(title)) continue;

    // eslint-disable-next-line no-await-in-loop -- Sequential cache warming to avoid overwhelming Wikipedia API
    const result = await warmSingleEntry(title, discoverFn, cache);
    if (result) warmed++;
  }

  logger.info('[WikipediaCache] Cache warming complete', {
    requested: titles.length,
    warmed,
    total: cache.size(),
  });

  return warmed;
}

async function warmSingleEntry(
  title: string,
  discoverFn: (title: string) => Promise<{
    listPagePath: string | null;
    mainPagePath: string | null;
    pageType: WikipediaPageType;
  }>,
  cache: WikipediaPatternCache
): Promise<boolean> {
  try {
    const result = await discoverFn(title);
    cache.set(
      title,
      result.listPagePath,
      result.mainPagePath,
      result.pageType,
      WikipediaStructureType.UNKNOWN,
      'combined'
    );
    return true;
  } catch (error) {
    logger.warn('[WikipediaCache] Failed to warm cache entry', {
      title,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
