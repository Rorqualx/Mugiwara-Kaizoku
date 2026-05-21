/**
 * Prowlarr Search Types Type Guards
 * 
 * Type guards for Prowlarr search-related types to reduce complexity
 * and improve maintainability.
 * 
 * @module ProwlarrSearchTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  ProwlarrSearchResult
} from "@/types/prowlarr";

import {
  isValidObject,
  hasPropertyType,
  hasOptionalPropertyType
} from "./utils";

/**
 * Type guard for ProwlarrSearchResult
 * Validates that an object conforms to the ProwlarrSearchResult interface
 */
export function isProwlarrSearchResult(obj: unknown): obj is ProwlarrSearchResult {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    hasPropertyType(candidate, "guid", "string") &&
    hasPropertyType(candidate, "id", "number") &&
    hasPropertyType(candidate, "title", "string") &&
    hasPropertyType(candidate, "size", "number") &&
    hasPropertyType(candidate, "publishDate", "string") &&
    hasPropertyType(candidate, "protocol", "string") &&
    hasPropertyType(candidate, "indexerId", "number") &&
    hasPropertyType(candidate, "indexerName", "string") &&
    hasOptionalPropertyType(candidate, "downloadUrl", "string") &&
    hasOptionalPropertyType(candidate, "infoUrl", "string") &&
    hasOptionalPropertyType(candidate, "magnetUrl", "string") &&
    hasOptionalPropertyType(candidate, "seeders", "number") &&
    hasOptionalPropertyType(candidate, "leechers", "number") &&
    hasOptionalPropertyType(candidate, "score", "number") &&
    hasOptionalPropertyType(candidate, "status", "string") &&
    hasOptionalPropertyType(candidate, "description", "string") &&
    hasOptionalPropertyType(candidate, "coverUrl", "string") &&
    hasOptionalPropertyType(candidate, "isBlocked", "boolean") &&
    hasOptionalPropertyType(candidate, "blockReason", "string")
  );
}
