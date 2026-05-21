/**
 * Prowlarr Indexer Types Type Guards
 * 
 * Type guards for Prowlarr indexer-related types to reduce complexity
 * and improve maintainability.
 * 
 * @module ProwlarrIndexerTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  IndexerField,
  IndexerCapability,
  ProwlarrIndexer
} from "@/types/prowlarr";

import {
  isValidObject,
  hasPropertyType,
  hasOptionalPropertyType,
  isArrayOfType
} from "./utils";

/**
 * Type guard for IndexerField
 * Validates that an object conforms to the IndexerField interface
 */
export function isIndexerField(obj: unknown): obj is IndexerField {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    hasPropertyType(candidate, "name", "string") &&
    hasPropertyType(candidate, "label", "string") &&
    "value" in candidate &&
    hasPropertyType(candidate, "type", "string") &&
    hasPropertyType(candidate, "advanced", "boolean") &&
    hasOptionalPropertyType(candidate, "helpText", "string") &&
    hasOptionalPropertyType(candidate, "required", "boolean")
  );
}

/**
 * Type guard for IndexerCapability
 * Validates that an object conforms to the IndexerCapability interface
 */
export function isIndexerCapability(obj: unknown): obj is IndexerCapability {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    Array.isArray(candidate["supportedCategories"]) &&
    hasOptionalPropertyType(candidate, "searchAvailable", "boolean") &&
    hasOptionalPropertyType(candidate, "name", "string")
  );
}

/**
 * Type guard for ProwlarrIndexer
 * Validates that an object conforms to the ProwlarrIndexer interface
 */
export function isProwlarrIndexer(obj: unknown): obj is ProwlarrIndexer {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    hasPropertyType(candidate, "id", "number") &&
    hasPropertyType(candidate, "name", "string") &&
    hasPropertyType(candidate, "enabled", "boolean") &&
    hasPropertyType(candidate, "priority", "number") &&
    hasPropertyType(candidate, "implementation", "string") &&
    hasPropertyType(candidate, "implementationName", "string") &&
    hasPropertyType(candidate, "protocol", "string") &&
    Array.isArray(candidate["fields"]) &&
    Array.isArray(candidate["tags"]) &&
    isArrayOfType(candidate["tags"], "string") &&
    "capabilities" in candidate &&
    hasPropertyType(candidate, "configContract", "string") &&
    hasOptionalPropertyType(candidate, "supportsRss", "boolean") &&
    hasOptionalPropertyType(candidate, "supportsSearch", "boolean")
  );
}
