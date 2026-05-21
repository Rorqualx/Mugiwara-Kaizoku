/**
 * Search Types Utilities Module
 *
 * Shared helper functions and validation patterns used across all
 * search types type guard modules.
 *
 * Extracted from: search-types.ts (shared patterns)
 */

// ============================================================================
// Type Guards for Primitive Types
// ============================================================================

/**
 * Type guard for Record<string, unknown>
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard for string array
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x: unknown) => typeof x === 'string');
}

/**
 * Type guard for number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Type guard for boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard for Date
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * Type guard for string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that a required string property exists
 */
export function validateRequiredString(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === 'string';
}

/**
 * Validates that an optional string property is either missing or a string
 */
export function validateOptionalString(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || typeof obj[key] === 'string';
}

/**
 * Validates that an optional string array property is either missing or a valid string array
 */
export function validateOptionalStringArray(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || (Array.isArray(obj[key]) && (obj[key] as unknown[]).every((x: unknown) => typeof x === 'string'));
}

/**
 * Validates that an optional number property is either missing or a number
 */
export function validateOptionalNumber(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || typeof obj[key] === 'number';
}

/**
 * Validates that an optional boolean property is either missing or a boolean
 */
export function validateOptionalBoolean(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || typeof obj[key] === 'boolean';
}


/**
 * Validates that an optional array property is either missing or an array
 */
export function validateOptionalArray(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || Array.isArray(obj[key]);
}

/**
 * Validates that a required number property exists
 */
export function validateRequiredNumber(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === 'number';
}

/**
 * Validates that a required array property exists
 */
export function validateRequiredArray(obj: Record<string, unknown>, key: string): boolean {
  return Array.isArray(obj[key]);
}

/**
 * Validates that a required boolean property exists
 */
export function validateRequiredBoolean(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === 'boolean';
}

/**
 * Validates that a required Date property exists
 */
export function validateDateField(obj: Record<string, unknown>, key: string): boolean {
  return obj[key] instanceof Date;
}

/**
 * Validates that an optional Date property is either missing or a Date
 */
export function validateOptionalDateField(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || obj[key] instanceof Date;
}

/**
 * Validates that a required property exists (any type)
 */
export function validateRequiredField(obj: Record<string, unknown>, key: string): boolean {
  return key in obj;
}

/**
 * Validates that an optional object property is either missing or an object
 */
export function validateOptionalObject(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || (typeof obj[key] === 'object' && obj[key] !== null);
}

/**
 * Validates that a property exists (regardless of type)
 */
export function validatePropertyExists(obj: Record<string, unknown>, key: string): boolean {
  return key in obj;
}

/**
 * Validates that an optional property exists with any type
 */
export function validateOptionalProperty(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || true; // Always returns true for optional properties
}

// ============================================================================
// Composite Validation Helpers
// ============================================================================

/**
 * Validates multiple required string properties
 */
export function validateRequiredStrings(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(key => validateRequiredString(obj, key));
}

/**
 * Validates multiple optional string properties
 */
export function validateOptionalStrings(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(key => validateOptionalString(obj, key));
}

/**
 * Validates multiple optional string array properties
 */
export function validateOptionalStringArrays(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(key => validateOptionalStringArray(obj, key));
}

/**
 * Validates multiple optional number properties
 */
export function validateOptionalNumbers(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(key => validateOptionalNumber(obj, key));
}

/**
 * Validates multiple optional boolean properties
 */
export function validateOptionalBooleans(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(key => validateOptionalBoolean(obj, key));
}


/**
 * Validates multiple optional array properties
 */
export function validateOptionalArrays(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(key => validateOptionalArray(obj, key));
}

/**
 * Validates multiple optional properties (any type)
 */
export function validateOptionalProperties(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(key => validateOptionalProperty(obj, key));
}

// ============================================================================
// Common Validation Patterns
// ============================================================================

/**
 * Common pattern for validating manga metadata properties
 */
export function validateMangaMetadataPattern(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalString(obj, 'id') &&
    validateRequiredString(obj, 'title') &&
    validateOptionalStringArray(obj, 'alternativeTitles') &&
    validateOptionalString(obj, 'description') &&
    validateOptionalProperty(obj, 'status') &&
    validateOptionalStringArray(obj, 'genres') &&
    validateOptionalProperty(obj, 'tags') &&
    validateOptionalStringArray(obj, 'authors') &&
    validateOptionalStringArray(obj, 'artists') &&
    validateOptionalString(obj, 'coverImage') &&
    validateOptionalString(obj, 'coverUrl') &&
    validateOptionalString(obj, 'bannerImage') &&
    validateOptionalNumber(obj, 'chapters') &&
    validateOptionalNumber(obj, 'volumes') &&
    validateOptionalNumber(obj, 'year') &&
    validateOptionalString(obj, 'publisher')
  );
}

/**
 * Common pattern for validating search result properties
 */
export function validateSearchResultPattern(obj: Record<string, unknown>): boolean {
  return (
    validateRequiredString(obj, 'id') &&
    validateRequiredString(obj, 'title') &&
    validateOptionalString(obj, 'description') &&
    validateOptionalString(obj, 'coverImage') &&
    validateRequiredString(obj, 'provider') &&
    validateOptionalProperty(obj, 'metadata') &&
    validateOptionalString(obj, 'cover') &&
    validateOptionalStringArray(obj, 'genres') &&
    validateOptionalStringArray(obj, 'alternativeTitles') &&
    validateOptionalNumber(obj, 'volumes') &&
    validateOptionalNumber(obj, 'chapters') &&
    validateOptionalNumber(obj, 'score') &&
    validateOptionalProperty(obj, 'status') &&
    validateOptionalString(obj, 'format') &&
    validateOptionalString(obj, 'url')
  );
}