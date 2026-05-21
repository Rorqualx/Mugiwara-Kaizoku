/**
 * Domain Converter Utilities
 *
 * Functions for converting between internal and domain configuration types:
 * - Convert ConfigServiceMetadata to DomainConfigWithMetadata
 * - Extract legacy metadata settings for migration
 *
 * Extracted from: configService.ts (lines 57-64, 205-252)
 */

import type { ConfigWithMetadata as DomainConfigWithMetadata } from '@/types/search.types';

import type { ConfigServiceMetadata } from '../config-types';

/**
 * Interface for legacy metadata settings structure
 * Used during migration from old settings system
 */
export interface LegacyMetadataSettings {
  defaultProvider?: string;
  enableMultiProviderSearch?: boolean;
  providers?: Record<string, {
    enabled: boolean;
    settings: Record<string, unknown>;
  }>;
}

/**
 * Convert internal ConfigServiceMetadata to domain ConfigWithMetadata
 *
 * @param key - Configuration key identifier
 * @param config - Internal configuration metadata
 * @returns Domain-level configuration with metadata
 */
export function convertToDomainConfig<T = unknown>(
  key: string,
  config: ConfigServiceMetadata<T>
): DomainConfigWithMetadata<T> {
  return {
    key,
    value: config.value,
    scope: config.metadata.scope,
    category: config.metadata.category,
    ...(config.metadata.description && { description: config.metadata.description }),
    createdAt: new Date(),
    updatedAt: config.updatedAt,
    metadata: config.metadata as unknown as Record<string, unknown>
  };
}

/**
 * Extract flattened key-value pairs from legacy metadata settings
 * Used for migration from nested to flat configuration
 *
 * @param metadata - Legacy nested metadata settings structure
 * @returns Array of flattened key-value pairs for migration
 */
export function extractLegacyMetadataSettings(
  metadata: LegacyMetadataSettings
): Array<{ key: string; value: unknown }> {
  const settingsToMigrate: Array<{ key: string; value: unknown }> = [];

  if (metadata.defaultProvider) {
    settingsToMigrate.push({
      key: 'metadataProviders.defaultProvider',
      value: metadata.defaultProvider
    });
  }
  if (metadata.enableMultiProviderSearch !== undefined) {
    settingsToMigrate.push({
      key: 'metadataProviders.enableMultiProviderSearch',
      value: metadata.enableMultiProviderSearch
    });
  }
  if (metadata.providers) {
    for (const [provider, config] of Object.entries(metadata.providers)) {
      settingsToMigrate.push({
        key: `metadataProviders.providers.${provider}.enabled`,
        value: config.enabled
      });
      for (const [settingsKey, value] of Object.entries(config.settings)) {
        settingsToMigrate.push({
          key: `metadataProviders.providers.${provider}.settings.${settingsKey}`,
          value
        });
      }
    }
  }

  return settingsToMigrate;
}
