/**
 * Download Retry Service
 *
 * Orchestrates retry logic for failed downloads:
 * 1. Removes failed download from client
 * 2. Adds failed release to blocklist
 * 3. Finds alternative releases via Prowlarr
 * 4. Sends best alternative to download client
 *
 * @module server/services/download/retry/retry-service
 */

import { PackDownloadStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { resetChaptersToPending } from '@/server/services/download/download-monitor/chapter-manager';
import { runUnifiedReleaseSearch } from '@/server/services/library/releaseDispatcher/dispatch';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { findAlternativeReleases } from '@/server/services/release-blocklist/alternatives-finder';
import { autoBlockFailedRelease } from '@/server/services/release-blocklist/blocklist-manager';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ClientDownloadService } from '../clientDownload';

import { DEFAULT_RETRY_CONFIG, RETRY_CONFIG_KEYS, DownloadFailureReason } from './types';

import type {
  DownloadRetryConfig,
  FailedDownloadInfo,
  RetryAttemptResult,
} from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Download Retry Service
 *
 * Handles the complete retry flow for failed downloads.
 */
export class DownloadRetryService {
  private downloadService: ClientDownloadService;

  constructor(private prismaClient: PrismaClient = prisma) {
    this.downloadService = new ClientDownloadService(prismaClient);
  }

  /**
   * Load retry configuration from database
   *
   * @returns Retry configuration with values from Config table or defaults
   */
  async getRetryConfig(): Promise<DownloadRetryConfig> {
    try {
      const configEntries = await this.prismaClient.config.findMany({
        where: {
          key: {
            startsWith: 'download.retry.',
          },
        },
      });

      const configMap = new Map<string, string>();
      for (const entry of configEntries) {
        configMap.set(entry.key, entry.value);
      }

      return {
        enabled: this.parseBoolean(configMap.get(RETRY_CONFIG_KEYS.ENABLED), DEFAULT_RETRY_CONFIG.enabled),
        maxAttempts: this.parseNumber(configMap.get(RETRY_CONFIG_KEYS.MAX_ATTEMPTS), DEFAULT_RETRY_CONFIG.maxAttempts),
        stallTimeoutMinutes: this.parseNumber(configMap.get(RETRY_CONFIG_KEYS.STALL_TIMEOUT_MINUTES), DEFAULT_RETRY_CONFIG.stallTimeoutMinutes),
        minSeeders: this.parseNumber(configMap.get(RETRY_CONFIG_KEYS.MIN_SEEDERS), DEFAULT_RETRY_CONFIG.minSeeders),
        autoBlockFailed: this.parseBoolean(configMap.get(RETRY_CONFIG_KEYS.AUTO_BLOCK_FAILED), DEFAULT_RETRY_CONFIG.autoBlockFailed),
        blockExpiryDays: this.parseNumber(configMap.get(RETRY_CONFIG_KEYS.BLOCK_EXPIRY_DAYS), DEFAULT_RETRY_CONFIG.blockExpiryDays),
        delayBetweenRetriesSeconds: this.parseNumber(configMap.get(RETRY_CONFIG_KEYS.DELAY_BETWEEN_RETRIES), DEFAULT_RETRY_CONFIG.delayBetweenRetriesSeconds),
      };
    } catch (error: unknown) {
      logger.warn('[RetryService] Failed to load config, using defaults', {
        error: error instanceof Error ? error.message : String(error),
      });
      return DEFAULT_RETRY_CONFIG;
    }
  }

