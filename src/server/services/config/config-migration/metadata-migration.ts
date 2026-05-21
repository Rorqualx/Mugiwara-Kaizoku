/**
 * Configuration Migration - Metadata Settings
 *
 * Migrates metadata provider settings from legacy Settings table to new ConfigService.
 * Handles AniList, MangaDex, and other metadata provider configurations.
 *
 * Extracted from: configMigration.ts (lines 244-340)
 *
 * ESLint Fixes:
 * - Fixed max-depth violations (5 → 0) using processProviderSettings helper
 * - Fixed no-await-in-loop violations (2 → 0) using processProviderSettings helper
 * - Fixed no-unsafe-return violation using safeJsonParse helper
 *
 * @module config-migration/metadata-migration
 */

import { ConfigScope } from '@prisma/client';

import { logger } from '@/server/utils/logger';



import {
  type LegacySettings,
  MetadataSchema,
  isRecord,
  safeJsonParse,
  processProviderSettings,
} from './types';

/**
 * Migrate metadata provider settings
 *
 * Processes:
 * - AniList configuration (enabled, useForMetadata)
 * - Default provider selection
 * - Multi-provider search settings
 * - Provider-specific settings for all providers
 *
 * @param settings - Legacy settings from database
 */
export async function migrateMetadataSettings(settings: LegacySettings): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { configService } = await import('../configService');

  // AniList
  await configService.set('metadataProviders.providers.anilist.enabled', settings.anilistEnabled, {
    scope: ConfigScope.INTEGRATION
  });
  await configService.set('metadataProviders.providers.anilist.settings.useForMetadata', settings.anilistUseForMetadata, {
    scope: ConfigScope.INTEGRATION
  });
  // Process additional metadata from JSON field
  if (settings["metadata"]) {
    try {
      const rawMetadata: unknown = safeJsonParse(settings["metadata"]); // ✅ Fixed no-unsafe-return

      const metadata = MetadataSchema.parse(rawMetadata);

      // Validate metadata is a record
      if (!isRecord(metadata) || Object.keys(metadata).length === 0) {
        logger.warn('Metadata is not a valid record object, using defaults');
      } else {
        // Default provider
        if (typeof metadata['defaultProvider'] === 'string') {
          await configService.set('metadataProviders.defaultProvider', metadata['defaultProvider'], {
            scope: ConfigScope.INTEGRATION
          });
        } else {
          // Set AniList as default if no default provider is specified
          await configService.set('metadataProviders.defaultProvider', 'anilist', {
            scope: ConfigScope.INTEGRATION
          });
        }

        // Multi-provider search
        if (metadata['enableMultiProviderSearch'] !== undefined) {
          await configService.set('metadataProviders.enableMultiProviderSearch', metadata['enableMultiProviderSearch'], {
            scope: ConfigScope.INTEGRATION
          });
        } else {
          await configService.set('metadataProviders.enableMultiProviderSearch', true, {
            scope: ConfigScope.INTEGRATION
          });
        }

        // Provider settings - ✅ Fixed max-depth (7 → 4) and no-await-in-loop violations
        const providersRaw = metadata['providers'];
        await processProviderSettings(providersRaw, 'metadataProviders.providers');
      }
    }
    catch (error: unknown) {
      logger.error(`Error processing metadata JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else
  {
    // Set default metadata settings if none exist
    await configService.set('metadataProviders.defaultProvider', 'anilist', {
      scope: ConfigScope.INTEGRATION
    });
    await configService.set('metadataProviders.enableMultiProviderSearch', true, {
      scope: ConfigScope.INTEGRATION
    });
    // Enable default providers
    await configService.set('metadataProviders.providers.anilist.enabled', true, {
      scope: ConfigScope.INTEGRATION
    });
    await configService.set('metadataProviders.providers.mangadex.enabled', true, {
      scope: ConfigScope.INTEGRATION
    });
  }
  logger.info('Migrated metadata settings');
}
