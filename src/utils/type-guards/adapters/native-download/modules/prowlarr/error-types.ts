/**
 * Prowlarr Error Types Type Guards
 * 
 * Type guards for Prowlarr error-related types to reduce complexity
 * and improve maintainability.
 * 
 * @module ProwlarrErrorTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  ProwlarrError
} from "@/types/prowlarr";

import {
  isValidObject,
  hasPropertyType,
  hasOptionalPropertyType
} from "./utils";

/**
 * Type guard for ProwlarrError
 * Validates that an object conforms to the ProwlarrError interface
 */
export function isProwlarrError(obj: unknown): obj is ProwlarrError {
  if (!isValidObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    hasPropertyType(candidate, "message", "string") &&
    hasOptionalPropertyType(candidate, "description", "string") &&
    hasOptionalPropertyType(candidate, "type", "string") &&
    hasOptionalPropertyType(candidate, "propertyName", "string") &&
    hasOptionalPropertyType(candidate, "details", "array")
  );
}