  /**
   * Process a failed download and attempt retry
   *
   * @param failedDownload - Information about the failed download
   * @returns Result of the retry attempt
   */
  // eslint-disable-next-line complexity, max-statements -- Multi-step retry orchestration: remove download, blocklist, find alternatives, send to client; steps are interdependent
  async processFailedDownload(
    failedDownload: FailedDownloadInfo
  ): Promise<AsyncResult<RetryAttemptResult, Error>> {
    const config = await this.getRetryConfig();

    logger.info('[RetryService] Processing failed download', {
      jobId: String(failedDownload.jobId),
      releaseTitle: failedDownload.releaseTitle,
      failureReason: failedDownload.failureReason,
      attemptCount: failedDownload.attemptCount,
      maxAttempts: config.maxAttempts,
    });

    // Flip the original pack_download row to FAILED before any branch decides
    // whether to retry. The dispatched torrent is gone (or about to be); the
    // row should reflect that regardless of retry config or alternate-finding
    // outcome. A successful alternate creates a NEW pack_download via the
    // dispatcher, so this update doesn't conflict with recovery.
    await this.markPackDownloadFailed(
      failedDownload.downloadId,
      failedDownload.clientType,
      this.formatFailureReason(failedDownload.failureReason),
    );

    // Check if retry is enabled
    if (!config.enabled) {
      logger.info('[RetryService] Retry is disabled, skipping');
      return createSuccessResult({
        success: false,
        error: 'Retry is disabled in configuration',
      });
    }

    // Check if we've exceeded max attempts
    if (failedDownload.attemptCount >= config.maxAttempts) {
      logger.warn('[RetryService] Max retry attempts exceeded', {
        jobId: String(failedDownload.jobId),
        attemptCount: failedDownload.attemptCount,
        maxAttempts: config.maxAttempts,
      });
      return createSuccessResult({
        success: false,
        error: `Maximum retry attempts (${config.maxAttempts}) exceeded`,
      });
    }

    try {
      // Step 1: Remove failed download from client
      logger.info('[RetryService] Step 1: Removing failed download from client', {
        clientType: failedDownload.clientType,
        downloadId: failedDownload.downloadId,
      });

      // iter-4: keep partially downloaded files on disk. The reconciliation
      // sweep uses the files (or the still-present client entry) to recover
      // chapters whose torrent actually completed after we gave up on it.
      // Wasted disk is cheaper than a permanently-lost-to-ERROR chapter.
      const removeResult = await this.downloadService.removeDownload(
        failedDownload.clientType,
        failedDownload.downloadId,
        false
      );

      if (!isSuccess(removeResult)) {
        logger.warn('[RetryService] Failed to remove download from client, continuing anyway', {
          error: isError(removeResult) ? removeResult.error.message : 'Unknown error',
        });
        // Continue anyway - the download might already be removed
      }

      // Step 1.5: Mark the parent chapter_download job as failed.
      //
      // 2026-05-16 fix: Steins;Gate trace showed that killing the
      // pack_download + removing the client torrent leaves the parent
      // chapter_download job in `status='active'` indefinitely. The next
      // dispatch attempt hits `checkForDuplicateJob`, finds that orphan,
      // and silently returns its taskId — so the magnet never gets re-sent
      // and the user sees "0 results" with no signal. Marking the parent
      // job failed here closes the loop in the queue table itself.
      await this.markParentJobFailed(failedDownload);

      // Step 2: Add to blocklist if enabled
      if (config.autoBlockFailed) {
        logger.info('[RetryService] Step 2: Adding failed release to blocklist', {
          releaseTitle: failedDownload.releaseTitle,
          expiryDays: config.blockExpiryDays,
        });

        const blockResult = await autoBlockFailedRelease(
          this.prismaClient,
          {
            releaseTitle: failedDownload.releaseTitle,
            releaseUrl: failedDownload.releaseUrl,
            mangaId: failedDownload.mangaId,
            failureReason: this.formatFailureReason(failedDownload.failureReason),
            expiryDays: config.blockExpiryDays,
          }
        );

        if (!isSuccess(blockResult)) {
          logger.warn('[RetryService] Failed to add release to blocklist, continuing', {
            error: isError(blockResult) ? blockResult.error.message : 'Unknown error',
          });
        }
      }

      // Step 3: Find alternative releases via Prowlarr
      logger.info('[RetryService] Step 3: Finding alternative releases', {
        mangaId: failedDownload.mangaId,
        chapterNumbers: failedDownload.chapterNumbers,
      });

      // Get all blocked releases for this manga to exclude them
      const blockedReleases = await this.prismaClient.releaseBlocklist.findMany({
        where: {
          mangaId: failedDownload.mangaId,
          isActive: true,
        },
        select: { title: true },
      });

      const excludeTitles = blockedReleases
        .map(r => r.title)
        .filter((t): t is string => t !== null);
      excludeTitles.push(failedDownload.releaseTitle); // Also exclude the current failed release

      // Search for alternatives for each chapter
      const chapterNumber = failedDownload.chapterNumbers?.[0] ?? '1';
      const alternativesResult = await findAlternativeReleases(
        this.prismaClient,
        failedDownload.mangaId,
        chapterNumber,
        excludeTitles
      );

      if (!isSuccess(alternativesResult)) {
        logger.error('[RetryService] Failed to find alternatives', {
          error: isError(alternativesResult) ? alternativesResult.error.message : 'Unknown error',
        });
        return createSuccessResult({
          success: false,
          error: 'Failed to find alternative releases',
        });
      }

      const alternatives = alternativesResult.data;

      if (alternatives.length === 0) {
        logger.warn('[RetryService] No alternative releases found, trying native fallback');
        // iter-EX2: Prowlarr is dry — see whether MangaDex/Suwayomi/GetComics
        // can deliver these chapters. The unified dispatcher already respects
        // iter-EX's failed-source guard, so we won't re-try a source that has
        // already failed for the same chapter in the last 7 days.
        const nativeOutcome = await this.tryNativeFallback(
          failedDownload.mangaId,
          failedDownload.chapterIds,
        );
        if (nativeOutcome.enqueued > 0) {
          return createSuccessResult({
            success: true,
            alternativeUsed: `native:${nativeOutcome.sources.join(',')}`,
          });
        }
        return createSuccessResult({
          success: false,
          error: 'No alternative releases available (Prowlarr + native both dry)',
        });
      }

      logger.info('[RetryService] Found alternative releases', {
        count: alternatives.length,
        titles: alternatives.slice(0, 3).map(a => a.releaseTitle),
      });

      // Step 4: Get download URL for best alternative and send to client
      const bestAlternative = alternatives[0];
      if (!bestAlternative) {
        return createSuccessResult({
          success: false,
          error: 'No suitable alternative found',
        });
      }

      // Search Prowlarr again to get the actual download URL
      const { ProwlarrMangaSearch } = await import('../../prowlarr/mangaSearch');
      const prowlarrSearch = new ProwlarrMangaSearch(this.prismaClient);

      const searchResult = await prowlarrSearch.searchManga(bestAlternative.releaseTitle);
      if (!isSuccess(searchResult) || searchResult.data.results.length === 0) {
        logger.error('[RetryService] Could not find download URL for alternative');
        return createSuccessResult({
          success: false,
          error: 'Could not find download URL for alternative release',
        });
      }

      // Find the matching result
      const matchingResult = searchResult.data.results.find(
        r => r.title === bestAlternative.releaseTitle && !r.isBlocked
      );

      if (!matchingResult) {
        logger.warn('[RetryService] Alternative release is now blocked or not found');
        return createSuccessResult({
          success: false,
          error: 'Alternative release is blocked or no longer available',
        });
      }

      const downloadUrl = matchingResult.downloadUrl ?? matchingResult.magnetUrl;
      if (!downloadUrl) {
        logger.error('[RetryService] No download URL found for alternative');
        return createSuccessResult({
          success: false,
          error: 'No download URL for alternative release',
        });
      }

      logger.info('[RetryService] Step 4: Sending alternative to download client', {
        clientType: failedDownload.clientType,
        releaseTitle: bestAlternative.releaseTitle,
      });

      const sendResult = await this.downloadService.sendToClient(
        failedDownload.clientType,
        downloadUrl
      );

      if (!isSuccess(sendResult)) {
        logger.error('[RetryService] Failed to send alternative to client', {
          error: isError(sendResult) ? sendResult.error.message : 'Unknown error',
        });
        return createSuccessResult({
          success: false,
          error: 'Failed to send alternative release to download client',
        });
      }

      // Step 5: Update job with new download ID and increment attempt count
      logger.info('[RetryService] Step 5: Updating job with new download', {
        jobId: String(failedDownload.jobId),
        newDownloadId: sendResult.data.downloadId,
        newAttemptCount: failedDownload.attemptCount + 1,
      });

      await this.updateJobForRetry(
        failedDownload.jobId,
        sendResult.data.downloadId,
        bestAlternative.releaseTitle,
        failedDownload.attemptCount + 1
      );

      logger.info('[RetryService] Retry successful!', {
        jobId: String(failedDownload.jobId),
        newDownloadId: sendResult.data.downloadId,
        alternativeTitle: bestAlternative.releaseTitle,
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'download:retry:success',
        source: 'retry-service',
        message: `Retry successful for job ${String(failedDownload.jobId)}`,
        data: {
          jobId: String(failedDownload.jobId),
          mangaId: failedDownload.mangaId,
          newDownloadId: sendResult.data.downloadId,
          alternativeTitle: bestAlternative.releaseTitle
        }
      });

      return createSuccessResult({
        success: true,
        newDownloadId: sendResult.data.downloadId,
        alternativeUsed: bestAlternative.releaseTitle,
      });
    } catch (error: unknown) {
      logger.error('[RetryService] Unexpected error during retry', {
        error: error instanceof Error ? error.message : String(error),
        jobId: String(failedDownload.jobId),
      });
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to process retry')
      );
    }
  }

  /**
   * iter-EX2: When Prowlarr alternatives are exhausted, re-trigger the
   * unified dispatcher scoped to the failed chapters so MangaDex/Suwayomi/
   * GetComics get a shot. Returns the count + sources of native enqueues.
   *
   * Chapters are reset to PENDING first so the unified dispatcher's
   * `inFlight` guard doesn't skip them — they're currently still flagged
   * DOWNLOADING from the failed Prowlarr attempt.
   */
  private async tryNativeFallback(
    mangaId: number,
    chapterIds: number[],
  ): Promise<{ enqueued: number; sources: string[] }> {
    if (chapterIds.length === 0) return { enqueued: 0, sources: [] };
    try {
      await resetChaptersToPending(this.prismaClient, chapterIds, mangaId);
      const summary = await runUnifiedReleaseSearch(mangaId, {
        scope: { mode: 'BULK', chapterIds },
        bypassRuleCheck: true,
      });
      const enqueued = summary.nativeEnqueued.length;
      const sources = [...new Set(summary.nativeEnqueued.map(n => n.source))];
      if (enqueued > 0) {
        logger.info('[RetryService] Native fallback enqueued chapters', {
          mangaId, enqueued, sources, chapterIds: chapterIds.slice(0, 5),
        });
      }
      return { enqueued, sources };
    } catch (err: unknown) {
      logger.warn('[RetryService] Native fallback errored', {
        mangaId, error: err instanceof Error ? err.message : String(err),
      });
      return { enqueued: 0, sources: [] };
    }
  }

  /**
   * Update job record with retry information
   */
  private async updateJobForRetry(
    jobId: bigint,
    newDownloadId: string,
    newReleaseTitle: string,
    attemptCount: number
  ): Promise<void> {
    try {
      // Get existing job
      const job = await this.prismaClient.jobs.findFirst({
        where: { id: jobId },
      });

      if (!job) {
        logger.warn('[RetryService] Job not found for update', { jobId: String(jobId) });
        return;
      }

      // Parse existing result
      let result: Record<string, unknown> = {};
      if (job.result) {
        // Handle JsonValue type - could be string, object, etc.
        if (typeof job.result === 'string') {
          try {
            result = JSON.parse(job.result) as Record<string, unknown>;
          } catch {
            // If result is not valid JSON, start fresh
            result = {};
          }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- JsonValue type is complex
        } else if (typeof job.result === 'object' && job.result !== null && !Array.isArray(job.result)) {
          // Already an object
          result = job.result as Record<string, unknown>;
        }
      }

      // Update with new download info
      result['downloadId'] = newDownloadId;
      result['releaseTitle'] = newReleaseTitle;
      result['retryAttempt'] = attemptCount;
      result['lastRetryAt'] = new Date().toISOString();

      // Update job — use raw SQL with NOW() to avoid timezone mismatch
      const resultJson = JSON.stringify(result);
      await this.prismaClient.$queryRaw`
        UPDATE jobs
        SET result = ${resultJson}::jsonb,
            attempt_count = ${attemptCount},
            status = 'pending'::"JobStatus",
            scheduled_for = NOW(),
            last_error = NULL
        WHERE id = ${jobId} AND partition_key = ${job.partition_key}
      `;
    } catch (error: unknown) {
      logger.error('[RetryService] Failed to update job for retry', {
        error: error instanceof Error ? error.message : String(error),
        jobId: String(jobId),
      });
    }
  }

  /**
   * Mark the original pack_download row as FAILED.
   *
   * Identified by (downloadId, clientType) — the same composite the
   * dispatcher uses to create the row. Best-effort: a missing row is fine
   * (older dispatches predate pack tracking; some paths don't create one),
   * and DB errors here must not abort retry orchestration.
   */
  private async markPackDownloadFailed(
    downloadId: string,
    clientType: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const result = await this.prismaClient.packDownload.updateMany({
        where: {
          downloadId,
          clientType,
          status: PackDownloadStatus.DOWNLOADING,
        },
        data: {
          status: PackDownloadStatus.FAILED,
          errorMessage,
          completedAt: new Date(),
        },
      });
      if (result.count > 0) {
        logger.info('[RetryService] Marked pack_download row as FAILED', {
          downloadId,
          clientType,
          rowsUpdated: result.count,
        });
      }
    } catch (error: unknown) {
      logger.warn('[RetryService] Failed to update pack_download status (non-fatal)', {
        downloadId,
        clientType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Mark the parent chapter_download job row as failed.
   *
   * 2026-05-16 fix for orphan-active-job: without this, the job stays in
   * `status='active'` after the retry path has already removed the
   * client-side torrent + failed the pack_download. The next dispatch for
   * the same chapters then hits checkForDuplicateJob, finds this orphan,
   * and returns its taskId — so no fresh magnet ever lands in the client.
   * Updating only `active`/`pending` rows keeps this idempotent: a job
   * that has already finished naturally isn't disturbed.
   */
  private async markParentJobFailed(failedDownload: FailedDownloadInfo): Promise<void> {
    try {
      const result = await this.prismaClient.jobs.updateMany({
        where: { id: failedDownload.jobId, status: { in: ['active', 'pending'] } },
        data: {
          status: 'failed',
          last_error: { message: `Retry-killed: ${this.formatFailureReason(failedDownload.failureReason)}` },
          completed_at: new Date(),
        },
      });
      if (result.count > 0) {
        logger.info('[RetryService] Step 1.5: Marked parent chapter_download job as failed', {
          jobId: String(failedDownload.jobId),
          failureReason: failedDownload.failureReason,
        });
      }
    } catch (error: unknown) {
      logger.warn('[RetryService] Failed to fail parent chapter_download job (non-fatal)', {
        jobId: String(failedDownload.jobId),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Format failure reason for human-readable display
   */
  private formatFailureReason(reason: DownloadFailureReason): string {
    switch (reason) {
      case DownloadFailureReason.STALLED:
        return 'Download stalled with no progress';
      case DownloadFailureReason.NO_SEEDS:
        return 'Torrent has no seeders available';
      case DownloadFailureReason.CLIENT_ERROR:
        return 'Download client reported an error';
      case DownloadFailureReason.NZB_FAILED:
        return 'NZB download failed (repair/unpack error)';
      case DownloadFailureReason.TIMEOUT:
        return 'Download timed out';
      case DownloadFailureReason.UNKNOWN:
      default:
        return 'Download failed for unknown reason';
    }
  }

  /**
   * Parse boolean from config string
   */
  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  /**
   * Parse number from config string
   */
  private parseNumber(value: string | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
}

/**
 * Get a singleton instance of the retry service
 */
let retryServiceInstance: DownloadRetryService | null = null;

export function getRetryService(prismaClient: PrismaClient = prisma): DownloadRetryService {
  retryServiceInstance ??= new DownloadRetryService(prismaClient);
  return retryServiceInstance;
}
