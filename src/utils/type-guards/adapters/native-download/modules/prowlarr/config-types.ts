/**
 * Prowlarr Config Types Type Guards
 * 
 * Type guards for Prowlarr configuration-related types to reduce complexity
 * and improve maintainability.
 * 
 * @module ProwlarrConfigTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  ProwlarrSettings,
  ProwlarrClientConfig,
  SearchOptions
} from "@/types/prowlarr";

import {
  isValidObject,
  hasPropertyType,
  hasOptionalPropertyType,
  isArrayOfType
} from "./utils";

/**
 * Type guard for ProwlarrSettings
 * Validates that an object conforms to the ProwlarrSettings interface
 */
export function isProwlarrSettings(obj: unknown): obj is ProwlarrSettings {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    hasPropertyType(candidate, "prowlarrEnabled", "boolean") &&
    hasPropertyType(candidate, "prowlarrHost", "string") &&
    hasPropertyType(candidate, "prowlarrApiKey", "string") &&
    hasPropertyType(candidate, "prowlarrPriority", "number") &&
    Array.isArray(candidate["prowlarrCategories"]) &&
    isArrayOfType(candidate["prowlarrCategories"], "string")
  );
}

/**
 * Type guard for ProwlarrClientConfig
 * Validates that an object conforms to the ProwlarrClientConfig interface
 */
export function isProwlarrClientConfig(obj: unknown): obj is ProwlarrClientConfig {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    hasPropertyType(candidate, "baseURL", "string") &&
    hasPropertyType(candidate, "apiKey", "string") &&
    hasOptionalPropertyType(candidate, "timeout", "number") &&
    hasOptionalPropertyType(candidate, "maxRetries", "number") &&
    hasOptionalPropertyType(candidate, "notifyOnError", "boolean")
  );
}

/**
 * Type guard for SearchOptions
 * Validates that an object conforms to the SearchOptions interface
 */
export function isSearchOptions(obj: unknown): obj is SearchOptions {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    hasOptionalPropertyType(candidate, "categories", "array") &&
    hasOptionalPropertyType(candidate, "limit", "number") &&
    hasOptionalPropertyType(candidate, "offset", "number")
  );
}
