/**
 * Provider Types Type Guards
 *
 * This module contains type guards for validating provider type objects,
 * ensuring type safety for metadata providers and provider selection options.
 *
 * @module ProviderTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  MetadataProvider,
  SimpleMetadataProvider,
  ProviderSelectOption
} from "@/types/provider-types";

/**
 * Type guard for MetadataProvider
 * Validates that an object conforms to the MetadataProvider interface
 */
export function isMetadataProvider(obj: unknown): obj is MetadataProvider {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    "status" in candidate &&
    (!("isDefault" in candidate) || typeof candidate["isDefault"] === "boolean") &&
    (!("icon" in candidate) || typeof candidate["icon"] === "string") &&
    (!("description" in candidate) || typeof candidate["description"] === "string")
  );
}

/**
 * Type guard for SimpleMetadataProvider
 * Validates that an object conforms to the SimpleMetadataProvider interface
 */
export function isSimpleMetadataProvider(obj: unknown): obj is SimpleMetadataProvider {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["status"] === "string"
  );
}

/**
 * Type guard for ProviderSelectOption
 * Validates that an object conforms to the ProviderSelectOption interface
 */
export function isProviderSelectOption(obj: unknown): obj is ProviderSelectOption {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["value"] === "string" &&
    typeof candidate["label"] === "string" &&
    typeof candidate["group"] === "string" &&
    typeof candidate["disabled"] === "boolean"
  );
}