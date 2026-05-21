/**
 * Provider Metadata Type Guards
 *
 * This module contains type guards for validating provider metadata type objects,
 * ensuring type safety for provider settings, legacy provider support, and migration configurations.
 *
 * @module ProviderMetadataTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  ProviderSettings,
  LegacyProvider,
  MetadataWithProviders,
  LegacyMetadata,
  ProviderMigrationConfig
} from "@/types/provider-metadata";

/**
 * Type guard for ProviderSettings
 * Validates that an object conforms to the ProviderSettings interface
 */
export function isProviderSettings(obj: unknown): obj is ProviderSettings {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for LegacyProvider
 * Validates that an object conforms to the LegacyProvider interface
 */
export function isLegacyProvider(obj: unknown): obj is LegacyProvider {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("enabled" in candidate) || typeof candidate["enabled"] === "boolean") &&
    (!("settings" in candidate) || "settings" in candidate)
  );
}

/**
 * Type guard for MetadataWithProviders
 * Validates that an object conforms to the MetadataWithProviders interface
 */
export function isMetadataWithProviders(obj: unknown): obj is MetadataWithProviders {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "providers" in candidate &&
    (!("defaultProvider" in candidate) || typeof candidate["defaultProvider"] === "string")
  );
}

/**
 * Type guard for LegacyMetadata
 * Validates that an object conforms to the LegacyMetadata interface
 */
export function isLegacyMetadata(obj: unknown): obj is LegacyMetadata {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("providers" in candidate) || "providers" in candidate) &&
    (!("defaultProvider" in candidate) || typeof candidate["defaultProvider"] === "string") &&
    (!("comicvine" in candidate) || "comicvine" in candidate) &&
    (!("anilist" in candidate) || "anilist" in candidate)
  );
}

/**
 * Type guard for ProviderMigrationConfig
 * Validates that an object conforms to the ProviderMigrationConfig interface
 */
export function isProviderMigrationConfig(obj: unknown): obj is ProviderMigrationConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    Array.isArray(candidate["settingsKeys"]) && candidate["settingsKeys"].every((x: unknown) => typeof x === "string")
  );
}