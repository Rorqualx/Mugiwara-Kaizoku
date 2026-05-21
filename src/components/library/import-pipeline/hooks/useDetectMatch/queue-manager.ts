/**
 * MatchQueueManager
 *
 * Class-based queue manager for isolated match job processing.
 * Avoids closure capture issues by:
 * 1. Capturing itemId as primitive value at job creation
 * 2. Deep cloning item data with structuredClone()
 * 3. Freezing all objects to prevent mutations
 * 4. Using class instance (stored in ref) instead of closures
 *
 * @module components/library/import-pipeline/hooks/useDetectMatch/queue-manager
 */

import type { ScannedMangaItem, EnrichedProviderMatch } from '@/components/library/import-pipeline/types';
import { logger } from '@/utils/logger';

import { hasCoverImage, normalizeSearchTitle, scoreWithYear } from './helpers';

import type {
  MatchJob,
  MatchJobResult,
  MatchJobStatus,
  QueueStats,
  MatchQueueCallbacks,
  MatchQueueConfig,
  SearchFunction,
  SearchResultForQueue,
} from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Deep clone an object using JSON serialization
 * This is safer than structuredClone for ESLint compatibility
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Deep clone and freeze an object to prevent mutations
 */
function deepCloneAndFreeze<T>(obj: T): Readonly<T> {
  const cloned = deepClone(obj);
  return Object.freeze(cloned) as Readonly<T>;
}

/**
 * Convert unknown error to Error instance
 */
function toError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  return new Error(String(err));
}

/**
 * Create a frozen EnrichedProviderMatch from search result
 */
function createFrozenMatch(result: SearchResultForQueue): Readonly<EnrichedProviderMatch> {
  const match: EnrichedProviderMatch = {
    id: `${result.provider}-${result.id}`,
    providerId: result.id,
    title: result.title,
    provider: result.provider,
    confidence: result.confidence,
    metadata: {
      description: result.description,
      coverImage: result.coverImage,
      siteDetailUrl: result.siteDetailUrl,
      url: result.url,
      wikiUrl: result.wikiUrl,
      year: result.year,
      chapters: result.chapters,
      volumes: result.volumes,
      genres: result.genres,
      status: result.status,
      authors: result.authors,
      artists: result.artists,
      publisher: result.publisher,
    },
  };

  return deepCloneAndFreeze(match);
}

/**
 * Find best match from array of matches, using folder year for disambiguation.
 * When the best match lacks a cover image, borrows one from the best match that has one.
 */
function findBestMatch(
  matches: readonly Readonly<EnrichedProviderMatch>[],
  folderYear?: number
): Readonly<EnrichedProviderMatch> | null {
  if (matches.length === 0) {
    return null;
  }
  const sorted = [...matches].sort((a, b) =>
    scoreWithYear(b, folderYear) - scoreWithYear(a, folderYear)
  );
  const best = sorted[0];
  if (!best) return null;

  // If best match has no cover, borrow from the highest-ranked match that does
  if (!hasCoverImage(best)) {
    const withCover = sorted.find(hasCoverImage);
    if (withCover) {
      const fallbackCover = (withCover.metadata as Record<string, unknown>)['coverImage'] as string;
      const enrichedMeta = { ...(best.metadata as Record<string, unknown>), coverImage: fallbackCover };
      return Object.freeze({ ...best, metadata: Object.freeze(enrichedMeta) }) as Readonly<EnrichedProviderMatch>;
    }
  }

  return best;
}

// ============================================================================
// MatchQueueManager Class
// ============================================================================

/**
 * Queue manager that processes match jobs with isolation guarantees.
 */
export class MatchQueueManager {
  private readonly queue: MatchJob[] = [];
  private readonly completedJobs: Map<string, MatchJobResult> = new Map();
  private readonly callbacks: MatchQueueCallbacks;
  private readonly config: Required<MatchQueueConfig>;
  private readonly searchFn: SearchFunction;

  private isProcessing = false;
  private isDestroyed = false;
  private lastRequestTime = 0;
  private failedCount = 0;
  private cancelledCount = 0;

  constructor(
    callbacks: MatchQueueCallbacks,
    searchFn: SearchFunction,
    config: MatchQueueConfig = {}
  ) {
    this.callbacks = callbacks;
    this.searchFn = searchFn;
    this.config = {
      minRequestDelay: config.minRequestDelay ?? 2500,
      maxConcurrent: config.maxConcurrent ?? 1,
      maxRetries: config.maxRetries ?? 3,
    };
  }

  /**
   * Create a new match job with isolated data
   */
  private createMatchJob(item: ScannedMangaItem): MatchJob {
    const capturedItemId: string = String(item.id);
    const clonedData = deepCloneAndFreeze(item);

    const job: MatchJob = {
      jobId: generateJobId(),
      itemId: capturedItemId,
      itemData: clonedData,
      abortController: new AbortController(),
      status: 'pending' as MatchJobStatus,
      createdAt: Date.now(),
    };

    logger.info('[QueueManager] Created job', {
      jobId: job.jobId,
      itemId: job.itemId,
      cleanTitle: job.itemData.cleanTitle,
      year: job.itemData.year,
    });

    return job;
  }

  /**
   * Add an item to the queue for matching
   */
  enqueue(item: ScannedMangaItem): string {
    if (this.isDestroyed) {
      logger.warn('[QueueManager] Attempted to enqueue after destroy');
      return '';
    }

    if (item.isDuplicate || item.error) {
      logger.info('[QueueManager] Skipping item', {
        itemId: item.id,
        isDuplicate: item.isDuplicate,
        hasError: Boolean(item.error),
      });
      return '';
    }

    const existingJob = this.queue.find((j) => j.itemId === item.id);
    if (existingJob) {
      logger.info('[QueueManager] Item already in queue', { itemId: item.id });
      return existingJob.jobId;
    }

    const job = this.createMatchJob(item);
    this.queue.push(job);
    this.updateStats();

    void this.processQueue();

    return job.jobId;
  }

