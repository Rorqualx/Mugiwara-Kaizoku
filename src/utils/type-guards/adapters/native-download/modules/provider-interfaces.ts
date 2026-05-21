/**
 * Provider Interfaces Type Guards
 *
 * This module contains type guards for validating provider interface type objects,
 * ensuring type safety for provider abstraction layer and adapter patterns.
 *
 * @module ProviderInterfacesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  BaseProvider,
  ProviderConfig,
  IMetadataProviderAdapter,
  DownloadProvider,
  SourceProvider,
  MetadataAdapter,
  ProviderRegistry
} from "@/types/provider-interfaces";

/**
 * Type guard for BaseProvider
 * Validates that an object conforms to the BaseProvider interface
 */
export function isBaseProvider(obj: unknown): obj is BaseProvider {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string"
  );
}

/**
 * Type guard for ProviderConfig
 * Validates that an object conforms to the ProviderConfig interface
 */
export function isProviderConfig(obj: unknown): obj is ProviderConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["enabled"] === "boolean" &&
    (!("apiKey" in candidate) || typeof candidate["apiKey"] === "string") &&
    (!("apiUrl" in candidate) || typeof candidate["apiUrl"] === "string") &&
    (!("rateLimit" in candidate) || "rateLimit" in candidate) &&
    (!("logger" in candidate) || "logger" in candidate)
  );
}

/**
 * Type guard for IMetadataProviderAdapter
 * Validates that an object conforms to the IMetadataProviderAdapter interface
 */
export function isIMetadataProviderAdapter(obj: unknown): obj is IMetadataProviderAdapter {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for DownloadProvider
 * Validates that an object conforms to the DownloadProvider interface
 */
export function isDownloadProvider(obj: unknown): obj is DownloadProvider {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for SourceProvider
 * Validates that an object conforms to the SourceProvider interface
 */
export function isSourceProvider(obj: unknown): obj is SourceProvider {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for MetadataAdapter
 * Validates that an object conforms to the MetadataAdapter interface
 */
export function isMetadataAdapter(obj: unknown): obj is MetadataAdapter {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["providerId"] === "string"
  );
}

/**
 * Type guard for ProviderRegistry
 * Validates that an object conforms to the ProviderRegistry interface
 */
export function isProviderRegistry(obj: unknown): obj is ProviderRegistry {
  return typeof obj === "object" && obj !== null;
}