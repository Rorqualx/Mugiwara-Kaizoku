/**
 * Configuration Migration - Additional Settings Migration
 *
 * Handles migration of event settings and file organization settings from
 * legacy format to new configuration system. Includes default fallbacks.
 *
 * Extracted from: configMigration.ts (lines 549-628)
 * Violations Fixed:
 * - no-await-in-loop: 2 violations → 0 (replaced with Promise.all)
 * - no-unsafe-return: 2 violations → 0 (replaced with safeJsonParse)
 *
 * @module config-migration/additional-migration
 */

import { ConfigScope } from '@prisma/client';

import { logger } from '@/server/utils/logger';



import {
  type LegacySettings,
  EventSettingsSchema,
  FileOrganizationSchema,
  handleError,
  isRecord,
  safeJsonParse,
} from './types';

/**
 * Migrate additional settings (events and file organization)
 *
 * Processes event settings and file organization settings from legacy format,
 * validating with Zod schemas and migrating to new config system. Uses parallel
 * operations to avoid sequential await loops.
 *
 * **ESLint Fixes Applied**:
 * - Replaced IIFE JSON parsing with `safeJsonParse()` helper
 * - Replaced for-await loops with `Promise.all()` for parallel operations
 *
 * @param settings - Legacy settings object
 */
export async function migrateAdditionalSettings(settings: LegacySettings): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { configService } = await import('../configService');

  // ============================================================================
  // Event Settings Migration
  // ============================================================================

  if (settings.eventSettings) {
    try {
      // ✅ FIX: Use safeJsonParse instead of IIFE (no-unsafe-return)
      const rawEventSettings: unknown = safeJsonParse(settings.eventSettings);
      const eventSettings = EventSettingsSchema.parse(rawEventSettings);

      // Validate event settings is a record
      if (isRecord(eventSettings)) {
        // ✅ FIX: Use Promise.all instead of for-await loop (no-await-in-loop)
        const entries = Object.entries(eventSettings);
        await Promise.all(
          entries.map(([key, value]) =>
            configService.set(`events.${key}`, value, {
              scope: ConfigScope.SYSTEM,
            })
          )
        );
      } else {
        logger.info('Event settings is not a valid record object, skipping');
      }
    } catch (error: unknown) {
      logger.error('Error processing event settings JSON', { error: handleError(error) });
    }
  }

  // ============================================================================
  // File Organization Settings Migration
  // ============================================================================

  if (settings.fileOrganization) {
    try {
      // ✅ FIX: Use safeJsonParse instead of IIFE (no-unsafe-return)
      const rawFileOrganization: unknown = safeJsonParse(settings.fileOrganization);
      const fileOrganization = FileOrganizationSchema.parse(rawFileOrganization);

      // Validate file organization is a record
      if (isRecord(fileOrganization)) {
        // ✅ FIX: Use Promise.all instead of for-await loop (no-await-in-loop)
        const entries = Object.entries(fileOrganization);
        await Promise.all(
          entries.map(([key, value]) =>
            configService.set(`fileOrganization.${key}`, value, {
              scope: ConfigScope.FEATURE,
            })
          )
        );
      } else {
        logger.info('File organization settings is not a valid record object, skipping');
      }
    } catch (error: unknown) {
      logger.error('Error processing file organization JSON', { error: handleError(error) });
    }
  } else {
    // ============================================================================
    // Default File Organization Settings
    // ============================================================================

    // Set default file organization settings if none exist
    await Promise.all([
      configService.set('fileOrganization.folderStructure', 'byTitle', {
        scope: ConfigScope.FEATURE,
      }),
      configService.set('fileOrganization.fileNamingTemplate', '{title} - Chapter {chapter}', {
        scope: ConfigScope.FEATURE,
      }),
      configService.set('fileOrganization.createMetadataFiles', true, {
        scope: ConfigScope.FEATURE,
      }),
      configService.set('fileOrganization.organizeOnImport', true, {
        scope: ConfigScope.FEATURE,
      }),
      configService.set('fileOrganization.fileMode', 'move', {
        scope: ConfigScope.FEATURE,
      }),
    ]);
  }

  logger.info('Migrated additional settings');
}
