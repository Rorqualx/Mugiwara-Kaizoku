/**
 * Unified Search Types Type Guards
 *
 * This module contains type guards for validating unified search type objects,
 * ensuring type safety for search functionality across multiple providers.
 *
 * @module UnifiedSearchTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  SearchOptions,
  SearchResponse,
  SearchState,
  SearchFilters,
  ProviderSearchConfig,
  UISearchResult,
  AggregatedSearchResponse,
  SearchContext
} from "@/types/frontend/unified-search-types";

/**
 * Type guard for SearchOptions
 * Validates that an object conforms to the SearchOptions interface
 */
export function isSearchOptions(obj: unknown): obj is SearchOptions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["query"] === "string" &&
    (!("providers" in candidate) || Array.isArray(candidate["providers"]) && candidate["providers"].every((x: unknown) => typeof x === "string")) &&
    (!("limit" in candidate) || typeof candidate["limit"] === "number") &&
    (!("offset" in candidate) || typeof candidate["offset"] === "number")
  );
}

/**
 * Type guard for SearchResponse
 * Validates that an object conforms to the SearchResponse interface
 */
export function isSearchResponse(obj: unknown): obj is SearchResponse {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    Array.isArray(candidate["results"]) &&
    typeof candidate["total"] === "number" &&
    typeof candidate["hasMore"] === "boolean"
  );
}

/**
 * Type guard for SearchState
 * Validates that an object conforms to the SearchState interface
 */
export function isSearchState(obj: unknown): obj is SearchState {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["query"] === "string" &&
    Array.isArray(candidate["results"]) &&
    typeof candidate["isLoading"] === "boolean" &&
    (!("error" in candidate) || typeof candidate["error"] === "string") &&
    Array.isArray(candidate["selectedProviders"]) &&
    "filters" in candidate
  );
}

/**
 * Type guard for SearchFilters
 * Validates that an object conforms to the SearchFilters interface
 */
export function isSearchFilters(obj: unknown): obj is SearchFilters {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("status" in candidate) || typeof candidate["status"] === "string") &&
    (!("year" in candidate) || typeof candidate["year"] === "number") &&
    (!("genres" in candidate) || Array.isArray(candidate["genres"]) && candidate["genres"].every((x: unknown) => typeof x === "string")) &&
    (!("tags" in candidate) || Array.isArray(candidate["tags"]) && candidate["tags"].every((x: unknown) => typeof x === "string")) &&
    (!("rating" in candidate) || typeof candidate["rating"] === "number") &&
    (!("sortBy" in candidate) || "sortBy" in candidate) &&
    (!("sortOrder" in candidate) || "sortOrder" in candidate)
  );
}

/**
 * Type guard for ProviderSearchConfig
 * Validates that an object conforms to the ProviderSearchConfig interface
 */
export function isProviderSearchConfig(obj: unknown): obj is ProviderSearchConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "provider" in candidate &&
    typeof candidate["enabled"] === "boolean" &&
    typeof candidate["priority"] === "number" &&
    Array.isArray(candidate["capabilities"]) &&
    (!("timeout" in candidate) || typeof candidate["timeout"] === "number")
  );
}

/**
 * Type guard for UISearchResult
 * Validates that an object conforms to the UISearchResult interface
 */
export function isUISearchResult(obj: unknown): obj is UISearchResult {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("isSelected" in candidate) || typeof candidate["isSelected"] === "boolean") &&
    (!("isLoading" in candidate) || typeof candidate["isLoading"] === "boolean") &&
    (!("isFavorite" in candidate) || typeof candidate["isFavorite"] === "boolean") &&
    (!("matchScore" in candidate) || typeof candidate["matchScore"] === "number") &&
    (!("providerConfidence" in candidate) || typeof candidate["providerConfidence"] === "number")
  );
}

/**
 * Type guard for AggregatedSearchResponse
 * Validates that an object conforms to the AggregatedSearchResponse interface
 */
export function isAggregatedSearchResponse(obj: unknown): obj is AggregatedSearchResponse {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    Array.isArray(candidate["results"]) &&
    typeof candidate["totalCount"] === "number" &&
    "providers" in candidate &&
    typeof candidate["searchTime"] === "number"
  );
}

/**
 * Type guard for SearchContext
 * Validates that an object conforms to the SearchContext interface
 */
export function isSearchContext(obj: unknown): obj is SearchContext {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "state" in candidate &&
    "actions" in candidate
  );
}