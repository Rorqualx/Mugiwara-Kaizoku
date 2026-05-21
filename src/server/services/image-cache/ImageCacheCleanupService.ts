/**
 * Image Cache Cleanup Service
 *
 * Manages image cache retention by automatically cleaning up old cached images.
 * Runs as a scheduled cron job (default: daily at 3 AM).
 *
 * Features:
 * - Configurable retention period via IMAGE_CACHE_RETENTION_DAYS (default: 30)
 * - Size cap to prevent unbounded growth (default: 10,000 entries)
 * - Safe deletion with error handling
 *
 * @module server/services/image-cache/ImageCacheCleanupService
 */

import { CronJob } from 'cron';

import { prisma } from '@/server/db';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/** Configuration for image cache cleanup */
interface ImageCacheCleanupConfig {
  /** Number of days to retain cached images */
  retentionDays: number;
  /** Maximum number of cached images to keep */
  maxEntries: number;
  /** Cron schedule for cleanup job (default: 3 AM daily) */
  schedule: string;
}

/** Result of a cleanup run */
interface CleanupResult {
  deletedByAge: number;
  deletedByCap: number;
  remainingEntries: number;
}

// ============================================================================
// Cleanup Helpers
// ============================================================================

/** Delete entries older than the retention cutoff */
async function deleteExpiredEntries(cutoffDate: Date): Promise<number> {
  const { count } = await prisma.imageCache.deleteMany({
    where: { lastAccessed: { lt: cutoffDate } },
  });
  return count;
}

/** Evict oldest entries when total count exceeds the cap */
async function enforceEntryCap(maxEntries: number): Promise<number> {
  const totalCount = await prisma.imageCache.count();
  if (totalCount <= maxEntries) return 0;

  const excess = totalCount - maxEntries;
  const oldestEntries = await prisma.imageCache.findMany({
    orderBy: { lastAccessed: 'asc' },
    take: excess,
    select: { id: true },
  });

  if (oldestEntries.length === 0) return 0;

  const { count } = await prisma.imageCache.deleteMany({
    where: { id: { in: oldestEntries.map((e) => e.id) } },
  });
  return count;
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * Image Cache Cleanup Service
 *
 * Automatically cleans up old cached images based on configured retention period
 * and enforces a maximum entry count to prevent unbounded database growth.
 */
export class ImageCacheCleanupService {
  private job: CronJob | null = null;
  private config: ImageCacheCleanupConfig;
  private isRunning = false;

  constructor(config?: Partial<ImageCacheCleanupConfig>) {
    this.config = {
      retentionDays: parseInt(process.env['IMAGE_CACHE_RETENTION_DAYS'] ?? '30', 10),
      maxEntries: parseInt(process.env['IMAGE_CACHE_MAX_ENTRIES'] ?? '10000', 10),
      schedule: config?.schedule ?? '0 3 * * *', // 3 AM daily
      ...config,
    };
  }

  /**
   * Start the cleanup service
   */
  start(): AsyncResult<void, Error> {
    try {
      if (this.job) {
        logger.warn('[ImageCacheCleanup] Already started');
        return createSuccessResult(undefined);
      }

      logger.info('[ImageCacheCleanup] Starting image cache cleanup service', {
        retentionDays: this.config.retentionDays,
        maxEntries: this.config.maxEntries,
        schedule: this.config.schedule,
      });

      this.job = new CronJob(
        this.config.schedule,
        () => { void this.runCleanup(); },
        null,
        true,
        'UTC'
      );

      logger.info('[ImageCacheCleanup] Service started', {
        nextRun: this.job.nextDate().toISO(),
      });

      return createSuccessResult(undefined);
    } catch (error: unknown) {
      logger.error('[ImageCacheCleanup] Failed to start', { error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.job) {
      void this.job.stop();
      this.job = null;
      logger.info('[ImageCacheCleanup] Service stopped');
    }
  }

  /**
   * Run cleanup — deletes images older than retention period and enforces size cap
   */
  async runCleanup(): Promise<AsyncResult<CleanupResult, Error>> {
    if (this.isRunning) {
      logger.warn('[ImageCacheCleanup] Already running, skipping');
      return createSuccessResult({ deletedByAge: 0, deletedByCap: 0, remainingEntries: 0 });
    }

    this.isRunning = true;

    try {
      return await this.performCleanup();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[ImageCacheCleanup] Cleanup failed', { error: errorMessage });
      return createErrorResult(
        error instanceof Error ? error : new Error(errorMessage)
      );
    } finally {
      this.isRunning = false;
    }
  }

  /** Execute the two-phase cleanup (age eviction + size cap) */
  private async performCleanup(): Promise<AsyncResult<CleanupResult, Error>> {
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - retentionMs);

    // Phase 1: Delete entries older than retention period
    const deletedByAge = await deleteExpiredEntries(cutoffDate);
    if (deletedByAge > 0) {
      logger.info(`[ImageCacheCleanup] Deleted ${deletedByAge} expired entries (older than ${this.config.retentionDays} days)`);
    }

    // Phase 2: Enforce max entries cap (keep most recently accessed)
    const deletedByCap = await enforceEntryCap(this.config.maxEntries);
    if (deletedByCap > 0) {
      logger.info(`[ImageCacheCleanup] Evicted ${deletedByCap} entries to enforce ${this.config.maxEntries} cap`);
    }

    const remainingEntries = await prisma.imageCache.count();

    logger.info('[ImageCacheCleanup] Cleanup complete', {
      deletedByAge,
      deletedByCap,
      remainingEntries,
    });

    return createSuccessResult({ deletedByAge, deletedByCap, remainingEntries });
  }
}

/** Singleton instance */
export const imageCacheCleanupService = new ImageCacheCleanupService();
