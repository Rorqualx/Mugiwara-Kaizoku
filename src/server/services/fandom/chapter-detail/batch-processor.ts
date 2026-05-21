/**
 * Chapter Detail Batch Processor
 *
 * Handles batch fetching of chapter details with parallel processing,
 * retry logic, performance tracking, and dynamic rate adjustment.
 *
 * Features:
 * - Bulk cache checking upfront (reduces round trips)
 * - Parallel processing with Promise.allSettled
 * - Exponential backoff retry logic
 * - Performance tracking and metrics
 * - Dynamic rate adjustment based on server response
 * - Progress reporting
 *
 * ESLint Metrics:
 * - max-statements: <45 (down from 72)
 * - complexity: <18 (down from 26)
 * - max-depth: ≤4 (down from 5)
 * - no-non-null-assertion: 0 (down from 7)
 *
 * @module chapter-detail/batch-processor
 */

import { MultiTierCache } from '@/server/services/comicvine/modules/multiTierCache';
import { BatchPerformanceTracker } from '@/server/utils/performanceTimer';
import { logger } from '@/utils/logger';

import { CircuitBreaker } from './circuit-breaker';
import { PerformanceTracker } from './performance-tracker';

import type { ChapterDetail, BatchFetchOptions } from './types';

// ============================================================================
// Helper Functions (Private)
// ============================================================================

/**
 * Process cache checks for all URLs using batch lookup.
 *
 * Uses getMany() for a single DB query instead of N individual queries.
 * Separates cached results from uncached URLs that need fetching.
 */
async function processCacheChecks(
  urls: string[],
  cacheService: MultiTierCache<ChapterDetail>
): Promise<{
  cached: ChapterDetail[];
  uncached: string[];
}> {
  const hitMap = await cacheService.getMany(urls);

  const cached: ChapterDetail[] = [];
  const uncached: string[] = [];

  for (const url of urls) {
    const result = hitMap.get(url);
    if (result) {
      cached.push({ ...result, fromCache: true } as ChapterDetail);
    } else {
      uncached.push(url);
    }
  }

  return { cached, uncached };
}

/**
 * Result types for fetch operations
 */
interface FetchSuccessResult {
  status: 'success';
  data: ChapterDetail;
  url: string;
}

interface FetchErrorResult {
  status: 'error';
  error: string;
  url: string;
}

type FetchResult = FetchSuccessResult | FetchErrorResult;

/**
 * Fetch chapter detail with retry logic
 *
 * Implements exponential backoff retry strategy (500ms, 1s, 2s).
 * Returns null if all retries fail or no data is returned.
 *
 * @param url - Chapter URL to fetch
 * @param fetcher - Core fetch function
 * @param circuitBreaker - Circuit breaker instance
 * @param maxRetries - Maximum retry attempts
 * @returns Fetch result (success or error)
 */
async function fetchWithRetry(
  url: string,
  fetcher: (url: string) => Promise<ChapterDetail | null>,
  circuitBreaker: CircuitBreaker,
  maxRetries: number
): Promise<FetchResult> {
  let retries = 0;
  let lastError: Error | null = null;

  while (retries < maxRetries) {
    try {
      // Check if circuit is open before attempting
      if (!circuitBreaker.check()) {
        throw new Error('Circuit breaker is open');
      }

      // eslint-disable-next-line no-await-in-loop -- Intentional: Retry logic requires sequential attempts
      const detail = await fetcher(url);
      if (detail) {
        return { status: 'success', data: detail, url };
      }
      break; // No detail but no error, skip retries
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retries++;

      if (retries < maxRetries) {
        const backoffMs = 500 * Math.pow(2, retries - 1);
        logger.debug(`Retry ${retries}/${maxRetries} for ${url} after ${backoffMs}ms`);
        // eslint-disable-next-line no-await-in-loop -- Exponential backoff requires sequential execution
        await new Promise(resolve => { setTimeout(resolve, backoffMs); });
      }
    }
  }

  return {
    status: 'error',
    error: lastError?.message ?? 'Failed to fetch chapter details',
    url
  };
}

// ============================================================================
// Batch Processor Class
// ============================================================================

/**
 * Context for batch processing operations
 *
 * Consolidates tracking state to reduce parameter count and improve maintainability.
 */
interface BatchProcessingContext {
  perfTracker: BatchPerformanceTracker;
  results: ChapterDetail[];
  errors: { url: string; error: string }[];
  cachedCount: number;
  total: number;
  onProgress?: ((completed: number, total: number) => void) | undefined;
}

