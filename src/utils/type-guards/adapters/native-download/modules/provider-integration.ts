/**
 * Provider Integration Type Guards
 *
 * Type guards for provider-specific search and error handling types.
 * Focuses on provider integration, search responses, and external links.
 *
 * Type Guards:
 * - isProviderErrorInfo: Validates provider error info objects
 * - isProviderSearchResult: Validates provider search results
 * - isSearchResponseWithErrors: Validates search responses with error handling
 * - isExternalLink: Validates external link objects
 *
 * Extracted from: search-types.ts (lines 239-307)
 */

import type {
  ProviderErrorInfo,
  ProviderSearchResult,
  SearchResponseWithErrors,
  ExternalLink
} from "@/types/search.types";

// Import from foundation utils
import {
  isRecord,
  validateRequiredString,
  validateOptionalString,
  validateRequiredArray,
  validateOptionalArray
} from './search-types-utils';

/**
 * Type guard for ProviderErrorInfo
 * Validates that an object conforms to the ProviderErrorInfo interface
 */
export function isProviderErrorInfo(obj: unknown): obj is ProviderErrorInfo {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "provider") &&
    validateRequiredString(obj, "error") &&
    typeof obj["timestamp"] === "number"
    // errorType is optional and can be any type
  );
}

/**
 * Type guard for ProviderSearchResult
 * Validates that an object conforms to the ProviderSearchResult interface
 */
export function isProviderSearchResult(obj: unknown): obj is ProviderSearchResult {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "provider") &&
    validateRequiredArray(obj, "results") &&
    validateOptionalString(obj, "error") &&
    (!("totalResults" in obj) || typeof obj["totalResults"] === "number")
    // errorType is optional and can be any type
  );
}

/**
 * Type guard for SearchResponseWithErrors
 * Validates that an object conforms to the SearchResponseWithErrors interface
 */
export function isSearchResponseWithErrors(obj: unknown): obj is SearchResponseWithErrors {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredArray(obj, "results") &&
    validateOptionalArray(obj, "providerErrors")
  );
}

/**
 * Type guard for ExternalLink
 * Validates that an object conforms to the ExternalLink interface
 */
export function isExternalLink(obj: unknown): obj is ExternalLink {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "type") &&
    validateRequiredString(obj, "url") &&
    validateOptionalString(obj, "label")
  );
}