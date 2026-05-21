/**
 * Manga Source Settings Migration Module
 *
 * Handles migration of manga source integration settings (Mangal) from legacy
 * format to the new configuration system.
 *
 * Extracted from: configMigration.ts (lines 452-475)
 *
 * @module config-migration/source-migration
 */

import { ConfigScope } from '@prisma/client';

import { logger } from '@/utils/logger';



import type { LegacySettings } from './types';

/**
 * Migrate Mangal manga source integration settings
 *
 * Migrates the following settings:
 * - Integration enabled status
 * - Server host configuration
 * - Available libraries
 * - Authentication credentials (user/password)
 *
 * @param settings - Legacy settings object containing manga source configuration
 * @returns Promise that resolves when migration is complete
 */
export async function migrateMangaSourceSettings(settings: LegacySettings): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { configService } = await import('../configService');

  // Mangal integration settings
  await configService.set('integrations.mangal.enabled', settings.mangalEnabled, {
    scope: ConfigScope.INTEGRATION
  });

  if (settings.mangalHost) {
    await configService.set('integrations.mangal.host', settings.mangalHost, {
      scope: ConfigScope.INTEGRATION
    });
  }

  await configService.set('integrations.mangal.libraries', settings.mangalLibraries, {
    scope: ConfigScope.INTEGRATION
  });

  if (settings.mangalPassword) {
    await configService.set('integrations.mangal.password', settings.mangalPassword, {
      scope: ConfigScope.INTEGRATION
    });
  }

  if (settings.mangalUser) {
    await configService.set('integrations.mangal.user', settings.mangalUser, {
      scope: ConfigScope.INTEGRATION
    });
  }

  logger.info('Migrated manga source settings');
}
