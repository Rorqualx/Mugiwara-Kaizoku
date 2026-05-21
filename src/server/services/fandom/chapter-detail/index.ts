/**
 * ChapterDetailService - Main Service Aggregator
 *
 * Unified service that aggregates all chapter-detail modules into a cohesive,
 * backward-compatible API. Provides high-performance chapter scraping with
 * circuit breaker, caching, dynamic rate adjustment, and performance telemetry.
 *
 * Architecture:
 * - types.ts - Core type definitions (3 interfaces, 1 enum)
 * - constants.ts - Configuration constants (grouped configs)
 * - image-utils.ts - Image extraction utilities (3 functions)
 * - circuit-breaker.ts - Fault tolerance (CircuitBreaker class)
 * - performance-tracker.ts - Telemetry & rate adjustment (PerformanceTracker class)
 * - cache-config.ts - Cache factory (createChapterDetailCache function)
 * - core-fetcher.ts - Single chapter fetching (CoreChapterFetcher class)
 * - batch-processor.ts - Batch operations (BatchChapterProcessor class)
 *
 * Total: 8 modules, 1,572 lines (vs original 665-line monolith)
 *
 * Original: chapterDetailService.ts (665 lines, 10 TS errors, 9 ESLint warnings)
 * Refactored: 8 focused modules (0 errors, 0 warnings)
 *
 * @module chapter-detail
 */

import { logger } from '@/utils/logger';

// Import all modules
import { BatchChapterProcessor } from './batch-processor';
import { createChapterDetailCache } from './cache-config';
import { CircuitBreaker } from './circuit-breaker';
import { CIRCUIT_BREAKER_CONFIG } from './constants';
import { CoreChapterFetcher } from './core-fetcher';
import { PerformanceTracker } from './performance-tracker';

import type { ChapterDetail, BatchFetchOptions, PerformanceTelemetry } from './types';

/**
 * Main ChapterDetailService class
 *
 * Provides a unified interface for fetching chapter details from Fandom wikis.
 * Features:
 * - Circuit breaker pattern for fault tolerance
 * - Multi-tier caching (L1 memory + L2 persistent)
 * - Dynamic rate adjustment based on performance
 * - Comprehensive performance telemetry
 * - Batch processing with parallel execution
 *
 * @example
 * ```typescript
 * // Fetch single chapter
 * const detail = await chapterDetailService.fetchChapterDetails(url);
 *
 * // Fetch multiple chapters with progress tracking
 * const details = await chapterDetailService.fetchMultipleChapterDetails(
 *   urls,
 *   { onProgress: (completed, total) => console.log(`${completed}/${total}`) }
 * );
 *
 * // Get performance metrics
 * const metrics = chapterDetailService.getPerformanceMetrics();
 * ```
 */
export class ChapterDetailService {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly performanceTracker: PerformanceTracker;
  private readonly coreChapterFetcher: CoreChapterFetcher;
  private readonly batchChapterProcessor: BatchChapterProcessor;

  constructor() {
    logger.info('ChapterDetailService initialized with optimized settings:');
    logger.info('- Connection pooling: 150 max sockets, 50 keep-alive');
    logger.info('- Dynamic rate adjustment: 75 batch size, 50ms delay');
    logger.info(`- Circuit breaker: ${CIRCUIT_BREAKER_CONFIG.threshold} failure threshold, ${CIRCUIT_BREAKER_CONFIG.timeout}ms timeout`);
    logger.info('- Cache: Multi-tier with 24h TTL');

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker();

    // Initialize performance tracker
    this.performanceTracker = new PerformanceTracker();

    // Initialize cache service
    const cacheService = createChapterDetailCache();

    // Initialize core fetcher
    this.coreChapterFetcher = new CoreChapterFetcher(
      this.circuitBreaker
    );

    // Initialize batch processor
    this.batchChapterProcessor = new BatchChapterProcessor(
      (url: string) => this.coreChapterFetcher.fetchChapterDetails(url),
      this.performanceTracker,
      this.circuitBreaker,
      cacheService
    );
  }

  /**
   * Get current performance metrics
   *
   * Returns telemetry data from the most recent batch operation,
   * including response times, cache hit rates, throughput, and
   * circuit breaker statistics.
   *
   * @returns Performance telemetry or null if no operations have run
   *
   * @example
   * ```typescript
   * const metrics = service.getPerformanceMetrics();
   * if (metrics) {
   *   console.log(`Throughput: ${metrics.throughput} req/s`);
   *   console.log(`Cache hit rate: ${metrics.cacheHits / metrics.totalRequests * 100}%`);
   *   console.log(`Avg response: ${metrics.avgResponseTime}ms`);
   * }
   * ```
   */
  getPerformanceMetrics(): PerformanceTelemetry | null {
    return this.performanceTracker.getTelemetry();
  }

