/**
 * @module server/queue/backup
 * @description Backup task handlers and scheduling utilities
 * Provides functionality for:
 * - Creating and executing backup tasks
 * - Scheduling automated backups
 * - Managing backup retention policies
 *
 * @example
 * ```ts
 * // Create a manual backup
 * await handleBackupTask({
 *   type: BackupType.MANUAL,
 *   contents: [BackupContent.DATABASE],
 *   name: 'pre-update-backup'
 * });
 *
 * // Schedule automated backup
 * const taskId = await scheduleBackupTask();
 * ```
 */

import { BackupType } from '@prisma/client';
import { BackupContent } from '@prisma/client';

import { logger } from '@/utils/logger';


import { backupService } from '../services/backup/index';
import { getGeneralConfigService } from '../services/config/generalConfigService';
import { getGlobalConfigService } from '../services/config/globalConfigService';
/**
 * Executes a backup task with specified parameters
 * Creates a backup and enforces retention policies
 *
 * @param {Object} payload - Backup task configuration
 * @param {BackupType} payload.type - Type of backup (manual/scheduled)
 * @param {BackupContent[]} payload.contents - Content types to include
 * @param {string} [payload["name"]] - Optional backup name
 * @param {string} [payload.notes] - Optional backup notes
 * @returns {Promise<void>}
 * @throws {Error} When backup creation fails
 *
 * @example
 * ```ts
 * await handleBackupTask({
 *   type: BackupType.MANUAL,
 *   contents: [BackupContent.DATABASE, BackupContent.CONFIGURATION],
 *   name: 'weekly-backup',
 *   notes: 'Regular weekly backup'
 * });
 * ```
 */
export async function handleBackupTask(payload: {
    type: BackupType;
    contents: BackupContent[];
    name?: string;
    notes?: string;
}): Promise<void> {
    const { type, contents, name, notes } = payload;
    try {
        logger.info(`Starting backup task: ${name ?? 'unnamed'}`);
        // Create the backup
        const backupId = await backupService.createBackup({
            type,
            contents,
            ...(name !== undefined && { name }),
            ...(notes !== undefined && { notes })
        });
        // Enforce retention policy after successful backup
        await backupService.enforceRetentionPolicy();
        logger.info(`Backup task completed successfully: ${name ?? 'unnamed'} (ID: ${backupId})`);
    }
    catch (error: unknown) {
        logger.error(`Backup task failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
/**
 * Creates a scheduled backup task based on system settings
 * Reads backup configuration and schedules appropriate backup tasks
 *
 * @returns {Promise<number | null>} ID of created task or null if backup is disabled/fails
 * @throws {Error} When settings cannot be read
 *
 * @example
 * ```ts
 * // Schedule backup based on system settings
 * const taskId = await scheduleBackupTask();
 * if (taskId) {
 *   logger.info(`Backup scheduled with ID: ${taskId}`);
 * }
 * ```
 */
export async function scheduleBackupTask(): Promise<number | null> {
    try {
        // Get backup settings from the configuration service
        const configService = getGlobalConfigService();
        const generalConfigService = getGeneralConfigService(configService);
        const backupSettings = await generalConfigService.getBackupSettings();
        // backupSettings is always defined due to getBackupSettings type signature
        // if (!backupSettings) {
        //     logger.warn('No settings found for backup scheduling');
        //     return null;
        // }
        // Extract backup settings from configuration
        const { autoBackup: backupEnabled = false, backupFrequency = 'daily', includeImages: backupIncludeMedia = false } = backupSettings;
        // Skip if backups are disabled
        if (!backupEnabled) {
            logger.info('Automatic backups are disabled');
            return null;
        }
        // Determine what to include in the backup
        // Always include database and configuration
        const contents: BackupContent[] = [BackupContent.DATABASE, BackupContent.CONFIGURATION];

        if (backupIncludeMedia) {
            contents.push(BackupContent.MEDIA_FILES);
        }
        // Schedule the backup
        const taskId = await backupService.scheduleBackup({
            type: BackupType.SCHEDULED,
            contents,
            name: `scheduled_${backupFrequency.toLowerCase()}_${new Date().toISOString().split('T')[0]}`,
            notes: `Scheduled ${backupFrequency.toLowerCase()} backup`
        });
        logger.info(`Scheduled backup task with ID ${taskId}`);
        return Number(taskId);
    }
    catch (error: unknown) {
        logger.error(`Failed to schedule backup task: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}
/**
 * Collection of backup-related task handlers
 * @interface BackupTasks
 */
const backupTasks = {
    handleBackupTask,
    scheduleBackupTask
};
// Export the named object as default
export default backupTasks;
