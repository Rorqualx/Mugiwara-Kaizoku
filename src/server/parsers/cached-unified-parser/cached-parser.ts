/**
 * Cached Unified Parser - Core Implementation
 *
 * Main CachedUnifiedParser class with PostgreSQL caching support.
 * ML enhancement methods are in ml-enhancement.ts.
 *
 * Extracted from: CachedUnifiedParser.ts
 */

import { logger } from '@/utils/logger';

import { PostgresCacheProvider } from '../cache/PostgresCacheProvider';
import { PatternRecognitionEngine } from '../pattern-recognition/core/PatternRecognitionEngine';
import { UnifiedMetadataParser } from '../UnifiedMetadataParser';

import {
  initializeMLEngine as initMLEngine,
  shouldUseML as checkShouldUseML,
  enhanceWithML as performMLEnhancement,
  getMLMetrics as getMLMetricsImpl,
  trainWithFeedback as performTrainWithFeedback
} from './ml-enhancement';
import { isRecord, chunk, groupByNamespace } from './utils';

import type { NormalizedMangaData } from '../core/DataNormalizer';
import type { ParseOptions, ParsedContent } from '../UnifiedMetadataParser';
import type { CachedParseOptions, CacheMetrics, MLMetrics } from './types';


// ============================================================================
// Cached Parser Implementation
// ============================================================================

export class CachedUnifiedParser extends UnifiedMetadataParser {
  private static instance: CachedUnifiedParser | undefined;
  private cache: PostgresCacheProvider;
  private metrics: CacheMetrics;
  private parseTimeHistory: number[] = [];
  private cacheTimeHistory: number[] = [];
  private cleanupTimer: NodeJS.Timeout | null = null;
  private mlEngine?: PatternRecognitionEngine;
  private mlMetrics: MLMetrics = {
    predictions: 0,
    correctPredictions: 0,
    avgConfidence: 0,
    avgInferenceTime: 0
  };

  constructor(cache?: PostgresCacheProvider) {
    super();
    this.cache = cache ?? new PostgresCacheProvider();
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgParseTime: 0,
      avgCacheTime: 0,
      totalSize: 0
    };

    // Initialize ML engine if enabled
    void this.initializeMLEngine();

    // Initialize cache cleanup schedule
    this.scheduleCleanup();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CachedUnifiedParser {
    CachedUnifiedParser.instance ??= new CachedUnifiedParser();
    return CachedUnifiedParser.instance;
  }

  /**
   * Main parse method for URL or HTML content
   */
  async parse(
    urlOrHtml: string,
    options: CachedParseOptions = {}
  ): Promise<unknown> {
    // If HTML is provided directly in options
    if (options.html) {
      return this.parseHTMLAsync(options.html, options);
    }

    // Check if input is HTML string (starts with < or contains HTML tags)
    if (urlOrHtml.trim().startsWith('<') || /<[^>]+>/.test(urlOrHtml)) {
      return this.parseHTMLAsync(urlOrHtml, options);
    }

    // Otherwise treat as URL
    return this.parseUnified(urlOrHtml, options);
  }

