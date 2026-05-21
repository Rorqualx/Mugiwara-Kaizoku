/**
 * External Manga Types - Shared Validation Utilities
 *
 * This module contains shared helper functions for validating external manga type objects.
 * These utilities are used across all provider-specific type guard modules to reduce
 * complexity and eliminate code duplication.
 *
 * @module ExternalMangaTypesUtils
 * @category TypeGuards
 * @subcategory Kapowarr
 */

/**
 * Safely check if a value is a record (non-null object)
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Check if a property exists and has a specific type
 */
export function hasPropertyType(
  obj: Record<string, unknown>,
  key: string,
  type: 'string' | 'number' | 'boolean'
): boolean {
  return key in obj && typeof obj[key] === type;
}

/**
 * Check if a property exists and is an array of specific type
 */
export function hasArrayPropertyType(
  obj: Record<string, unknown>,
  key: string,
  elementType: 'string' | 'number' | 'boolean'
): boolean {
  if (!(key in obj) || !Array.isArray(obj[key])) {
    return false;
  }

  const array = obj[key] as unknown[];
  return array.every((element) => typeof element === elementType);
}

/**
 * Check if an optional property exists and has a specific type
 */
export function hasOptionalPropertyType(
  obj: Record<string, unknown>,
  key: string,
  type: 'string' | 'number' | 'boolean'
): boolean {
  return !(key in obj) || typeof obj[key] === type;
}

/**
 * Check if an optional property exists and is an array of specific type
 */
export function hasOptionalArrayPropertyType(
  obj: Record<string, unknown>,
  key: string,
  elementType: 'string' | 'number' | 'boolean'
): boolean {
  return !(key in obj) || hasArrayPropertyType(obj, key, elementType);
}

/**
 * Check if a property exists (regardless of type)
 */
export function hasProperty(obj: Record<string, unknown>, key: string): boolean {
  return key in obj;
}

/**
 * Check if an optional property exists (regardless of type)
 */
export function hasOptionalProperty(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || hasProperty(obj, key);
}

/**
 * Validate required string properties
 */
export function validateRequiredStrings(
  obj: Record<string, unknown>,
  keys: string[]
): boolean {
  return keys.every((key) => hasPropertyType(obj, key, 'string'));
}

/**
 * Validate required number properties
 */
export function validateRequiredNumbers(
  obj: Record<string, unknown>,
  keys: string[]
): boolean {
  return keys.every((key) => hasPropertyType(obj, key, 'number'));
}

/**
 * Validate required boolean properties
 */
export function validateRequiredBooleans(
  obj: Record<string, unknown>,
  keys: string[]
): boolean {
  return keys.every((key) => hasPropertyType(obj, key, 'boolean'));
}