/**
 * Suwayomi Settings Migration
 *
 * Handles migration of Suwayomi manga reader integration settings from legacy
 * configuration format to the new centralized configuration system.
 *
 * Extracted from: configMigration.ts (lines 521-544)
 *
 * @module config-migration/suwayomi-migration
 */

import { ConfigScope } from '@prisma/client';

import { logger } from '@/utils/logger';



import type { LegacySettings } from './types';

/**
 * Migrate Suwayomi settings from legacy format to new configuration system
 *
 * Handles migration of:
 * - Suwayomi enabled status
 * - Server path configuration
 * - Configuration directory path
 * - Server port number
 * - Active sources list
 *
 * @param settings - Legacy settings object containing Suwayomi configuration
 * @returns Promise that resolves when migration is complete
 *
 * @throws {Error} If configuration service encounters an error during migration
 */
export async function migrateSuwayomiSettings(settings: LegacySettings): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { configService } = await import('../configService');

  // Migrate suwayomi.enabled
  await configService.set('integrations.suwayomi.enabled', settings.suwayomiEnabled, {
    scope: ConfigScope.INTEGRATION
  });

  // Migrate suwayomi.serverPath (optional)
  if (settings.suwayomiServerPath) {
    await configService.set('integrations.suwayomi.serverPath', settings.suwayomiServerPath, {
      scope: ConfigScope.INTEGRATION
    });
  }

  // Migrate suwayomi.configPath (optional)
  if (settings.suwayomiConfigPath) {
    await configService.set('integrations.suwayomi.configPath', settings.suwayomiConfigPath, {
      scope: ConfigScope.INTEGRATION
    });
  }

  // Migrate suwayomi.port (optional)
  if (settings.suwayomiPort) {
    await configService.set('integrations.suwayomi.port', settings.suwayomiPort, {
      scope: ConfigScope.INTEGRATION
    });
  }

  // Migrate suwayomi.sources
  await configService.set('integrations.suwayomi.sources', settings.suwayomiSources, {
    scope: ConfigScope.INTEGRATION
  });

  logger.info('Migrated Suwayomi settings');
}
