/**
 * Download Retry Handler
 *
 * Handles retry logic for failed and stalled downloads.
 * Extracted from downloadMonitor.ts to keep file under 500 lines.
 */

import { isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { getRetryService } from '../retry';

import type { FailedDownloadInfo, DownloadRetryConfig } from '../retry';
import type { DownloadFailureReason } from '../retry';
import type { PrismaClient } from '@prisma/client';

/**
 * Parameters for retry attempt
 */
export interface RetryAttemptParams {
  job: { id: bigint; partition_key: string; attempt_count: number; result: string | null };
  downloadId: string;
  clientType: string;
  mangaId: number;
  chapterIds: number[];
  failureReason: DownloadFailureReason;
  releaseTitle: string;
}

/**
 * Extract release URL from job result for blocklist operations
 */
export function extractReleaseUrl(result: unknown): string {
    const str = typeof result === 'string' ? result : JSON.stringify(result ?? {});
    try {
        const obj = JSON.parse(str) as Record<string, unknown>;
        return String(obj['releaseUrl'] ?? obj['downloadUrl'] ?? obj['magnetUrl'] ?? '');
    } catch { return ''; }
}

/**
 * Parsed info from a job result for retry purposes
 */
interface ParsedJobRetryInfo {
  releaseUrl: string;
  releaseTitle: string;
  chapterNumbers: string[];
}

/**
 * Parse job result JSON to extract retry-relevant fields
 */
function parseJobResultForRetry(jobResult: string | null, fallbackTitle: string): ParsedJobRetryInfo {
  const info: ParsedJobRetryInfo = { releaseUrl: '', releaseTitle: fallbackTitle, chapterNumbers: [] };
  if (!jobResult) return info;

  try {
    const result = JSON.parse(jobResult) as Record<string, unknown>;
    info.releaseUrl = String(result['releaseUrl'] ?? result['downloadUrl'] ?? result['magnetUrl'] ?? '');
    if (result['releaseTitle']) { info.releaseTitle = String(result['releaseTitle']); }
    if (Array.isArray(result['chapterNumbers'])) {
      info.chapterNumbers = (result['chapterNumbers'] as unknown[]).map(c => String(c));
    }
  } catch {
    logger.debug('[DownloadMonitor] Could not parse job result for retry info');
  }
  return info;
}

/**
 * Attempt to retry a failed download
 *
 * @returns True if retry was triggered, false if retry not possible
 */
export async function attemptDownloadRetry(
  prismaClient: PrismaClient,
  retryConfig: DownloadRetryConfig,
  params: RetryAttemptParams
): Promise<boolean> {
  const { job, downloadId, clientType, mangaId, chapterIds, failureReason, releaseTitle } = params;
  try {
    if (!retryConfig.enabled) { return false; }
    if (job.attempt_count >= retryConfig.maxAttempts) {
      logger.warn(`[DownloadMonitor] Max retry attempts exceeded for job ${job.id}`);
      return false;
    }

    const parsed = parseJobResultForRetry(job.result, releaseTitle);

    // Get chapter numbers from DB if not in job result
    if (parsed.chapterNumbers.length === 0 && chapterIds.length > 0) {
      const chapters = await prismaClient.chapter.findMany({
        where: { id: { in: chapterIds } },
        select: { chapterNumber: true },
      });
      parsed.chapterNumbers = chapters
        .map(c => c.chapterNumber)
        .filter((n): n is number => n !== null)
        .map(n => String(n));
    }

    const failedDownload: FailedDownloadInfo = {
      jobId: job.id, downloadId, clientType, mangaId, chapterIds,
      releaseTitle: parsed.releaseTitle, releaseUrl: parsed.releaseUrl,
      failureReason, attemptCount: job.attempt_count,
      chapterNumbers: parsed.chapterNumbers,
    };

    const retryService = getRetryService(prismaClient);
    const retryResult = await retryService.processFailedDownload(failedDownload);

    if (isSuccess(retryResult) && retryResult.data.success) {
      logger.info(`[DownloadMonitor] Retry successful for job ${job.id}`, {
        newDownloadId: retryResult.data.newDownloadId,
        alternativeUsed: retryResult.data.alternativeUsed,
      });
      return true;
    }

    if (isSuccess(retryResult)) {
      logger.warn(`[DownloadMonitor] Retry failed for job ${job.id}: ${retryResult.data.error}`);
    } else if (isError(retryResult)) {
      logger.error(`[DownloadMonitor] Retry error for job ${job.id}:`, retryResult.error);
    }
    return false;
  } catch (error: unknown) {
    logger.error('[DownloadMonitor] Error attempting retry:', error);
    return false;
  }
}