/**
 * Batch Chapter Processor
 *
 * Orchestrates batch fetching of chapter details with performance optimization,
 * error handling, and adaptive rate limiting.
 *
 * @example
 * ```typescript
 * const processor = new BatchChapterProcessor(
 *   fetcher,
 *   performanceTracker,
 *   circuitBreaker,
 *   cacheService
 * );
 *
 * const results = await processor.batchFetchChapterDetails(
 *   chapterUrls,
 *   {
 *     batchSize: 75,
 *     delayMs: 50,
 *     maxRetries: 3,
 *     onProgress: (completed, total) => logger.info(`${completed}/${total}`)
 *   }
 * );
 * ```
 */
export class BatchChapterProcessor {
  constructor(
    private readonly fetcher: (url: string) => Promise<ChapterDetail | null>,
    private readonly performanceTracker: PerformanceTracker,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly cacheService: MultiTierCache<ChapterDetail>
  ) {}

  /**
   * Batch fetch chapter details with retry and performance tracking
   *
   * Process flow:
   * 1. Bulk cache check for all URLs
   * 2. Process uncached URLs in batches with parallel fetching
   * 3. Track performance and adjust rate dynamically
   * 4. Report progress and log telemetry
   *
   * @param chapterUrls - Array of chapter URLs to fetch
   * @param options - Batch processing options (size, delay, retries, progress)
   * @returns Array of successfully fetched chapter details
   */
  async batchFetchChapterDetails(
    chapterUrls: string[],
    options: BatchFetchOptions = {}
  ): Promise<ChapterDetail[]> {
    const {
      batchSize = this.performanceTracker.getBatchSize(),
      delayMs = this.performanceTracker.getDelayMs(),
      maxRetries = 3,
      onProgress
    } = options;

    const results: ChapterDetail[] = [];
    const errors: { url: string; error: string }[] = [];
    const total = chapterUrls.length;

    // Performance tracking
    const perfTracker = new BatchPerformanceTracker('Chapter Batch Fetch');
    this.performanceTracker.initTelemetry(total);

    // Reset breaker state at invocation boundary. The breaker is a process-wide
    // singleton; without this, failure counters from the previous title's batch
    // on an unrelated Fandom subdomain bleed into this one and cause silent drops.
    // Intra-invocation protection is preserved — the 15-failure threshold still
    // trips within this call if the target wiki is genuinely unhealthy.
    this.circuitBreaker.reset();

    logger.info(
      `Starting batch fetch for ${total} chapters (batch: ${batchSize}, delay: ${delayMs}ms, circuit: ${this.circuitBreaker.getState()})`
    );

    // Bulk cache check
    const { cached, uncached } = await processCacheChecks(chapterUrls, this.cacheService);

    // Record cache hits
    for (let i = 0; i < cached.length; i++) {
      this.performanceTracker.recordCacheHit();
    }

    results.push(...cached);
    logger.info(`Cache status: ${cached.length} cached, ${uncached.length} to fetch`);

    // Create processing context
    const context: BatchProcessingContext = {
      perfTracker,
      results,
      errors,
      cachedCount: cached.length,
      total,
      onProgress
    };

    // Process uncached in batches
    await this.processUncachedBatches(uncached, batchSize, maxRetries, context);

    // Finalize telemetry
    this.performanceTracker.finalizeTelemetry();

    // Log summary
    this.logBatchSummary(context.perfTracker, context.cachedCount, context.results.length, context.errors);

    return context.results;
  }

  /**
   * Process uncached URLs in batches
   *
   * Helper method to reduce main method complexity.
   * Handles batch iteration, parallel processing, and progress tracking.
   */
  private async processUncachedBatches(
    uncached: string[],
    batchSize: number,
    maxRetries: number,
    context: BatchProcessingContext
  ): Promise<void> {
    for (let i = 0; i < uncached.length; i += batchSize) {
      const batch = uncached.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(uncached.length / batchSize);
      const batchStartTime = Date.now();

      logger.info(
        `Processing batch ${batchNumber}/${totalBatches} (${batch.length} chapters) [Circuit: ${this.circuitBreaker.getState()}]`
      );

      // Process batch in parallel (items within batch), but batches are sequential for rate limiting
      // eslint-disable-next-line no-await-in-loop -- Intentional: Batches must be processed sequentially for rate control
      await this.processSingleBatch(batch, maxRetries, context.results, context.errors);

      // Track batch performance
      const batchDuration = Date.now() - batchStartTime;
      context.perfTracker.trackBatch(batch.length, batchDuration);
      this.performanceTracker.recordBatch(batch.length, batchDuration);

      // Adjust rate based on performance
      const avgTimePerRequest = batchDuration / batch.length;
      const hadErrors = context.errors.length > 0;
      this.performanceTracker.adjustRate(avgTimePerRequest, hadErrors);

      // Report progress
      const completed = context.cachedCount + Math.min(i + batchSize, uncached.length);
      if (context.onProgress) {
        context.onProgress(completed, context.total);
      }
      logger.info(`Progress: ${completed}/${context.total} chapters processed (${context.cachedCount} from cache)`);

      // Rate limiting delay (skip for last batch)
      if (i + batchSize < uncached.length) {
        const dynamicDelay = this.performanceTracker.getDelayMs();
        logger.debug(`Waiting ${dynamicDelay}ms before next batch (dynamic adjustment)...`);
        // eslint-disable-next-line no-await-in-loop -- Rate limiting requires sequential batch processing
        await new Promise(resolve => { setTimeout(resolve, dynamicDelay); });
      }
    }
  }

