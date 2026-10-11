/**
 * Backup Initializer Module
 *
 * Initializes the backup scheduling system with automatic backup configuration.
 *
 * Extracted from: src/server/index.ts (lines 218-282)
 */

import { BackupType, JobStatus, JobType } from '@prisma/client';

import { prisma } from '@/server/db';
import { scheduleBackupTask } from '@/server/queue/backup';
import { getAllConfigServices } from '@/server/services/config/globalConfigService';
import { logger } from '@/utils/logger';

import { formatError } from '../error-utils';

// Module-level interval tracking for cleanup
let backupSchedulerInterval: NodeJS.Timeout | null = null;
let backupInitialCheck: NodeJS.Timeout | null = null;
let backupCheckInFlight = false;

const HOUR_MS = 60 * 60 * 1000;
/** How often to ask "is a backup due?". Far below the 2^31-1 ms timer limit. */
const CHECK_INTERVAL_MS = HOUR_MS;
/** First check shortly after boot, once startup work has settled. */
const INITIAL_CHECK_DELAY_MS = 5 * 60 * 1000;

const BACKUP_INTERVAL_MS: Record<string, number> = {
  daily: 24 * HOUR_MS,
  weekly: 7 * 24 * HOUR_MS,
  monthly: 30 * 24 * HOUR_MS,
};

/**
 * Whether a scheduled backup is due.
 *
 * @param lastScheduledAt creation time of the newest SCHEDULED backup (any
 *   status, so a pending or running one counts), or null when there is none
 */
export function isBackupDue(lastScheduledAt: Date | null, frequency: string, now: Date = new Date()): boolean {
  if (!lastScheduledAt) return true;
  const interval = BACKUP_INTERVAL_MS[frequency] ?? BACKUP_INTERVAL_MS['daily'] ?? 24 * HOUR_MS;
  return now.getTime() - lastScheduledAt.getTime() >= interval;
}

/** One scheduler tick: enqueue a backup if auto-backup is on and one is due. */
async function checkAndScheduleBackup(): Promise<void> {
  if (backupCheckInFlight) return;
  backupCheckInFlight = true;
  try {
    // Re-read settings so changes apply without a restart
    const { general } = getAllConfigServices();
    const settings = await general.getBackupSettings();
    if (!settings.autoBackup) return;

    const latest = await prisma.backup.findFirst({
      where: { type: BackupType.SCHEDULED },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!isBackupDue(latest?.createdAt ?? null, settings.backupFrequency)) return;

    // The Backup row is only written when the job runs; don't queue a second
    // backup behind one that is still waiting or running.
    const queued = await prisma.jobs.count({
      where: {
        job_type: JobType.backup_create,
        status: { in: [JobStatus.pending, JobStatus.retrying, JobStatus.active] },
      },
    });
    if (queued > 0) return;

    const newTaskId = await scheduleBackupTask();
    if (newTaskId) {
      logger.info(`Scheduled backup task with ID: ${newTaskId}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to schedule backup: ${formatError(errorMessage)}`);
  } finally {
    backupCheckInFlight = false;
  }
}

/**
 * Initializes the backup scheduling system
 *
 * This function:
 * - Retrieves backup settings from the database
 * - Starts an hourly check that enqueues a backup when one is due
 * - Returns cleanup function for graceful shutdown
 *
 * @returns Cleanup function to stop the scheduler
 */
export async function initializeBackupScheduler(): Promise<() => void> {
  // Clear any existing timers first
  stopBackupScheduler();

  try {
    // Get backup settings from the configuration service
    const { general } = getAllConfigServices();
    const backupSettings = await general.getBackupSettings();

    // The loop runs even when automatic backups are off: each tick re-reads
    // the setting, so enabling them later takes effect without a restart.
    if (!backupSettings.autoBackup) {
      logger.info('Automatic backups are disabled');
    }

    // Due-ness comes from the database (age of the newest SCHEDULED backup),
    // checked hourly. The old design slept for the whole backup interval in one
    // setInterval, which had two faults: 30 days exceeds the 2^31-1 ms timer
    // limit, so the runtime clamped it to 1 ms and flooded the queue with
    // backup jobs; and the countdown restarted on every boot, so a server
    // restarted more often than the interval never produced a backup.
    const runCheck = (): void => {
      void checkAndScheduleBackup();
    };
    backupInitialCheck = setTimeout(runCheck, INITIAL_CHECK_DELAY_MS);
    backupSchedulerInterval = setInterval(runCheck, CHECK_INTERVAL_MS);

    logger.info(`Backup scheduler initialized with ${backupSettings.backupFrequency} frequency`);

    // Return cleanup function
    return stopBackupScheduler;
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
  if (backupInitialCheck) {
    clearTimeout(backupInitialCheck);
    backupInitialCheck = null;
  }
  if (backupSchedulerInterval) {
    clearInterval(backupSchedulerInterval);
    backupSchedulerInterval = null;
    logger.info('Backup scheduler stopped');
  }
}
