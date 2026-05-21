/**
 * Backup Scheduling Module
 *
 * Handles scheduling of backup tasks through the queue system.
 *
 * Extracted from: backup/index.ts (lines 783-807)
 */

import { BackupType, BackupContent, JobType } from '@prisma/client';

import { logger } from '@/utils/logger';



import { generateBackupName } from './utils';

/**
 * Schedule Backup Task
 *
 * Creates a scheduled backup task with specified options.
 * Integrates with the task queue system.
 *
 * @param options - Backup scheduling options
 * @returns Created task ID
 * @throws If scheduling fails
 *
 * @example
 * ```typescript
 * const taskId = await scheduleBackup({
 *   type: BackupType.SCHEDULED,
 *   contents: [BackupContent.DATABASE],
 *   name: 'nightly_backup'
 * });
 * ```
 */
export async function scheduleBackup(
  options: {
    type?: BackupType;
    contents?: BackupContent[];
    name?: string;
    notes?: string;
  } = {}
): Promise<bigint> {
  try {
    const {
      type = BackupType.SCHEDULED,
      contents = [BackupContent.DATABASE, BackupContent.CONFIGURATION],
      name = generateBackupName('scheduled'),
      notes = 'Scheduled backup',
    } = options;

    // Get the queue manager
    const { queueManager } = await import('@/server/queue/queueManager');

    // Enqueue a backup task
    const taskId = await queueManager.enqueue(JobType.backup_create, {
      type,
      contents,
      name,
      notes,
    });

    logger.info(`Scheduled backup task with ID ${taskId}`);
    return taskId;
  } catch (error: unknown) {
    logger.error(
      `Failed to schedule backup: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}
