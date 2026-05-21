/**
 * @module native-downloadHandlers
 * @description Native download-specific task handlers for background job processing
 * Handles Native download operations, source synchronization, and validation
 */

import { NativeDownloadStatus } from '@prisma/client';
import { JobType } from '@prisma/client';

import { toStringId } from '@/utils/id-converters';
import type { JobError } from '@/utils/job-validation';
import { logger } from '@/utils/logger';


import { prisma } from "../db";
import { getNativeDownloadManager } from '../services/native-download/NativeDownloadManager';

// Define Native download-specific payload types
export interface NativeDownloadPayload {
  downloadId: string;
}
export interface NativeDownloadSourceSyncPayload {
  sourceId: string;
  force?: boolean;
  fullSync?: boolean;
}
export interface NativeDownloadValidateSourcePayload {
  sourceId: string;
  testQuery?: string;
}
/**
 * Handler for Native download tasks
 * Downloads chapters using the Native downloader
 *
 * @param {NativeDownloadPayload} taskData - Task payload containing download info
 * @throws {JobError} When download fails
 *
 * @example
 * ```ts
 * await handleNativeDownloadTask({
 *   downloadId: 'cuid123',
 *   sourceId: 'source123',
 *   mangaId: 1,
 *   chapterId: 'ch-456',
 *   chapterNumber: 42
 * });
 * ```
 */
export const handleNativeDownloadTask = async (taskData: NativeDownloadPayload): Promise<void> => {
  const { downloadId } = taskData;
  try {
    logger.info(`Starting Native download task for download: ${downloadId}`);
    // Get the download record
    const download = await prisma.nativeDownload.findUnique({
      where: {
        id: downloadId
      }
    });
    if (!download) {
      const error = new Error(`Download ${downloadId} not found`) as JobError;
      error.code = 'INVALID_STATE';
      error.jobType = JobType.native_download;
      throw error;
    }
    // Get the Native download manager
    const manager = await getNativeDownloadManager();
    // Start the download (use sourceType or sourceId as source identifier)
    const sourceId = download.sourceType ?? download.sourceId ?? 'unknown';
    const result = await manager.downloadChapter(sourceId, toStringId(download.mangaId), download.chapterId ? toStringId(download.chapterId) : '', download["id"]);
    // Check if download was successful
    if (result["status"] === 'error') {
      const error = new Error(`Download failed: ${result.error instanceof Error ? result.error.message : String(result.error)}`) as JobError;
      error.code = 'INVALID_STATE';
      error.jobType = JobType.native_download;
      throw error;
    }
    logger.info(`Native download completed for chapter ${download.chapterNumber}`);
  }
  catch (error: unknown) {
    logger.error('Native download task failed:', error instanceof Error ? error.message : String(error));
    // Update download status to failed
    await prisma.nativeDownload.update({
      where: {
        id: downloadId
      },
      data: {
        status: NativeDownloadStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        endTime: new Date()
      }
    });
    throw error;
  }
};
/**
 * Handler for Native download source sync tasks
 * Note: Custom source management has been removed. This is a no-op for backward compatibility.
 *
 * @param {NativeDownloadSourceSyncPayload} taskData - Task payload containing source info
 */
export const handleNativeDownloadSourceSyncTask = async (taskData: NativeDownloadSourceSyncPayload): Promise<void> => {
  const { sourceId, fullSync } = taskData;
  logger.info(`Native download source sync requested for source: ${sourceId} (custom sources disabled)`, {
    fullSync
  });
  // No-op: Custom source management has been removed
  await Promise.resolve();
};

/**
 * Handler for Native download source validation tasks
 * Note: Custom source management has been removed. This is a no-op for backward compatibility.
 *
 * @param {NativeDownloadValidateSourcePayload} taskData - Task payload containing validation info
 */
export const handleNativeDownloadValidateSourceTask = async (taskData: NativeDownloadValidateSourcePayload): Promise<void> => {
  const { sourceId, testQuery } = taskData;
  logger.info(`Native download source validation requested for source: ${sourceId} (custom sources disabled)`, {
    testQuery
  });
  // No-op: Custom source management has been removed
  await Promise.resolve();
};