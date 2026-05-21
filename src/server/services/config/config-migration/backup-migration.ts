/**
 * Backup Configuration Migration
 *
 * Migrates backup settings and scheduling configuration from legacy Settings table
 * to new Configuration system.
 *
 * Extracted from: configMigration.ts (lines 480-516)
 *
 * @module config-migration/backup-migration
 */

import { ConfigScope } from '@prisma/client';

import { logger } from '@/utils/logger';



import { configService } from '../configService';

import type { LegacySettings } from './types';

/**
 * Migrate backup settings from legacy format
 *
 * Processes backup configuration including:
 * - Enabled state and scheduling
 * - Custom cron expressions
 * - Retention and count limits
 * - Backup location path
 * - Content inclusion options (database, config, media)
 * - Compression settings
 *
 * All backup settings are scoped to SYSTEM level for global application configuration.
 *
 * @param settings - Legacy settings containing backup configuration
 * @throws May throw if configService operations fail
 */
export async function migrateBackupSettings(settings: LegacySettings): Promise<void> {
  // Backup enabled and scheduling
  await configService.set('backup.enabled', settings.backupEnabled, {
    scope: ConfigScope.SYSTEM
  });
  await configService.set('backup.schedule', settings.backupSchedule, {
    scope: ConfigScope.SYSTEM
  });

  // Custom cron expression (if provided)
  if (settings.backupCustomCron) {
    await configService.set('backup.cronExpression', settings.backupCustomCron, {
      scope: ConfigScope.SYSTEM
    });
  }

  // Retention policies
  await configService.set('backup.retentionDays', settings.backupRetentionDays, {
    scope: ConfigScope.SYSTEM
  });
  await configService.set('backup.maxCount', settings.backupMaxCount, {
    scope: ConfigScope.SYSTEM
  });

  // Backup storage location
  if (settings.backupPath) {
    await configService.set('backup.location', settings.backupPath, {
      scope: ConfigScope.SYSTEM
    });
  }

  // Content inclusion options
  await configService.set('backup.includeDatabase', settings.backupIncludeDatabase, {
    scope: ConfigScope.SYSTEM
  });
  await configService.set('backup.includeConfig', settings.backupIncludeConfig, {
    scope: ConfigScope.SYSTEM
  });
  await configService.set('backup.includeMedia', settings.backupIncludeMedia, {
    scope: ConfigScope.SYSTEM
  });

  // Compression is always enabled for new backups
  await configService.set('backup.compress', true, {
    scope: ConfigScope.SYSTEM
  });

  logger.info('Migrated backup settings');
}
