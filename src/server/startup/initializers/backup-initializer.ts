/**
 * Backup Initializer Module
 *
 * Initializes the backup scheduling system with automatic backup configuration.
 *
 * Extracted from: src/server/index.ts (lines 218-282)
 */

import { scheduleBackupTask } from '@/server/queue/backup';
import { getAllConfigServices } from '@/server/services/config/globalConfigService';
import { logger } from '@/utils/logger';

import { formatError } from '../error-utils';

// Module-level interval tracking for cleanup
let backupSchedulerInterval: NodeJS.Timeout | null = null;

/**
 * Initializes the backup scheduling system
 *
 * This function:
 * - Retrieves backup settings from the database
 * - Schedules initial backup if enabled
 * - Sets up recurring backup schedule based on configuration
 * - Returns cleanup function for graceful shutdown
 *
 * @returns Cleanup function to stop the scheduler
 */
export async function initializeBackupScheduler(): Promise<() => void> {
  // Clear any existing interval first
  if (backupSchedulerInterval) {
    clearInterval(backupSchedulerInterval);
    backupSchedulerInterval = null;
  }

  try {
    // Get backup settings from the configuration service
    const { general } = getAllConfigServices();
    const backupSettings = await general.getBackupSettings();

    // Check if automatic backups are enabled
    if (!backupSettings.autoBackup) {
      logger.info('Automatic backups are disabled');
      return () => {}; // Return no-op cleanup
    }

    // Intentionally NOT scheduling a backup here. Previously this fired
    // scheduleBackupTask() on every cold start, so each server restart
    // enqueued a full backup. With Backup.name UNIQUE + the date-stamped
    // name pattern in queue/backup.ts, a same-day restart would also
    // collide with whatever the recurring tick had already produced.
    // The recurring schedule below fires its first iteration at +interval,
    // which is the expected setInterval semantic.

    // Set up recurring backup schedule
    let interval: number;

    switch (backupSettings.backupFrequency) {
      case 'daily':
        interval = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case 'weekly':
        interval = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case 'monthly':
        interval = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      default:
        interval = 24 * 60 * 60 * 1000; // Default to daily
        logger.warn(`Unknown backup frequency: ${backupSettings.backupFrequency}, defaulting to daily`);
    }

    // Set up recurring schedule WITH reference stored
    backupSchedulerInterval = setInterval(() => {
      void (async () => {
        try {
          // Re-read settings to get latest configuration
          const freshSettings = await general.getBackupSettings();

          // Skip if auto-backup is now disabled
          if (!freshSettings.autoBackup) {
            logger.info('Skipping scheduled backup: automatic backups now disabled');
            return;
          }

          const newTaskId = await scheduleBackupTask();
          if (newTaskId) {
            logger.info(`Scheduled backup task with ID: ${newTaskId}`);
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to schedule backup: ${formatError(errorMessage)}`);
        }
      })();
    }, interval);

    logger.info(`Backup scheduler initialized with ${backupSettings.backupFrequency} frequency`);

    // Return cleanup function
    return () => {
      if (backupSchedulerInterval) {
        clearInterval(backupSchedulerInterval);
        backupSchedulerInterval = null;
        logger.info('Backup scheduler stopped');
      }
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize backup scheduler: ${formatError(errorMessage)}`);
    return () => {}; // Return no-op cleanup
  }
}

/**
 * Stop Backup Scheduler
 *
 * Stops the backup scheduler interval.
 * Call this on application shutdown.
 */
export function stopBackupScheduler(): void {
  if (backupSchedulerInterval) {
    clearInterval(backupSchedulerInterval);
    backupSchedulerInterval = null;
    logger.info('Backup scheduler stopped');
  }
}
