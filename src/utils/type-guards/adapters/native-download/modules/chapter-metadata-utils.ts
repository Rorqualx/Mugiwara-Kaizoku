/**
 * Chapter Metadata Validation Utilities
 *
 * Shared helper functions for validating chapter metadata properties.
 * Used across all chapter metadata type guards to reduce complexity.
 *
 * @module ChapterMetadataUtils
 * @category TypeGuards
 * @subcategory Kapowarr
 */

/**
 * Check if a property exists on an object and is of the expected type
 */
export function isOptionalString(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || typeof obj[key] === "string";
}

/**
 * Check if a property exists on an object and is a number
 */
export function isOptionalNumber(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || typeof obj[key] === "number";
}

/**
 * Check if a property exists on an object and is a string
 */
export function isRequiredString(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === "string";
}

/**
 * Check if a property exists on an object and is a number
 */
export function isRequiredNumber(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === "number";
}

/**
 * Check if a property exists on an object (type doesn't matter)
 */
export function hasProperty(obj: Record<string, unknown>, key: string): boolean {
  return key in obj;
}

/**
 * Validate resolution properties (width, height, label)
 */
export function validateResolutionProperties(obj: Record<string, unknown>): boolean {
  return (
    (!("resolutionWidth" in obj) || typeof obj["resolutionWidth"] === "number") &&
    (!("resolutionHeight" in obj) || typeof obj["resolutionHeight"] === "number") &&
    (!("resolutionLabel" in obj) || typeof obj["resolutionLabel"] === "string")
  );
}

/**
 * Validate basic chapter properties (title, fileName, index, size)
 */
export function validateBasicChapterProperties(obj: Record<string, unknown>): boolean {
  return (
    (!("title" in obj) || typeof obj["title"] === "string") &&
    (!("fileName" in obj) || typeof obj["fileName"] === "string") &&
    (!("index" in obj) || typeof obj["index"] === "number") &&
    (!("size" in obj) || typeof obj["size"] === "number")
  );
}

/**
 * Validate optional chapter properties (language, pageCount)
 */
export function validateOptionalChapterProperties(obj: Record<string, unknown>): boolean {
  return (
    (!("language" in obj) || typeof obj["language"] === "string") &&
    (!("pageCount" in obj) || typeof obj["pageCount"] === "number")
  );
}
