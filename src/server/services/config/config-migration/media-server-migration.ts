/**
 * Media Server Settings Migration
 *
 * Migrates Kavita and Komga media server integration configuration
 * from legacy Settings table to new Configuration system.
 *
 * Extracted from: configMigration.ts (lines 194-239)
 *
 * @module config-migration/media-server-migration
 */

import { ConfigScope } from '@prisma/client';

import { logger } from '@/utils/logger';



import { configService } from '../configService';

import type { LegacySettings } from './types';

/**
 * Migrate media server settings from legacy format
 *
 * Processes Kavita and Komga media server configurations,
 * migrating them to the new configuration system with proper scoping.
 *
 * @param settings - Legacy settings containing media server integration configs
 * @throws May throw if configService operations fail
 */
export async function migrateMediaServerSettings(settings: LegacySettings): Promise<void> {
  // Kavita
  await configService.set('integrations.kavita.enabled', settings.kavitaEnabled, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.kavitaHost) {
    await configService.set('integrations.kavita.host', settings.kavitaHost, {
      scope: ConfigScope.INTEGRATION
    });
  }
  await configService.set('integrations.kavita.libraries', settings.kavitaLibraries, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.kavitaPassword) {
    await configService.set('integrations.kavita.password', settings.kavitaPassword, {
      scope: ConfigScope.INTEGRATION
    });
  }
  if (settings.kavitaUser) {
    await configService.set('integrations.kavita.user', settings.kavitaUser, {
      scope: ConfigScope.INTEGRATION
    });
  }
  // Komga
  await configService.set('integrations.komga.enabled', settings.komgaEnabled, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.komgaHost) {
    await configService.set('integrations.komga.host', settings.komgaHost, {
      scope: ConfigScope.INTEGRATION
    });
  }
  await configService.set('integrations.komga.libraries', settings.komgaLibraries, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.komgaPassword) {
    await configService.set('integrations.komga.password', settings.komgaPassword, {
      scope: ConfigScope.INTEGRATION
    });
  }
  if (settings.komgaUser) {
    await configService.set('integrations.komga.user', settings.komgaUser, {
      scope: ConfigScope.INTEGRATION
    });
  }
  logger.info('Migrated media server settings');
}
