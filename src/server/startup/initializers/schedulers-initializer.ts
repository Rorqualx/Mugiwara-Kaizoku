/**
 * Schedulers Initializer Module
 *
 * Initializes all background schedulers including auto-download, calendar sync,
 * calendar maintenance, download monitoring, and Native download worker.
 *
 * Extracted from: src/server/index.ts (lines 354-506)
 */

import { autoDownloadScheduler } from '@/server/queue/autoDownloadScheduler';
import { calendarMaintenanceScheduler } from '@/server/queue/calendar/CalendarMaintenanceScheduler';
import { calendarSyncScheduler } from '@/server/queue/calendar/CalendarSyncScheduler';
import { downloadMonitorScheduler } from '@/server/queue/downloadMonitorScheduler';
import { configService } from '@/server/services/config/configService';
import { startNativeDownloadWorker } from '@/server/services/downloads/NativeDownloadWorker';
import { imageCacheCleanupService } from '@/server/services/image-cache/ImageCacheCleanupService';
import { logRetentionService } from '@/server/services/logging';
import { logger } from '@/utils/logger';

import { formatError } from '../error-utils';

/**
 * Initializes the auto-download scheduler
 *
 * This function:
 * - Reads the scheduler interval from Config (default: 1 hour)
 * - Updates the scheduler with the configured interval
 * - Starts the auto-download scheduler that periodically checks download rules
 *
 * @throws {Error} If scheduler initialization fails
 */
export async function initializeAutoDownloadScheduler(): Promise<void> {
  try {
    logger.info('Initializing auto-download scheduler...');

    // Read scheduler interval from Config table.
    // Default: 3600 seconds (1 hour). The previous 24h default meant a
    // newly-enabled monitoring rule sat unprocessed for up to a day, and the
    // outer poll never matched the per-rule checkInterval (3600s) so the
    // per-rule setting was effectively dead. 1h matches Sonarr-style RSS
    // sync cadence and the default per-rule check interval.
    const schedulerInterval = await configService.get<number>(
      'scheduler.autoDownload.interval',
      3600
    );

    logger.info(`Auto-download scheduler interval: ${schedulerInterval}s (${schedulerInterval / 3600}h)`);

    // Update scheduler interval before starting
    autoDownloadScheduler.setInterval(schedulerInterval as number);

    // Start the scheduler
    await autoDownloadScheduler.start();

    logger.info('Auto-download scheduler initialized successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize auto-download scheduler: ${formatError(errorMessage)}`);
    // Don't throw - auto-downloads are not critical for server startup
  }
}

/**
 * Initializes the calendar sync scheduler
 *
 * This function:
 * - Starts the calendar sync scheduler that periodically detects release patterns
 * - Generates calendar events for upcoming releases
 * - Runs hourly pattern detection and daily cleanup
 *
 * @throws {Error} If scheduler initialization fails
 */
export async function initializeCalendarSyncScheduler(): Promise<void> {
  try {
    logger.info('Initializing calendar sync scheduler...');

    // Start the scheduler
    await calendarSyncScheduler.start();

    logger.info('Calendar sync scheduler initialized successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize calendar sync scheduler: ${formatError(errorMessage)}`);
    // Don't throw - calendar sync is not critical for server startup
  }
}

/**
 * Initializes the calendar maintenance scheduler
 *
 * This function:
 * - Starts the calendar maintenance scheduler that runs daily cleanup tasks
 * - Removes old events and notifications
 * - Refreshes stale patterns
 * - Fixes orphaned events and duplicates
 *
 * @throws {Error} If scheduler initialization fails
 */
export async function initializeCalendarMaintenanceScheduler(): Promise<void> {
  try {
    logger.info('Initializing calendar maintenance scheduler...');

    // Start the scheduler
    await calendarMaintenanceScheduler.start();

    logger.info('Calendar maintenance scheduler initialized successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize calendar maintenance scheduler: ${formatError(errorMessage)}`);
    // Don't throw - maintenance is not critical for server startup
  }
}

/**
 * Initializes the download monitor scheduler
 *
 * This function:
 * - Starts the download monitor scheduler that periodically checks download clients
 * - Detects completed downloads and imports files into manga library
 * - Runs every 2 minutes by default
 *
 * @throws {Error} If scheduler initialization fails
 */
export async function initializeDownloadMonitorScheduler(): Promise<void> {
  try {
    logger.info('Initializing download monitor scheduler...');

    // Start the scheduler
    await downloadMonitorScheduler.start();

    logger.info('Download monitor scheduler initialized successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize download monitor scheduler: ${formatError(errorMessage)}`);
    // Don't throw - download monitoring is not critical for server startup
  }
}

/**
 * Initializes the Native download worker
 *
 * This function:
 * - Starts the Native download worker that processes chapter downloads
 * - Polls for pending download jobs from custom website sources
 * - Downloads images and creates CBZ archives
 * - Updates job progress and chapter records
 *
 * @throws {Error} If worker initialization fails
 */
export function initializeNativeDownloadWorker(): Promise<void> {
  try {
    logger.info('Initializing Native download worker...');

    // Start the worker
    startNativeDownloadWorker();

    logger.info('Native download worker initialized successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize Native download worker: ${formatError(errorMessage)}`);
    // Don't throw - Native downloads are not critical for server startup
    return Promise.resolve();
  }
}

/**
 * Initializes the log retention service
 *
 * This function:
 * - Starts the log retention service that runs daily at 4 AM
 * - Cleans up old log files based on KAIZOKU_LOG_RETENTION_DAYS (default: 30)
 * - Removes both plain text and gzip-compressed log files
 *
 * @throws {Error} If service initialization fails
 */
export async function initializeLogRetentionService(): Promise<void> {
  try {
    logger.info('Initializing log retention service...');

    // Start the service
    const result = await logRetentionService.start();

    if (result.status === 'error') {
      logger.error(`Failed to initialize log retention service: ${formatError(result.error.message)}`);
      return;
    }

    logger.info('Log retention service initialized successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize log retention service: ${formatError(errorMessage)}`);
    // Don't throw - log retention is not critical for server startup
  }
}

/**
 * Initializes the image cache cleanup service
 *
 * This function:
 * - Starts the image cache cleanup service that runs daily at 3 AM
 * - Deletes only orphaned cached images (cover/banner art no live manga references),
 *   so cover art for existing manga is kept permanently and never re-downloaded
 * - Optionally enforces IMAGE_CACHE_MAX_ENTRIES cap (default: 0 = disabled)
 *
 * @throws {Error} If service initialization fails
 */
export function initializeImageCacheCleanupService(): void {
  try {
    logger.info('Initializing image cache cleanup service...');

    const result = imageCacheCleanupService.start();

    if (result.status === 'error') {
      logger.error(`Failed to initialize image cache cleanup: ${formatError(result.error.message)}`);
      return;
    }

    logger.info('Image cache cleanup service initialized successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize image cache cleanup: ${formatError(errorMessage)}`);
    // Don't throw - image cache cleanup is not critical for server startup
  }
}