  /**
   * Fetch detailed information for a single chapter
   *
   * Attempts to retrieve chapter details from cache first, then fetches
   * from the source if not cached. Respects circuit breaker state to
   * prevent overwhelming failing services.
   *
   * @param chapterUrl - Full URL to the chapter page on Fandom wiki
   * @returns Chapter details or null if fetch fails or circuit is open
   *
   * @example
   * ```typescript
   * const detail = await service.fetchChapterDetails(
   *   'https://fireforce.fandom.com/wiki/Chapter_0'
   * );
   * if (detail) {
   *   console.log(`Found: ${detail.title} - ${detail.coverImageUrl}`);
   * }
   * ```
   */
  async fetchChapterDetails(chapterUrl: string): Promise<ChapterDetail | null> {
    return this.coreChapterFetcher.fetchChapterDetails(chapterUrl);
  }

  /**
   * Fetch multiple chapter details with optimized batch processing
   *
   * Simplified interface for batch fetching with sensible defaults.
   * Uses dynamic rate adjustment and parallel execution for maximum
   * performance while respecting server limits.
   *
   * @param chapterUrls - Array of chapter URLs to fetch
   * @param options - Optional configuration
   * @param options.onProgress - Progress callback (completed, total)
   * @returns Array of successfully fetched chapter details
   *
   * @example
   * ```typescript
   * const urls = [
   *   'https://fireforce.fandom.com/wiki/Chapter_0',
   *   'https://fireforce.fandom.com/wiki/Chapter_1',
   * ];
   * const details = await service.fetchMultipleChapterDetails(urls, {
   *   onProgress: (completed, total) => {
   *     console.log(`Progress: ${completed}/${total}`);
   *   }
   * });
   * ```
   */
  async fetchMultipleChapterDetails(
    chapterUrls: string[],
    options?: { onProgress?: (completed: number, total: number) => void }
  ): Promise<ChapterDetail[]> {
    return this.batchChapterProcessor.batchFetchChapterDetails(chapterUrls, {
      batchSize: 75,  // Optimal balance for performance
      delayMs: 50,    // Minimal delay for maximum throughput
      maxRetries: 3,
      ...(options?.onProgress ? { onProgress: options.onProgress } : {})
    });
  }

  /**
   * Batch fetch chapter details with advanced configuration
   *
   * Full-featured batch fetching with customizable batch size, delays,
   * retries, and progress tracking. Automatically adjusts rate based on
   * server performance and error rates.
   *
   * @param chapterUrls - Array of chapter URLs to fetch
   * @param options - Batch fetch configuration
   * @param options.batchSize - Number of concurrent requests per batch (default: dynamic 75)
   * @param options.delayMs - Delay between batches in milliseconds (default: dynamic 50ms)
   * @param options.maxRetries - Maximum retry attempts per URL (default: 3)
   * @param options.onProgress - Progress callback (completed, total)
   * @returns Array of successfully fetched chapter details
   *
   * @example
   * ```typescript
   * const details = await service.batchFetchChapterDetails(urls, {
   *   batchSize: 50,
   *   delayMs: 100,
   *   maxRetries: 5,
   *   onProgress: (completed, total) => {
   *     console.log(`${completed}/${total} completed`);
   *   }
   * });
   * ```
   */
  async batchFetchChapterDetails(
    chapterUrls: string[],
    options: BatchFetchOptions = {}
  ): Promise<ChapterDetail[]> {
    return this.batchChapterProcessor.batchFetchChapterDetails(
      chapterUrls,
      options
    );
  }
}

/**
 * Singleton service instance
 *
 * Pre-configured ChapterDetailService ready for use throughout the application.
 * Use this singleton to ensure consistent caching and circuit breaker state.
 *
 * @example
 * ```typescript
 * import { chapterDetailService } from '@/server/services/fandom/chapter-detail';
 *
 * const detail = await chapterDetailService.fetchChapterDetails(url);
 * ```
 */
export const chapterDetailService = new ChapterDetailService();

// Re-export types for consumers
export type {
  ChapterDetail,
  BatchFetchOptions,
  PerformanceTelemetry
} from './types';

export { CircuitState } from './types';
