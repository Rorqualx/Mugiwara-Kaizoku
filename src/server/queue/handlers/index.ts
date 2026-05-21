/**
 * Job Handlers Registry
 *
 * Maps job types to their handler functions for the high-performance queue
 *
 * @module server/queue/handlers
 */

import { JobType, jobs } from '@prisma/client';

import { logger } from '@/utils/logger';



import { JobHandler } from '../PostgreSQLQueueWorker';

// Import specific handlers
import { handleBackupCreate } from './backup';
import { handleChapterCheck, handleChapterDownload } from './chapter';
import { handleGetComicsDownload } from './getcomics';
import { handleLibraryScan } from './library';
import { handleMangaDexDownload } from './mangadex-download';
import { handleMetadataRefresh } from './metadata';
import { handleNativeDownload } from './native-download';
import { handleNotificationSend } from './notification';
import { handleSuwayomiDownload } from './suwayomi-download';

/**
 * Registry of all job handlers
 */
export const jobHandlers: Map<JobType, JobHandler> = new Map([
  // Metadata operations
  [JobType.metadata_refresh, handleMetadataRefresh],
  [JobType.metadata_update, handleMetadataRefresh],
  [JobType.metadata_sync, handleMetadataRefresh],

  // Chapter operations
  [JobType.chapter_check, handleChapterCheck],
  [JobType.chapter_download, handleChapterDownload],
  [JobType.chapter_sync, handleChapterCheck],

  // Library operations
  [JobType.library_scan, handleLibraryScan],
  [JobType.library_import, handleLibraryScan],

  // Notification operations
  [JobType.notification_send, handleNotificationSend],
  [JobType.notification_batch, handleNotificationSend],

  // Backup operations.
  // backup_restore is intentionally not mapped: restore is invoked synchronously
  // from the tRPC routers via backupService.restoreBackup, and no producer in
  // the codebase enqueues JobType.backup_restore. The previous mapping pointed
  // at handleBackupCreate (a copy-paste typo) which would have made restore
  // jobs create new backups instead of restoring.
  [JobType.backup_create, handleBackupCreate],

  // Native download operations
  [JobType.native_download, handleNativeDownload],
  [JobType.native_sync, handleNativeDownload],

  // Maintenance operations (handled internally)
  [JobType.maintenance_cleanup, (job: jobs): Promise<void> => {
    logger.info(`Running maintenance cleanup job ${job["id"]}`);
    // Cleanup logic here
    return Promise.resolve();
  }],
  [JobType.maintenance_vacuum, (job: jobs): Promise<void> => {
    logger.info(`Running maintenance vacuum job ${job["id"]}`);
    // Vacuum logic here
    return Promise.resolve();
  }],
  [JobType.maintenance_reindex, (job: jobs): Promise<void> => {
    logger.info(`Running maintenance reindex job ${job["id"]}`);
    // Reindex logic here
    return Promise.resolve();
  }],
]);

// MangaDex download handler
jobHandlers.set(JobType.mangadex_download, handleMangaDexDownload);

// GetComics download handler
jobHandlers.set(JobType.getcomics_download, handleGetComicsDownload);

// Suwayomi download handler (library-source bridge for Mihon-extension chapters)
jobHandlers.set(JobType.suwayomi_download, handleSuwayomiDownload);

/**
 * Register all handlers with the queue manager
 */
export function registerAllHandlers(queueManager: unknown): void {
  for (const [jobType, handler] of jobHandlers) {
    (queueManager as { registerHandler: (type: JobType, handler: JobHandler) => void }).registerHandler(jobType, handler);
  }
  logger.info(`Registered ${jobHandlers.size} job handlers`);
}
