/**
 * Release Blocklist Quality Evaluator
 *
 * Evaluates release quality and tracks download attempts.
 * Auto-blocking functionality is temporarily disabled.
 *
 * Extracted from: releaseBlocklistService.ts (lines 325-432)
 */

import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ReleaseBlocklistReason } from './types';

import type { ReleaseIdentifier, ReleaseQualityMetrics } from './types';

/**
 * Evaluate release quality and auto-block if necessary
 *
 * NOTE: Auto-blocking temporarily disabled for debugging download client issues.
 * DownloadAttempt model doesn't exist in schema yet.
 *
 * @param release - Release identifier
 * @param metrics - Quality metrics
 * @returns AsyncResult indicating if release should be blocked
 */
export function evaluateQuality(
  release: ReleaseIdentifier,
  _metrics: ReleaseQualityMetrics
): Promise<AsyncResult<boolean, Error>> {
  try {
    // NOTE: DownloadAttempt model doesn't exist in schema yet
    // This functionality is disabled until the model is created

    const _failureRate = 0; // Disabled until DownloadAttempt model exists
    const shouldBlock = false; // TEMPORARILY DISABLED FOR DEBUGGING
    const _reason: ReleaseBlocklistReason = ReleaseBlocklistReason.AUTO_QUALITY;
    const _details = '';

    // DISABLED: Auto-blocking temporarily disabled to debug download client issues
    // Uncomment these sections once download clients are working correctly
    /*
    // High failure rate
    if (failureRate > 0.8 && attempts.length >= 3) {
      shouldBlock = true;
      details = `High failure rate: ${(failureRate * 100).toFixed(0)}%`;
    }

    // Suspiciously small file size (less than 100KB for manga)
    if (metrics.fileSize && metrics.fileSize < BigInt(100 * 1024)) {
      shouldBlock = true;
      reason = ReleaseBlocklistReason.INCOMPLETE;
      details = `File size too small: ${(Number(metrics.fileSize) / 1024).toFixed(2)}KB`;
    }

    // Auto-block if criteria met
    if (shouldBlock) {
      await prisma.releaseBlocklist.create({
        data: {
          releaseTitle: release.releaseTitle,
          releaseHash: release.releaseHash ?? null,
          mangaId: release.mangaId ? toNumberId(release.mangaId) : null,
          chapterNumber: release.chapterNumber?.toString() ?? null,
          reason: reason,
          reasonDetails: details,
          fileSize: metrics.fileSize ?? null,
          quality: null,
          language: metrics.languageCode ?? null,
          addedBy: 'system',
          isActive: true,
          autoBlocked: true
        }
      });

      logger.info('Release auto-blocked for quality', {
        release: release.releaseTitle,
        reason,
        details
      });
    }
    */

    return Promise.resolve(createSuccessResult(shouldBlock));
  } catch (error: unknown) {
    logger.error('Error evaluating release quality', {
      release,
      error: error instanceof Error ? error.message : String(error)
    });
    return Promise.resolve(
      createErrorResult(
        error instanceof Error ? error : new Error('Failed to evaluate release quality')
      )
    );
  }
}

/**
 * Record a download attempt for quality tracking
 *
 * NOTE: DownloadAttempt model doesn't exist in schema yet.
 * This functionality is disabled until the model is created.
 *
 * @param release - Release identifier
 * @param success - Whether download succeeded
 * @param errorReason - Error reason if failed
 * @param metrics - Optional quality metrics
 * @returns AsyncResult indicating success
 */
export function recordDownloadAttempt(
  release: ReleaseIdentifier,
  success: boolean,
  errorReason?: string,
  _metrics?: Partial<ReleaseQualityMetrics>
): Promise<AsyncResult<void, Error>> {
  try {
    // NOTE: DownloadAttempt model doesn't exist in schema yet
    // This functionality is disabled until the model is created

    logger.info('Download attempt recorded (in-memory only, DownloadAttempt model not yet implemented)', {
      releaseTitle: release.releaseTitle,
      success,
      errorReason
    });

    return Promise.resolve(createSuccessResult(undefined));
  } catch (error: unknown) {
    logger.error('Error recording download attempt', {
      release,
      error: error instanceof Error ? error.message : String(error)
    });
    return Promise.resolve(
      createErrorResult(
        error instanceof Error ? error : new Error('Failed to record download attempt')
      )
    );
  }
}