  /**
   * Clear the entire cache
   */
  clearCache(): void {
    // Clear in-memory cache if any
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgParseTime: 0,
      avgCacheTime: 0,
      totalSize: 0
    };
    this.parseTimeHistory = [];
    this.cacheTimeHistory = [];
  }

  /**
   * Get cache key for a given input (public for testing)
   */
  getCacheKey(input: string, options: CachedParseOptions = {}): string {
    return this.generateCacheKey(input, options);
  }

  /**
   * Parse with caching support
   */
  override async parseUnified(
    htmlOrUrl: string,
    options: CachedParseOptions = {}
  ): Promise<NormalizedMangaData> {
    const startTime = Date.now();

    // Default options
    const useCache = options.useCache !== false;
    const forceRefresh = options.forceRefresh ?? false;
    const cacheTTL = options.cacheTTL ?? 86400; // 24 hours
    const cacheNamespace = options.cacheNamespace ?? this.detectNamespace(htmlOrUrl, options);

    // Generate cache key
    const cacheKey = this.generateCacheKey(htmlOrUrl, options);

    // Try cache if enabled and not forcing refresh
    if (useCache && !forceRefresh) {
      const cached = await this.cache.get(cacheKey, cacheNamespace);
      if (cached !== null && cached !== undefined) {
        this.recordCacheHit(Date.now() - startTime);
        // Type guard: verify cached data is NormalizedMangaData
        if (
          isRecord(cached) &&
          typeof cached['title'] === 'string' &&
          typeof cached['status'] === 'string' &&
          Array.isArray(cached['volumes']) &&
          Array.isArray(cached['chapters']) &&
          typeof cached['source'] === 'string'
        ) {
          return cached as unknown as NormalizedMangaData;
        }
      }
    }

    // Parse fresh data
    this.recordCacheMiss();
    const parseStartTime = Date.now();

    let result = await super.parseUnified(htmlOrUrl, options);

    // Apply ML enhancement if enabled
    if (this.shouldUseML(options)) {
      result = await this.enhanceWithML(result, htmlOrUrl, options) as typeof result;
    }

    const parseTime = Date.now() - parseStartTime;
    this.recordParseTime(parseTime);

    // Store in cache if enabled
    if (useCache) {
      await this.cache.set(cacheKey, result, {
        ttl: cacheTTL,
        namespace: cacheNamespace,
        compress: true
      });
    }

    return result;
  }

  /**
   * Parse HTML with caching - synchronous to match parent
   */
  parseHTML(
    html: string,
    options: CachedParseOptions = {}
  ): ParsedContent {
    // For caching, we need to use a separate async method
    return super.parseHTML(html, options);
  }

  /**
   * Parse HTML with async caching
   */
  async parseHTMLAsync(
    html: string,
    options: CachedParseOptions = {}
  ): Promise<ParsedContent> {
    const cacheKey = this.generateCacheKey(html, options);
    const namespace = options.cacheNamespace ?? 'unified-parser';

    if (options.useCache !== false && !options.forceRefresh) {
      const cached = await this.cache.get(cacheKey, namespace);
      if (cached !== null && cached !== undefined) {
        this.updateMetrics(true, 0);
        // Type guard: verify cached data has required ParsedContent properties
        if (
          isRecord(cached) &&
          Array.isArray(cached['volumes']) &&
          Array.isArray(cached['chapters']) &&
          isRecord(cached['metadata']) &&
          Array.isArray(cached['images']) &&
          Array.isArray(cached['tables'])
        ) {
          return cached as unknown as ParsedContent;
        }
      }
    }

    const startTime = Date.now();
    const result = super.parseHTML(html, options);
    const parseTime = Date.now() - startTime;

    if (options.useCache !== false) {
      await this.cache.set(cacheKey, result, {
        namespace,
        ttl: options.cacheTTL ?? 86400
      });
    }

    this.updateMetrics(false, parseTime);
    return result;
  }

  /**
   * Batch parse multiple URLs/HTML with optimized caching
   */
  async parseBatch(
    inputs: Array<{ input: string; options?: CachedParseOptions }>,
    batchOptions: {
      concurrency?: number;
      useCache?: boolean;
      warmCache?: boolean;
    } = {}
  ): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    const concurrency = batchOptions.concurrency ?? 5;
    const useCache = batchOptions.useCache !== false;

    // Generate cache keys for all inputs
    const cacheKeys = inputs.map(({ input, options }) => ({
      key: this.generateCacheKey(input, options ?? {}),
      namespace: this.detectNamespace(input, options ?? {}),
      input,
      options
    }));

    // Batch get from cache
    if (useCache) {
      const namespaceGroups = groupByNamespace(cacheKeys);

      for (const [namespace, group] of namespaceGroups) {
        const keys = group.map(item => item.key);
        // Get items individually (getBatch not implemented yet)
        const cached = new Map<string, unknown>();
        for (const key of keys) {
          // eslint-disable-next-line no-await-in-loop -- Intentional: cache operations must be sequential per namespace
          const value = await this.cache.get(key, namespace);
          if (value) cached.set(key, value);
        }

        for (const item of group) {
          const cachedData = cached.get(item.key);
          if (cachedData) {
            results.set(item.input, cachedData);
            this.metrics.hits++;
          }
        }
      }
    }

    // Process uncached items
    const uncached = cacheKeys.filter(item => !results.has(item.input));

    if (uncached.length > 0) {
      // Process in batches with concurrency limit
      const batches = chunk(uncached, concurrency);

      for (const batch of batches) {
        const promises = batch.map(async item => {
          const result = await this.parseUnified(item.input, {
            ...item.options,
            useCache: false // Already checked cache
          });

          results.set(item.input, result);

          // Store in cache
          if (useCache) {
            await this.cache.set(item.key, result, {
              namespace: item.namespace,
              ttl: item.options?.cacheTTL ?? 86400
            });
          }

          return result;
        });

        // eslint-disable-next-line no-await-in-loop -- Intentional: batches must complete sequentially for rate limiting
        await Promise.all(promises);
      }
    }

    // Warm cache if requested
    if (batchOptions.warmCache && uncached.length > 0) {
      await this.warmCache(uncached.map(item => ({
        ...item,
        options: item.options ?? {}
      })));
    }

    return results;
  }

  /**
   * Prefetch and cache URLs for future use
   */
  async prefetch(
    urls: string[],
    options: CachedParseOptions = {}
  ): Promise<void> {
    const inputs = urls.map(url => ({ input: url, options }));
    await this.parseBatch(inputs, { warmCache: true });
  }

  /**
   * Invalidate cache for specific inputs
   */
  async invalidate(
    patterns: string | string[] | { namespace?: string; pattern?: string }
  ): Promise<number> {
    if (typeof patterns === 'string') {
      const key = this.generateCacheKey(patterns, {});
      await this.cache.delete(key);
      return 1;
    } else if (Array.isArray(patterns)) {
      let count = 0;
      for (const pattern of patterns) {
        const key = this.generateCacheKey(pattern, {});
        // eslint-disable-next-line no-await-in-loop -- Intentional: cache deletions must be tracked sequentially
        if (await this.cache.delete(key)) count++;
      }
      return count;
    } else {
      return this.cache.clear(patterns);
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;

    // Calculate averages
    if (this.parseTimeHistory.length > 0) {
      this.metrics.avgParseTime =
        this.parseTimeHistory.reduce((a, b) => a + b, 0) / this.parseTimeHistory.length;
    }

    if (this.cacheTimeHistory.length > 0) {
      this.metrics.avgCacheTime =
        this.cacheTimeHistory.reduce((a, b) => a + b, 0) / this.cacheTimeHistory.length;
    }

    return { ...this.metrics };
  }

  /**
   * Get detailed cache statistics
   */
  getCacheStats(): Record<string, unknown> {
    return this.cache.getStats() as unknown as Record<string, unknown>;
  }

  /**
   * Train with feedback for ML improvement
   */
  async trainWithFeedback(
    urlOrHtml: string,
    correctResult: unknown,
    feedback?: string
  ): Promise<void> {
    await performTrainWithFeedback({
      urlOrHtml,
      correctResult,
      feedback,
      mlEngine: this.mlEngine,
      cache: this.cache,
      generateCacheKey: (input: string, opts: CachedParseOptions) => this.generateCacheKey(input, opts)
    });
  }

  /**
   * Get ML metrics
   */
  public getMLMetrics(): { patterns: number; accuracy: number; confidence: number } | null {
    return getMLMetricsImpl(this.mlMetrics);
  }

  /**
   * Warm cache with common manga titles
   */
  async warmCache(
    items?: Array<{ key: string; namespace: string; input: string; options?: CachedParseOptions }>
  ): Promise<void> {
    // Default warm-up with popular manga
    const defaultItems = items ?? [
      { title: 'One Piece', url: 'https://onepiece.fandom.com/wiki/One_Piece' },
      { title: 'Naruto', url: 'https://naruto.fandom.com/wiki/Naruto' },
      { title: 'Bleach', url: 'https://bleach.fandom.com/wiki/Bleach' },
      { title: 'Dragon Ball', url: 'https://dragonball.fandom.com/wiki/Dragon_Ball' },
      { title: 'Attack on Titan', url: 'https://attackontitan.fandom.com/wiki/Attack_on_Titan' }
    ].map(item => ({
      key: this.generateCacheKey(item.url, {}),
      namespace: 'fandom',
      input: item.url,
      options: {}
    }));

    const warmupItems = items ?? defaultItems;

    // Parse and cache in parallel
    const promises = warmupItems.map(async item => {
      try {
        await this.parseUnified(item.input, {
          ...item.options,
          useCache: true,
          forceRefresh: true
        });
      } catch (error: unknown) {
        logger.error(`[CachedUnifiedParser] Failed to warm cache for ${item.input}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Cleanup and disconnect
   */
  disconnect(): void {
    // Clear cleanup interval
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Cleanup ML engine
    if (this.mlEngine) {
      // PatternRecognitionEngine doesn't have cleanup method
      // Just clear the reference by deleting the property
      delete (this as unknown as { mlEngine?: PatternRecognitionEngine }).mlEngine;
    }

    // Cache provider doesn't need explicit disconnect
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initialize ML pattern recognition engine
   */
  private async initializeMLEngine(): Promise<void> {
    const engine = await initMLEngine(this.mlEngine);
    if (engine) {
      this.mlEngine = engine;
    }
  }

  /**
   * Check if ML should be used for parsing
   */
  private shouldUseML(options: CachedParseOptions): boolean {
    return checkShouldUseML(options, this.mlEngine);
  }

  /**
   * Enhance parsed result with ML predictions
   */
  private async enhanceWithML(
    result: unknown,
    htmlOrUrl: string,
    options: CachedParseOptions
  ): Promise<unknown> {
    return performMLEnhancement(result, htmlOrUrl, options, this.mlEngine, this.mlMetrics);
  }

  /**
   * Update metrics
   */
  private updateMetrics(cacheHit: boolean, parseTime: number): void {
    if (cacheHit) {
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
      this.parseTimeHistory.push(parseTime);
      // Keep history limited
      if (this.parseTimeHistory.length > 100) {
        this.parseTimeHistory.shift();
      }
    }
  }

  /**
   * Generate cache key from input and options
   */
  private generateCacheKey(input: string, options: ParseOptions): string {
    const keyData = {
      input,
      source: options['source'],
      followLinks: options.followLinks,
      maxDepth: options.maxDepth,
      extractImages: options.extractImages
    };

    return this.cache.generateKey(keyData);
  }

  /**
   * Detect namespace from input
   */
  private detectNamespace(input: string, options: ParseOptions): string {
    if (options['source']) {
      return options['source'];
    }

    if (input.includes('fandom.com')) {
      return 'fandom';
    } else if (input.includes('wikipedia.org')) {
      return 'wikipedia';
    } else if (input.includes('mangadex')) {
      return 'mangadex';
    } else if (input.includes('anilist')) {
      return 'anilist';
    }

    return 'generic';
  }

  /**
   * Record cache hit
   */
  private recordCacheHit(responseTime: number): void {
    this.metrics.hits++;
    this.cacheTimeHistory.push(responseTime);

    // Keep only last 100 entries
    if (this.cacheTimeHistory.length > 100) {
      this.cacheTimeHistory.shift();
    }
  }

  /**
   * Record cache miss
   */
  private recordCacheMiss(): void {
    this.metrics.misses++;
  }

  /**
   * Record parse time
   */
  private recordParseTime(time: number): void {
    this.parseTimeHistory.push(time);

    // Keep only last 100 entries
    if (this.parseTimeHistory.length > 100) {
      this.parseTimeHistory.shift();
    }
  }

  /**
   * Schedule periodic cache cleanup
   */
  private scheduleCleanup(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    // Run cleanup every hour
    this.cleanupTimer = setInterval(() => {
      void (async () => {
        try {
          const deleted = await this.cache.cleanup();
          logger.info(`Cache cleanup: removed ${deleted} expired entries`);
        } catch (error: unknown) {
          logger.error('[CachedUnifiedParser] Cache cleanup error:', error);
        }
      })();
    }, 3600000); // 1 hour
  }
}