  /**
   * Process a single batch of URLs with concurrency limiting.
   *
   * Limits to MAX_CONCURRENT_FETCHES (10) simultaneous requests. Each request
   * is dominated by HTTP latency (~1.2s p50 against Fandom); DB cache get/set
   * around it is ~10ms, so even at 10 concurrent the DB-phase overlap is rare
   * enough not to pressure the background pool.
   */
  private async processSingleBatch(
    batch: string[],
    maxRetries: number,
    results: ChapterDetail[],
    errors: { url: string; error: string }[]
  ): Promise<void> {
    const MAX_CONCURRENT_FETCHES = 10;

    for (let i = 0; i < batch.length; i += MAX_CONCURRENT_FETCHES) {
      const chunk = batch.slice(i, i + MAX_CONCURRENT_FETCHES);
      const chunkPromises = chunk.map(url =>
        fetchWithRetry(url, this.fetcher, this.circuitBreaker, maxRetries)
      );

      // eslint-disable-next-line no-await-in-loop -- Intentional: Sequential sub-chunks limit DB concurrency to 5
      const chunkResults = await Promise.allSettled(chunkPromises);
      this.collectBatchResults(chunkResults, results, errors);
    }
  }

  /** Collect results and errors from settled promises */
  private collectBatchResults(
    settledResults: PromiseSettledResult<FetchResult>[],
    results: ChapterDetail[],
    errors: { url: string; error: string }[]
  ): void {
    for (const settledResult of settledResults) {
      if (settledResult.status === 'fulfilled') {
        const result = settledResult.value;

        if (result.status === 'success') {
          results.push(result.data);
          this.performanceTracker.recordSuccess();
        } else {
          const isCircuitBreaker = result.error.includes('Circuit breaker');
          errors.push({ url: result.url, error: result.error });
          this.performanceTracker.recordFailure(isCircuitBreaker);
        }
      } else {
        const errorMessage = settledResult.reason instanceof Error
          ? settledResult.reason.message
          : 'Unknown error';
        errors.push({ url: 'unknown', error: errorMessage });
        this.performanceTracker.recordFailure(false);
      }
    }
  }

  /**
   * Log batch processing summary
   *
   * Outputs performance metrics and error summary after batch completion.
   */
  private logBatchSummary(
    perfTracker: BatchPerformanceTracker,
    cachedCount: number,
    totalResults: number,
    errors: { url: string; error: string }[]
  ): void {
    const perfSummary = perfTracker.getSummary();

    if (errors.length > 0) {
      const errorSample = errors.slice(0, 5).map(e => e.url).join(', ');
      logger.warn(`Failed to fetch ${errors.length} chapters: ${errorSample}`);
    }

    logger.info(
      `Batch fetch complete: ${totalResults} success (${cachedCount} cached), ${errors.length} failures`
    );
    logger.info(
      `Performance: ${perfSummary.formattedDuration}, ${perfSummary.itemsPerSecond.toFixed(1)} items/s`
    );
  }

  /**
   * Legacy method for backward compatibility
   *
   * Wrapper for batchFetchChapterDetails with default settings.
   *
   * @deprecated Use batchFetchChapterDetails directly
   */
  async fetchMultipleChapterDetails(
    chapterUrls: string[],
    options?: { onProgress?: (completed: number, total: number) => void }
  ): Promise<ChapterDetail[]> {
    return this.batchFetchChapterDetails(chapterUrls, {
      batchSize: 75,
      delayMs: 50,
      maxRetries: 3,
      ...(options?.onProgress ? { onProgress: options.onProgress } : {})
    });
  }
}
