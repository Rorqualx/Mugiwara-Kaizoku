/**
 * Provider Metadata Types
 * 
 * This file defines types for the provider metadata structures
 * used in the settings and configuration system.
 */

/**
 * Provider settings type
 */
export interface ProviderSettings {
  [key: string]: unknown;
}

/**
 * Provider configuration type
 */
export interface ProviderConfig {
  enabled: boolean;
  settings: ProviderSettings;
}

/**
 * Legacy provider type structure before migration
 */
export interface LegacyProvider {
  enabled?: boolean;
  settings?: ProviderSettings;
  [key: string]: unknown;
}

/**
 * Metadata structure after migration
 */
export interface MetadataWithProviders {
  providers: {
    [providerId: string]: ProviderConfig;
  };
  defaultProvider?: string;
  [key: string]: unknown;
}

/**
 * Legacy metadata structure before migration
 */
export interface LegacyMetadata {
  providers?: {
    [providerId: string]: ProviderConfig;
  };
  defaultProvider?: string;
  comicvine?: LegacyProvider;
  anilist?: LegacyProvider;
  [key: string]: unknown;
}

/**
 * Union type for metadata - can be either legacy or migrated structure
 */
export type Metadata = LegacyMetadata | MetadataWithProviders;

/**
 * Provider migration configuration type
 */
export interface ProviderMigrationConfig {
  id: string;
  settingsKeys: string[];
}