  /**
   * Process the queue sequentially with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isDestroyed) return;
    this.isProcessing = true;

    try {
      await this.processQueueLoop();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Inner loop for processing queue items
   */
  private async processQueueLoop(): Promise<void> {
    while (this.queue.length > 0 && !this.isDestroyed) {
      const job = this.queue.find((j) => j.status === 'pending');
      if (!job) break;

      // eslint-disable-next-line no-await-in-loop -- Intentional rate limiting between requests (2.5s delay)
      await this.handleRateLimiting();

      // Check again after async delay - isDestroyed may have changed
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- isDestroyed can change during async operations
      if (this.isDestroyed) break;

      // eslint-disable-next-line no-await-in-loop -- Sequential processing required for rate limiting
      await this.processJob(job);
      this.lastRequestTime = Date.now();
    }
  }

  /**
   * Handle rate limiting delay between requests
   */
  private async handleRateLimiting(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.minRequestDelay) {
      const waitTime = this.config.minRequestDelay - timeSinceLastRequest;
      logger.info('[QueueManager] Rate limiting, waiting', { waitTime });
      await this.delay(waitTime);
    }
  }

  /**
   * Process a single job
   * Note: We intentionally mutate job.status to track state in the queue
   */
  private async processJob(job: MatchJob): Promise<void> {
    // eslint-disable-next-line no-param-reassign -- Intentional: tracking job state in queue
    job.status = 'running';
    this.updateStats();
    this.callbacks.onJobStarted(job.jobId, job.itemId);

    try {
      const result = await this.executeSearch(job);
      this.handleJobSuccess(job, result);
    } catch (err) {
      this.handleJobError(job, toError(err));
    }
  }

  /**
   * Handle successful job completion
   */
  private handleJobSuccess(job: MatchJob, result: MatchJobResult): void {
    this.completedJobs.set(job.jobId, result);
    // eslint-disable-next-line no-param-reassign -- Intentional: tracking job state in queue
    job.status = 'completed';
    this.removeJobFromQueue(job);
    this.updateStats();
    this.callbacks.onJobCompleted(result);
  }

  /**
   * Handle job error
   */
  private handleJobError(job: MatchJob, error: Error): void {
    // eslint-disable-next-line no-param-reassign -- Intentional: tracking job state in queue
    job.status = 'error';
    // eslint-disable-next-line no-param-reassign -- Intentional: tracking error message in queue
    job.errorMessage = error.message;
    this.failedCount += 1;
    this.callbacks.onJobError(job.jobId, job.itemId, error);
    this.removeJobFromQueue(job);
    this.updateStats();
  }

  /**
   * Remove a job from the queue
   */
  private removeJobFromQueue(job: MatchJob): void {
    const idx = this.queue.indexOf(job);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
    }
  }

  /**
   * Execute the actual search for a job, using folder year for match ranking
   */
  private async executeSearch(job: MatchJob): Promise<MatchJobResult> {
    const searchQuery = normalizeSearchTitle(job.itemData.cleanTitle);
    const folderYear = job.itemData.year;

    logger.info('[QueueManager] Searching', {
      jobId: job.jobId,
      itemId: job.itemId,
      query: searchQuery,
      folderYear,
    });

    const results = await this.searchFn(searchQuery, 10, job.abortController.signal);
    const frozenMatches = results.map(createFrozenMatch);
    const frozenMatchesArray = Object.freeze(frozenMatches) as readonly Readonly<EnrichedProviderMatch>[];
    const bestMatch = findBestMatch(frozenMatchesArray, folderYear);

    const result: MatchJobResult = Object.freeze({
      jobId: job.jobId,
      itemId: job.itemId,
      match: bestMatch,
      availableMatches: frozenMatchesArray,
      completedAt: Date.now(),
      searchQuery,
    });

    logger.info('[QueueManager] Search complete', {
      jobId: job.jobId,
      query: searchQuery,
      matchTitle: result.match?.title ?? 'none',
      matchYear: (result.match?.metadata as Record<string, unknown> | undefined)?.['year'],
      folderYear,
      matchCount: result.availableMatches.length,
    });

    return result;
  }

  /**
   * Cancel all pending and running jobs
   */
  cancel(): void {
    logger.info('[QueueManager] Cancelling all jobs', { count: this.queue.length });

    const cancelledCount = this.queue.length;
    for (const job of this.queue) {
      job.abortController.abort();
      job.status = 'cancelled';
    }

    // Track cancellations separately from failures so UI doesn't display
    // user-initiated cancels as errors.
    this.cancelledCount += cancelledCount;
    this.queue.length = 0;
    this.updateStats();
  }

  /**
   * Destroy the queue manager
   */
  destroy(): void {
    logger.info('[QueueManager] Destroying');
    this.isDestroyed = true;
    this.cancel();
    this.completedJobs.clear();
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    const pending = this.queue.filter((j) => j.status === 'pending').length;
    const running = this.queue.filter((j) => j.status === 'running').length;

    return {
      pending,
      running,
      completed: this.completedJobs.size,
      failed: this.failedCount,
      cancelled: this.cancelledCount,
    };
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if processing is active
   */
  isActive(): boolean {
    return this.isProcessing;
  }

  private updateStats(): void {
    this.callbacks.onStatsChange?.(this.getStats());
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
