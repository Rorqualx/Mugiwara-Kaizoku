/**
 * API V1 Request Validation Utilities
 *
 * Shared helper functions for validating API V1 request objects.
 * Used to reduce complexity in type guard functions.
 *
 * @module ApiV1RequestUtils
 * @category TypeGuards
 * @subcategory Kapowarr
 */

/**
 * Check if a value is an optional string property
 */
export function isOptionalString(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || typeof obj[key] === "string";
}

/**
 * Check if a value is an optional number property
 */
export function isOptionalNumber(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || typeof obj[key] === "number";
}

/**
 * Check if a value is an optional array of strings
 */
export function isOptionalArrayOfStrings(obj: Record<string, unknown>, key: string): boolean {
  if (!(key in obj)) {
    return true;
  }
  
  const value = obj[key];
  return Array.isArray(value) && value.every((x: unknown) => typeof x === "string");
}

/**
 * Check if a value is a required string property
 */
export function isRequiredString(obj: Record<string, unknown>, key: string): boolean {
  return key in obj && typeof obj[key] === "string";
}

/**
 * Check if a value is a required number property
 */
export function isRequiredNumber(obj: Record<string, unknown>, key: string): boolean {
  return key in obj && typeof obj[key] === "number";
}

/**
 * Check if a value is an optional property that exists (for enum-like fields)
 */
export function isOptionalPropertyExists(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || key in obj;
}

/**
 * Validate manga core properties (title and source)
 */
export function validateMangaCoreProperties(obj: Record<string, unknown>): boolean {
  return (
    isRequiredString(obj, "title") &&
    isRequiredString(obj, "source")
  );
}

/**
 * Validate manga optional properties (all other manga fields)
 */
export function validateMangaOptionalProperties(obj: Record<string, unknown>): boolean {
  return (
    isOptionalString(obj, "sourceId") &&
    isOptionalString(obj, "coverUrl") &&
    isOptionalString(obj, "description") &&
    isOptionalPropertyExists(obj, "status") &&
    isOptionalArrayOfStrings(obj, "authors") &&
    isOptionalArrayOfStrings(obj, "artists") &&
    isOptionalArrayOfStrings(obj, "genres") &&
    isOptionalArrayOfStrings(obj, "tags") &&
    isOptionalArrayOfStrings(obj, "alternativeTitles") &&
    isOptionalNumber(obj, "year") &&
    isOptionalString(obj, "publisher") &&
    isOptionalNumber(obj, "rating") &&
    isOptionalNumber(obj, "chapters") &&
    isOptionalNumber(obj, "volumes")
  );
}

/**
 * Validate manga update properties (all fields optional)
 */
export function validateMangaUpdateProperties(obj: Record<string, unknown>): boolean {
  return (
    isOptionalString(obj, "title") &&
    isOptionalString(obj, "source") &&
    isOptionalString(obj, "sourceId") &&
    isOptionalString(obj, "coverUrl") &&
    isOptionalString(obj, "description") &&
    isOptionalPropertyExists(obj, "status") &&
    isOptionalArrayOfStrings(obj, "authors") &&
    isOptionalArrayOfStrings(obj, "artists") &&
    isOptionalArrayOfStrings(obj, "genres") &&
    isOptionalArrayOfStrings(obj, "tags") &&
    isOptionalArrayOfStrings(obj, "alternativeTitles") &&
    isOptionalNumber(obj, "year") &&
    isOptionalString(obj, "publisher") &&
    isOptionalNumber(obj, "rating") &&
    isOptionalNumber(obj, "chapters") &&
    isOptionalNumber(obj, "volumes")
  );
}
