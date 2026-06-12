/**
 * System Backup Router
 *
 * Handles backup management operations including creation, restoration,
 * scheduling, and deletion of system backups.
 *
 * Procedures:
 * - getBackups: List available backups
 * - createBackup: Create a new backup
 * - deleteBackup: Delete a backup
 * - restoreBackup: Restore from backup
 * - scheduleBackup: Configure automatic backups
 *
 * Extracted from: system.ts (lines 193-372)
 *
 * @module system/backup
 */

import { BackupType, BackupContent } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { backupService } from '@/server/services/backup/index';
import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { toTRPCError } from '@/server/trpc/errors';
import { adminProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logging';


// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Result type for getBackups procedure
 */
interface GetBackupsResult {
  backups: unknown[];
}

/**
 * Result type for createBackup procedure
 */
interface CreateBackupResult {
  backupId: number;
}

/**
 * Result type for scheduleBackup procedure
 */
interface ScheduleBackupResult {
  message: string;
  taskId: string;
}

// ============================================================================
// Router Definition
// ============================================================================

export const systemBackupRouter = router({
  /**
   * Retrieves a list of available backups
   *
   * This endpoint queries the backup service to get a list of all
   * previously created backups, including their metadata and status.
   *
   * @returns {Promise<GetBackupsResult>} List of available backups
   */
  getBackups: adminProcedure.query(async (): Promise<GetBackupsResult> => {
    try {
      // Type assertion to handle the type mismatch until Prisma client is regenerated
      const backups = await (backupService.listBackups as () => Promise<unknown[]>)();
      return { backups };
    }
    catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get backups', { error: errorMessage });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve backups. Please try again.',
        cause: error,
      });
    }
  }),

  /**
   * Creates a new backup
   *
   * This endpoint initiates the creation of a new backup with the specified
   * parameters. It can include database data, configuration files, and/or
   * media files based on the provided options.
   *
   * @param {Object} input - Backup creation parameters
   * @param {string} [input.name] - Optional name for the backup
   * @param {string} [input.notes] - Optional notes about the backup
   * @param {Array<string>} [input.contents] - What to include in the backup (DATABASE, CONFIGURATION, MEDIA_FILES)
   * @returns {Promise<CreateBackupResult>} ID of the created backup
   */
  createBackup: adminProcedure
    .input(z.object({
      name: z.string().max(255).optional(),
      notes: z.string().max(1000).optional(),
      contents: z.array(z.enum(['DATABASE', 'CONFIGURATION', 'MEDIA_FILES'])).optional()
    }))
    .mutation(async ({ input }): Promise<CreateBackupResult> => {
      try {
        const contents = input.contents?.map((content) => {
          switch (content) {
            case 'DATABASE': return BackupContent.DATABASE;
            case 'CONFIGURATION': return BackupContent.CONFIGURATION;
            case 'MEDIA_FILES': return BackupContent.MEDIA_FILES;
            default: return BackupContent.DATABASE;
          }
        }) ?? [BackupContent.DATABASE, BackupContent.CONFIGURATION];

        // Build backup config matching createBackup parameter type
        const backupConfig: {
          name?: string;
          type?: BackupType;
          contents?: BackupContent[];
          notes?: string;
        } = {
          type: BackupType.MANUAL,
          contents,
          ...(input.name && { name: input.name }),
          ...(input.notes && { notes: input.notes })
        };

        // Emit backup started event
        void realtimeEmitter.emitBackupOperation({
          operation: 'started',
          name: input.name,
        });

        const backupId = await backupService.createBackup(backupConfig);

        // Emit backup completed event
        void realtimeEmitter.emitBackupOperation({
          backupId,
          operation: 'completed',
          name: input.name,
        });

        return { backupId };
      }
      catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to create backup', { error: errorMessage, input });

        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: errorMessage,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create backup. Please try again.',
          cause: error,
        });
      }
    }),

  /**
   * Deletes a backup
   *
   * This endpoint removes a specific backup identified by its ID.
   * This operation cannot be undone.
   *
   * @param {Object} input - Delete parameters
   * @param {number} input.id - ID of the backup to delete
   * @returns {Promise<null>} Resolves when the backup has been deleted
   */
  deleteBackup: adminProcedure
    .input(z.object({
      id: z.number().int().positive()
    }))
    .mutation(async ({ input }): Promise<null> => {
      try {
        await backupService.deleteBackup(input.id);

        // Emit backup deleted event
        void realtimeEmitter.emitBackupOperation({
          backupId: input.id,
          operation: 'deleted',
        });

        return null;
      }
      catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to delete backup', { error: errorMessage, backupId: input.id });

        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: errorMessage,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete backup. Please try again.',
          cause: error,
        });
      }
    }),

  /**
   * Restores a backup
   *
   * This endpoint initiates the restoration of a specific backup,
   * which will replace the current system state with the backed-up data.
   * This operation may require a system restart to complete.
   *
   * @param {Object} input - Restore parameters
   * @param {number} input.id - ID of the backup to restore
   * @returns {Promise<null>} Resolves when the restore has been initiated
   */
  restoreBackup: adminProcedure
    .input(z.object({
      id: z.number().int().positive()
    }))
    .mutation(async ({ input }): Promise<null> => {
      try {
        // Emit restore started event
        void realtimeEmitter.emitBackupOperation({
          backupId: input.id,
          operation: 'started',
        });

        await backupService.restoreBackup(input.id);

        // Emit restore completed event
        void realtimeEmitter.emitBackupOperation({
          backupId: input.id,
          operation: 'restored',
        });

        return null;
      }
      catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to restore backup', { error: errorMessage, backupId: input.id });

        // Emit restore failed event
        void realtimeEmitter.emitBackupOperation({
          backupId: input.id,
          operation: 'failed',
          error: errorMessage,
        });

        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: errorMessage,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to restore backup. Please try again.',
          cause: error,
        });
      }
    }),

  /**
   * Configures and schedules automatic backups
   *
   * This endpoint updates the backup schedule settings and initiates
   * a scheduled backup task based on the provided configuration.
   *
   * @param {Object} input - Schedule parameters
   * @param {string} [input.schedule] - Backup frequency (DAILY, WEEKLY, MONTHLY, CUSTOM)
   * @param {string} [input.customCron] - Custom cron expression for advanced scheduling
   * @param {number} [input.retentionDays] - Number of days to keep backups (1-365)
   * @param {number} [input.maxCount] - Maximum number of backups to keep (1-100)
   * @param {boolean} [input.includeDatabase] - Whether to include database in backups
   * @param {boolean} [input.includeConfig] - Whether to include configuration in backups
   * @param {boolean} [input.includeMedia] - Whether to include media files in backups
   * @returns {Promise<ScheduleBackupResult>} Confirmation message and task ID
   */
  scheduleBackup: adminProcedure
    .input(z.object({
      schedule: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
      customCron: z.string().max(100).regex(/^(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)$/, 'Invalid cron expression').optional(),
      retentionDays: z.number().int().min(1).max(365).optional(),
      maxCount: z.number().int().min(1).max(100).optional(),
      includeDatabase: z.boolean().optional(),
      includeConfig: z.boolean().optional(),
      includeMedia: z.boolean().optional()
    }))
    .mutation(async ({ input }): Promise<ScheduleBackupResult> => {
      try {
        // Get ConfigService instance
        const configService = getGlobalConfigService();
        if (!configService.isInitialized()) {
          await configService.initialize();
        }

        // Update backup configuration in Config table
        await configService.set('backup.enabled', true);
        await configService.set('backup.schedule', input.schedule ?? 'DAILY');
        await configService.set('backup.retentionDays', input.retentionDays ?? 7);
        await configService.set('backup.maxCount', input.maxCount ?? 10);
        await configService.set('backup.includeDatabase', input.includeDatabase ?? true);
        await configService.set('backup.includeConfig', input.includeConfig ?? true);
        await configService.set('backup.includeMedia', input.includeMedia ?? false);

        if (input.customCron) {
          await configService.set('backup.customCron', input.customCron);
        }

        // Schedule a backup task
        const taskId = await backupService.scheduleBackup();

        // Emit backup scheduled event
        void realtimeEmitter.emitBackupOperation({
          operation: 'scheduled',
        });

        return {
          message: 'Backup schedule updated and backup task scheduled',
          taskId: String(taskId)
        };
      }
      catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to schedule backup', { error: errorMessage, input });

        throw toTRPCError(
          error instanceof Error ? error : new Error('Failed to schedule backup')
        );
      }
    })
});
