import * as path from 'path';

import { BackupContent } from '@prisma/client';
import { BackupType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { backupService } from '@/server/services/backup/index';
import { validateBackupPath } from '@/server/services/backup/utils';
import { configService } from '@/server/services/config/configService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { ValidationError } from '@/utils/errors';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { adminProcedure } from '../procedures';
import { successWithBackupIdSchema } from '../schemas';
import { router } from '../trpc';

/**
 * Backup Router
 *
 * This router provides endpoints for backup and restore operations,
 * integrating with the backup service and configuration system.
 */

/**
 * Router for backup operations
 */
export const backupRouter = router({
    /**
     * Get a list of all backups
     */
    list: adminProcedure.query(async () => {
        return backupService.listBackups();
    }),
    /**
     * Get details of a specific backup
     */
    get: adminProcedure.input(z.object({
        id: z.number().int().positive()
    })).query(async ({ input }) => {
        return backupService.getBackup(input["id"]);
    }),
    /**
     * Create a manual backup
     */
    createBackup: adminProcedure.input(z.object({
        includeDatabase: z.boolean().default(true),
        includeConfig: z.boolean().default(true),
        includeMedia: z.boolean().default(false),
        name: z.string().max(255).optional()
    })).output(successWithBackupIdSchema)
            .mutation(async ({ input }) => {
        try {
            // Determine what to include in the backup
            const contents: BackupContent[] = [];
            if (input.includeDatabase) {
                contents.push(BackupContent.DATABASE);
            }
            if (input.includeConfig) {
                contents.push(BackupContent.CONFIGURATION);
            }
            if (input.includeMedia) {
                contents.push(BackupContent.MEDIA_FILES);
            }
            // Skip if nothing to backup
            if (contents.length === 0) {
                throw new ValidationError('No content types selected for backup');
            }
            // Create the backup
            const backupId = await backupService.createBackup({
                type: BackupType.MANUAL,
                contents,
                name: input["name"] || `manual_backup_${new Date().toISOString().split('T')[0]}`,
                notes: 'Manual backup triggered by user'
            });
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'backup:created',
                source: 'backup-router',
                message: 'Backup created successfully',
                data: { backupId: String(backupId), contents },
            });
            return {
                success: true,
                backupId: String(backupId),
                message: 'Backup created successfully'
            };
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
     * Delete a backup
     */
    deleteBackup: adminProcedure.input(z.object({
        id: z.number().int().positive()
    })).mutation(async ({ input }) => {
        try {
            await backupService.deleteBackup(input["id"]);
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'backup:deleted',
                source: 'backup-router',
                message: 'Backup deleted successfully',
                data: { backupId: input.id },
            });
            return {
                success: true,
                message: 'Backup deleted successfully'
            };
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
     * Restore from a backup
     */
    restoreBackup: adminProcedure.input(z.object({
        backupPath: z.string().or(z.number().transform(id => toStringId(id)))
    })).mutation(async ({ input }) => {
        try {
            // Check if input is a backup ID or a file path
            const isNumeric = !isNaN(Number(input.backupPath));
            if (isNumeric) {
                const backupId = Number(input.backupPath);
                await backupService.restoreBackup(backupId);
            }
            else {
                // Handle file path restore with comprehensive security validation
                const uploadDir = path.join(process.cwd(), 'backups', 'uploads');

                // Validate the path to prevent directory traversal attacks
                const fullPath = await validateBackupPath(String(input.backupPath), uploadDir);

                // Call backup service with the validated full path
                await backupService.restoreFromFile(fullPath);
            }
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'backup:restored',
                source: 'backup-router',
                message: 'Backup restored successfully',
                data: { backupPath: input.backupPath },
            });
            return {
                success: true,
                message: 'Backup restored successfully'
            };
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to restore backup', { error: errorMessage, input });

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
     * Update backup settings
     */
    updateSettings: adminProcedure.input(z.object({
        enabled: z.boolean().optional(),
        frequency: z.enum(['daily', 'weekly', 'monthly', 'never']).optional(),
        location: z.string().max(500).regex(/^\/[\w\-./]+$/, 'Must be absolute path').optional(),
        maxCount: z.number().int().min(1).max(100).optional(),
        retentionDays: z.number().int().min(1).max(365).optional(),
        includeDatabase: z.boolean().optional(),
        includeConfig: z.boolean().optional(),
        includeMedia: z.boolean().optional(),
        customCron: z.string().max(100).regex(/^(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)\s+(\*|[0-9,\-/*]+)$/, 'Invalid cron expression').optional().nullable()
    })).mutation(async ({ input }) => {
        try {
            // Update backup settings in the configuration system
            // Only update fields that were provided
            const updates = [];
            if (input.enabled !== undefined) {
                updates.push(configService.set('backup.enabled', input.enabled));
            }
            if (input.frequency !== undefined) {
                updates.push(configService.set('backup.frequency', input.frequency));
            }
            if (input.location !== undefined) {
                updates.push(configService.set('backup.location', input.location));
            }
            if (input.maxCount !== undefined) {
                updates.push(configService.set('backup.maxCount', input.maxCount));
            }
            if (input.retentionDays !== undefined) {
                updates.push(configService.set('backup.retentionDays', input.retentionDays));
            }
            if (input.includeDatabase !== undefined) {
                updates.push(configService.set('backup.content.database', input.includeDatabase));
            }
            if (input.includeConfig !== undefined) {
                updates.push(configService.set('backup.content.config', input.includeConfig));
            }
            if (input.includeMedia !== undefined) {
                updates.push(configService.set('backup.content.media', input.includeMedia));
            }
            if (input.customCron !== undefined) {
                if (input.customCron === null) {
                    // Remove custom cron if set to null
                    await configService.remove('backup.customCron');
                }
                else {
                    updates.push(configService.set('backup.customCron', input.customCron));
                }
            }
            // Wait for all updates to complete
            await Promise.all(updates);
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'backup:settingsUpdated',
                source: 'backup-router',
                message: 'Backup settings updated successfully',
                data: { enabled: input.enabled, frequency: input.frequency },
            });
            return {
                success: true,
                message: 'Backup settings updated successfully'
            };
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to update backup settings', { error: errorMessage, input });

            if (error instanceof ValidationError) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: errorMessage,
                });
            }

            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to update backup settings. Please try again.',
                cause: error,
            });
        }
    }),
    /**
     * Get current backup settings
     */
    getSettings: adminProcedure.query(async () => {
        try {
            // Get backup settings from the configuration system
            const enabled = await configService.get<boolean>('backup.enabled', true);
            const frequency = await configService.get<string>('backup.frequency', 'weekly');
            const location = await configService.get<string>('backup.location', '/config/backups');
            const maxCount = await configService.get<number>('backup.maxCount', 5);
            const retentionDays = await configService.get<number>('backup.retentionDays', 7);
            const includeDatabase = await configService.get<boolean>('backup.content.database', true);
            const includeConfig = await configService.get<boolean>('backup.content.config', true);
            const includeMedia = await configService.get<boolean>('backup.content.media', false);
            const customCron = await configService.get<string | null>('backup.customCron', null);
            return {
                enabled,
                frequency,
                location,
                maxCount,
                retentionDays,
                includeDatabase,
                includeConfig,
                includeMedia,
                customCron
            };
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to get backup settings', { error: errorMessage });

            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to retrieve backup settings. Please try again.',
                cause: error,
            });
        }
    })
});
