/**
 * Image Cache Cleanup Service
 *
 * Keeps cached cover/banner art permanently so it is downloaded once and never
 * re-fetched from external CDNs. Every row in `ImageCache` is art proxied through
 * `/api/image-proxy` (anilist/mangadex/fandom/wikimedia/comicvine), so cleanup is
 * reference-based: a cached image is kept as long as its `originalUrl` is still
 * referenced by a live `Metadata` cover/banner/gallery field, and removed only when
 * nothing references it (e.g. the manga was deleted or re-identified).
 *
 * Runs as a scheduled cron job (default: daily at 3 AM).
 *
 * Features:
 * - Orphan-only eviction (live cover art is never deleted -> never re-downloaded)
 * - Optional hard entry cap via IMAGE_CACHE_MAX_ENTRIES (default: 0 = disabled).
 *   When enabled it evicts least-recently-accessed entries AFTER orphan removal,
 *   so it can delete live covers -- leave it off unless you must bound DB size.
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
  /**
   * Optional absolute ceiling on cached entries. 0 disables the cap (recommended).
   * When > 0, least-recently-accessed entries are evicted after orphan removal --
   * note this can delete live cover art and cause re-downloads.
   */
  maxEntries: number;
  /** Cron schedule for cleanup job (default: 3 AM daily) */
  schedule: string;
}

/** Result of a cleanup run */
interface CleanupResult {
  /** Entries removed because no live Metadata references their originalUrl */
  orphansDeleted: number;
  /** Entries removed by the optional hard entry cap */
  cappedDeleted: number;
  remainingEntries: number;
}

/** Delete ids in chunks to stay under Postgres bind-parameter limits */
const DELETE_CHUNK_SIZE = 1000;

// ============================================================================
// Cleanup Helpers
// ============================================================================

/**
 * Build the set of external image URLs still referenced by any manga's metadata.
 * These are the cover/banner/gallery URLs that `ImageCache.originalUrl` mirrors.
 */
async function getReferencedUrls(): Promise<Set<string>> {
  const metas = await prisma.metadata.findMany({
    select: {
      cover: true,
      coverLarge: true,
      coverExtraLarge: true,
      coverMedium: true,
      bannerImage: true,
      galleryImages: true,
    },
  });

  const referenced = new Set<string>();
  for (const m of metas) {
    const urls = [
      m.cover,
      m.coverLarge,
      m.coverExtraLarge,
      m.coverMedium,
      m.bannerImage,
      ...m.galleryImages,
    ];
    for (const url of urls) {
      if (url) referenced.add(url);
    }
  }
  return referenced;
}

/** Delete the given cache ids in chunks; returns the total deleted */
async function deleteByIds(ids: number[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + DELETE_CHUNK_SIZE);
    // Sequential on purpose: deleting chunks one at a time avoids saturating the
    // connection pool during a large orphan sweep.
    // eslint-disable-next-line no-await-in-loop
    const { count } = await prisma.imageCache.deleteMany({
      where: { id: { in: chunk } },
    });
    deleted += count;
  }
  return deleted;
}

/** Delete cache entries whose originalUrl is not referenced by any live metadata */
async function deleteOrphanedEntries(referenced: Set<string>): Promise<number> {
  // Select only id + originalUrl -- never load imageData (Bytes) here.
  const rows = await prisma.imageCache.findMany({
    select: { id: true, originalUrl: true },
  });
  const orphanIds = rows.filter((r) => !referenced.has(r.originalUrl)).map((r) => r.id);
  if (orphanIds.length === 0) return 0;
  return deleteByIds(orphanIds);
}

/** Evict least-recently-accessed entries when total exceeds an enabled cap */
async function enforceEntryCap(maxEntries: number): Promise<number> {
  if (maxEntries <= 0) return 0; // disabled

  const totalCount = await prisma.imageCache.count();
  if (totalCount <= maxEntries) return 0;

  const excess = totalCount - maxEntries;
  const oldestEntries = await prisma.imageCache.findMany({
    orderBy: { lastAccessed: 'asc' },
    take: excess,
    select: { id: true },
  });

  if (oldestEntries.length === 0) return 0;

  return deleteByIds(oldestEntries.map((e) => e.id));
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * Image Cache Cleanup Service
 *
 * Reclaims only orphaned cached images (art no live manga references) so that
 * cover/banner art for existing manga is kept permanently and never re-downloaded.
 */
export class ImageCacheCleanupService {
  private job: CronJob | null = null;
  private config: ImageCacheCleanupConfig;
  private isRunning = false;

  constructor(config?: Partial<ImageCacheCleanupConfig>) {
    this.config = {
      maxEntries: parseInt(process.env['IMAGE_CACHE_MAX_ENTRIES'] ?? '0', 10),
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
   * Run cleanup — removes orphaned cached images and enforces the optional cap
   */
  async runCleanup(): Promise<AsyncResult<CleanupResult, Error>> {
    if (this.isRunning) {
      logger.warn('[ImageCacheCleanup] Already running, skipping');
      return createSuccessResult({ orphansDeleted: 0, cappedDeleted: 0, remainingEntries: 0 });
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

  /** Execute cleanup: orphan removal, then the optional hard entry cap */
  private async performCleanup(): Promise<AsyncResult<CleanupResult, Error>> {
    // Phase 1: Remove art no live manga references (deleted/re-identified manga).
    const referenced = await getReferencedUrls();
    const orphansDeleted = await deleteOrphanedEntries(referenced);
    if (orphansDeleted > 0) {
      logger.info(`[ImageCacheCleanup] Deleted ${orphansDeleted} orphaned entries (no live metadata reference)`);
    }

    // Phase 2: Optional hard cap (disabled by default; may evict live covers).
    const cappedDeleted = await enforceEntryCap(this.config.maxEntries);
    if (cappedDeleted > 0) {
      logger.warn(`[ImageCacheCleanup] Evicted ${cappedDeleted} live entries to enforce ${this.config.maxEntries} cap`);
    }

    const remainingEntries = await prisma.imageCache.count();

    logger.info('[ImageCacheCleanup] Cleanup complete', {
      orphansDeleted,
      cappedDeleted,
      remainingEntries,
    });

    return createSuccessResult({ orphansDeleted, cappedDeleted, remainingEntries });
  }
}

/** Singleton instance */
export const imageCacheCleanupService = new ImageCacheCleanupService();
