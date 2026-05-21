/**
 * Configuration Management Operations
 *
 * Functions for managing configuration lifecycle:
 * - Reset to defaults
 * - Export/import to/from files
 * - Cache management
 * - Legacy settings migration
 *
 * Extracted from: configService.ts (lines 485-609, 826-871)
 */

import * as fs from 'fs/promises';


import { ConfigScope, ConfigSource } from '@prisma/client';

import { prisma } from '@/server/db';
import type { ConfigWithMetadata as DomainConfigWithMetadata } from '@/types/search.types';
import { logger } from '@/utils/logger';


import { deleteFromDatabase, saveToFile, exportToFile as persistExportToFile } from '../config-persistence';
import { LegacyMetadataSettings, extractLegacyMetadataSettings } from '../helpers/domain-converters';
import { detectValueType } from '../helpers/value-converters';

import type { ConfigMetadata, ConfigServiceMetadata, PrismaWithSettings } from '../config-types';


/**
 * Context interface for management operations
 */
export interface ManagementContext {
  cache: Map<string, ConfigServiceMetadata<unknown>>;
  defaultConfig: Record<string, ConfigServiceMetadata<unknown>>;
  initialized: boolean;
  initialize: () => Promise<void>;
  loadDefaults: () => void;
  configFilePath: string;
  set: <T = unknown>(key: string, value: T, options?: { scope?: ConfigScope; source?: ConfigSource; metadata?: Partial<ConfigMetadata> }) => Promise<void>;
  convertToDomainConfig: <T = unknown>(key: string, config: ConfigServiceMetadata<T>) => DomainConfigWithMetadata<T>;
}

/**
 * Reset configurations to defaults
 *
 * Clears cache entries and deletes from database, then reloads defaults.
 * Can be scoped to a specific ConfigScope or reset all configurations.
 */
export async function resetToDefaults(
  ctx: ManagementContext,
  scope?: ConfigScope
): Promise<void> {
  if (!ctx.initialized) await ctx.initialize();

  const keysToReset: string[] = [];

  if (scope) {
    for (const [key, config] of Array.from(ctx.cache.entries())) {
      if (config.metadata.scope === scope) {
        keysToReset.push(key);
      }
    }
  } else {
    keysToReset.push(...Array.from(ctx.cache.keys()));
  }

  // Delete from cache synchronously
  for (const key of keysToReset) {
    ctx.cache.delete(key);
  }

  // Delete from database in parallel
  const deleteResults = await Promise.allSettled(keysToReset.map((key) => deleteFromDatabase(key)));
  for (const result of deleteResults) {
    if (result.status === 'rejected') {
      const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
      logger.error(`Failed to delete configuration from database: ${errorMessage}`);
    }
  }

  ctx.loadDefaults();

  if (!scope || scope === ConfigScope.GLOBAL) {
    await saveToFile(ctx.configFilePath, ctx.cache);
  }

  logger.info(`Reset ${keysToReset.length} configuration values to defaults`);
}

/**
 * Export configurations to file
 *
 * Exports configuration entries to a file, optionally filtered by scope.
 */
export async function exportToFile(
  ctx: ManagementContext,
  filePath: string,
  includeScopes?: ConfigScope[]
): Promise<void> {
  if (!ctx.initialized) await ctx.initialize();
  await persistExportToFile(filePath, ctx.cache, includeScopes, ctx.convertToDomainConfig.bind(ctx));
}

/**
 * Clear configuration cache
 *
 * Clears a specific key from cache or the entire cache if no key specified.
 */
export function clearCache(
  ctx: ManagementContext,
  key?: string
): void {
  if (key) {
    ctx.cache.delete(key);
    logger.info(`Cleared cache for key: ${key}`);
  } else {
    ctx.cache.clear();
    logger.info('Cleared entire configuration cache');
  }
}

/**
 * Import configurations from file
 *
 * Imports configuration entries from a JSON file with options for
 * override behavior and scope filtering.
 */
export async function importFromFile(
  ctx: ManagementContext,
  filePath: string,
  options?: {
    overrideExisting?: boolean;
    importScopes?: ConfigScope[];
  }
): Promise<void> {
  if (!ctx.initialized) await ctx.initialize();

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const importConfig = JSON.parse(fileContent) as Record<string, unknown>;

    // Build array of configs to import
    const configsToImport: Array<{
      key: string;
      value: unknown;
      scope: ConfigScope;
      metadata: Partial<ConfigMetadata>;
    }> = [];

    for (const [key, configData] of Object.entries(importConfig)) {
      const config = configData as DomainConfigWithMetadata<unknown>;

      if (options?.importScopes && config.scope && !options.importScopes.includes(config.scope as ConfigScope)) {
        continue;
      }

      if (!options?.overrideExisting && ctx.cache.has(key)) {
        continue;
      }

      const configScope = (config.scope ?? ConfigScope.SYSTEM) as ConfigScope;
      const extractedMetadata: Partial<ConfigMetadata> = {
        key,
        label: key,
        type: detectValueType(config.value),
        scope: configScope,
        category: config.category ?? 'Imported',
        ...(config.description && { description: config.description })
      };

      if (config.metadata && typeof config.metadata === 'object') {
        Object.assign(extractedMetadata, config.metadata);
      }

      configsToImport.push({
        key,
        value: config.value,
        scope: configScope,
        metadata: extractedMetadata
      });
    }

    // Import all configs in parallel
    await Promise.all(
      configsToImport.map(({ key, value, scope, metadata }) =>
        ctx.set(key, value, {
          scope,
          source: ConfigSource.DATABASE,
          metadata
        })
      )
    );

    logger.info(`Imported configuration from file: ${filePath}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to import configuration from file: ${errorMessage}`);
    throw new Error(`Failed to import configuration: ${error}`);
  }
}

/**
 * Migrate from legacy settings table
 *
 * Migrates configuration from the legacy Settings model to the new
 * Config model structure.
 */
export async function migrateFromLegacySettings(ctx: ManagementContext): Promise<void> {
  try {
    if (!('settings' in prisma)) {
      logger.debug('Settings model not found, skipping legacy migration');
      return;
    }

    const settings = await (prisma as unknown as PrismaWithSettings).settings.findFirst();

    if (!settings) {
      logger.info('No legacy settings found to migrate');
      return;
    }

    if (settings.suwayomiEnabled) {
      await ctx.set('suwayomi.enabled', settings.suwayomiEnabled);
    }
    if (settings.suwayomiServerPath) {
      await ctx.set('suwayomi.serverPath', settings.suwayomiServerPath);
    }
    if (settings.suwayomiConfigPath) {
      await ctx.set('suwayomi.configPath', settings.suwayomiConfigPath);
    }
    if (settings.suwayomiPort) {
      await ctx.set('suwayomi.port', settings.suwayomiPort);
    }
    if (settings.suwayomiSources) {
      await ctx.set('suwayomi.sources', settings.suwayomiSources);
    }

    if (settings.metadata) {
      const rawMetadata: unknown =
        typeof settings.metadata === 'string' ? JSON.parse(settings.metadata as string) : settings.metadata;
      const metadata = rawMetadata as LegacyMetadataSettings;
      const settingsToMigrate = extractLegacyMetadataSettings(metadata);

      // Migrate all settings in parallel
      await Promise.all(settingsToMigrate.map(({ key, value }) => ctx.set(key, value)));
    }

    logger.info('Successfully migrated legacy settings to new configuration system');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to migrate legacy settings: ${errorMessage}`);
    throw new Error(`Failed to migrate legacy settings: ${error}`);
  }
}
