/**
 * Download Status Checker Module
 *
 * Responsible for checking download status from clients and validating responses.
 * Provides type-safe status checking with comprehensive validation and logging.
 *
 * Extracted from: downloadMonitor.ts (lines 180-213)
 * Date: 2025-11-21
 */

import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, createSuccessResult, isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { DownloadStatusSchema } from './utils';

import type { ClientDownloadService } from '../clientDownload';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Validated download status with type safety
 *
 * Represents a download status that has been validated against the schema
 * and is guaranteed to have the correct structure and types.
 *
 * @property status - Current download status (e.g., 'COMPLETED', 'SEEDING', 'ERROR')
 * @property savePath - Path where the download is saved (if available)
 * @property name - Name of the download (if available)
 * @property size - Size of the download in bytes (if available)
 * @property error - Error information if the download failed (if available)
 * @property progress - Download progress percentage (if available)
 * @property clientSpecific - Client-specific metadata (if available)
 */
export interface ValidatedDownloadStatus {
  status: string;
  savePath?: string;
  name?: string;
  size?: number;
  error?: unknown;
  progress?: number;
  clientSpecific?: unknown;
}

// ============================================================================
// Status Checking Functions
// ============================================================================

/**
 * Check download status from client and validate response
 *
 * Queries the download client for the current status of a download,
 * validates the response against the expected schema, and returns
 * a type-safe validated status object.
 *
 * @param downloadService - Download service to query
 * @param clientType - Type of download client (e.g., 'qbittorrent', 'transmission')
 * @param downloadId - Client-specific download identifier
 * @returns AsyncResult containing validated download status or error
 *
 * @example
 * ```typescript
 * const result = await checkDownloadStatus(
 *   downloadService,
 *   'transmission',
 *   'abc123'
 * );
 *
 * if (result.isErr()) {
 *   logger.error('Failed to check status', { error: result.error });
 *   return;
 * }
 *
 * const status = result.value;
 * if (isDownloadComplete(status.status)) {
 *   // Handle completed download
 * }
 * ```
 */
export async function checkDownloadStatus(
  downloadService: ClientDownloadService,
  clientType: string,
  downloadId: string
): Promise<AsyncResult<ValidatedDownloadStatus, Error>> {
  // Query download client for status
  const statusResult = await downloadService.getDownloadStatus(clientType, downloadId);

  if (isError(statusResult)) {
    logger.error(`[DownloadStatusChecker] Failed to get status for download ${downloadId} from ${clientType}:`, statusResult.error);
    return createErrorResult(new Error(`Failed to get download status: ${statusResult.error instanceof Error ? statusResult.error.message : String(statusResult.error)}`));
  }

  if (!isSuccess(statusResult)) {
    logger.warn(`[DownloadStatusChecker] No status result for download ${downloadId}`);
    return createErrorResult(new Error('No status result returned from download client'));
  }

  // Validate with Zod schema
  const statusParse = DownloadStatusSchema.safeParse(statusResult.data);
  if (!statusParse.success) {
    logger.warn(`[DownloadStatusChecker] Invalid download status format for ${downloadId}:`, statusParse.error);
    return createErrorResult(new Error(`Invalid download status format: ${statusParse.error.message}`));
  }

  const downloadStatus = statusParse.data as ValidatedDownloadStatus;

  // Log status for debugging
  logDownloadStatus(downloadId, downloadStatus, clientType);

  return createSuccessResult(downloadStatus);
}

/**
 * Check if download is ready for import (COMPLETED or SEEDING)
 *
 * Downloads in COMPLETED or SEEDING status have finished downloading
 * and are ready to be imported into the library.
 *
 * @param status - Download status string
 * @returns True if download is completed or seeding
 *
 * @example
 * ```typescript
 * if (isDownloadComplete(status)) {
 *   await importDownload(downloadId);
 * }
 * ```
 */
export function isDownloadComplete(status: string): boolean {
  return status === 'COMPLETED' || status === 'SEEDING';
}

/**
 * Check if download has failed
 *
 * Downloads with ERROR or FAILED status should be marked as failed
 * and potentially retried or reported to the user.
 *
 * @param status - Download status string
 * @returns True if download has failed
 *
 * @example
 * ```typescript
 * if (isDownloadFailed(status)) {
 *   await markJobAsFailed(jobId);
 * }
 * ```
 */
export function isDownloadFailed(status: string): boolean {
  return status === 'ERROR' || status === 'FAILED';
}

/**
 * Log download status for debugging
 *
 * Logs comprehensive information about a download status check
 * including all available fields and metadata.
 *
 * @param downloadId - Download identifier
 * @param status - Validated download status
 * @param clientType - Type of download client
 *
 * @example
 * ```typescript
 * logDownloadStatus(downloadId, validatedStatus, 'transmission');
 * // Logs: [DownloadStatusChecker] Download abc123 status check: { ... }
 * ```
 */
export function logDownloadStatus(
  downloadId: string,
  status: ValidatedDownloadStatus,
  clientType: string
): void {
  logger.debug(`[DownloadStatusChecker] Download ${downloadId} status check:`, {
    status: status.status,
    savePath: status.savePath,
    name: status.name,
    size: status.size,
    clientType,
    hasError: status.error !== undefined,
    error: status.error,
    progress: status.progress,
    clientSpecific: status.clientSpecific
  });
}
