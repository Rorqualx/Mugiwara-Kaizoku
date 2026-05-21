/**
 * Chapter Type Validators
 *
 * Decomposed type guards for validating Chapter objects.
 * Extracted from universal-import-wizard.ts (lines 63-87)
 *
 * @module ChapterValidators
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { Chapter } from "@/types/universalImportWizard.types";

/**
 * Check if a property exists in an object
 */
function propertyExists(obj: Record<string, unknown>, property: string): boolean {
  return property in obj;
}

/**
 * Check if a property has the expected type
 */
function hasPropertyType(obj: Record<string, unknown>, property: string, expectedType: string): boolean {
  return typeof obj[property] === expectedType;
}

/**
 * Validate numeric properties of a Chapter
 */
export function validateChapterNumericProperties(candidate: Record<string, unknown>): boolean {
  return (
    (!propertyExists(candidate, "number") || hasPropertyType(candidate, "number", "number")) &&
    (!propertyExists(candidate, "chapterNumber") || hasPropertyType(candidate, "chapterNumber", "number")) &&
    (!propertyExists(candidate, "volume") || hasPropertyType(candidate, "volume", "number")) &&
    (!propertyExists(candidate, "pageCount") || hasPropertyType(candidate, "pageCount", "number"))
  );
}

/**
 * Validate string properties of a Chapter
 */
export function validateChapterStringProperties(candidate: Record<string, unknown>): boolean {
  return (
    (!propertyExists(candidate, "title") || hasPropertyType(candidate, "title", "string")) &&
    (!propertyExists(candidate, "url") || hasPropertyType(candidate, "url", "string")) &&
    (!propertyExists(candidate, "coverImageUrl") || hasPropertyType(candidate, "coverImageUrl", "string")) &&
    (!propertyExists(candidate, "coverUrl") || hasPropertyType(candidate, "coverUrl", "string")) &&
    (!propertyExists(candidate, "coverImage") || hasPropertyType(candidate, "coverImage", "string")) &&
    (!propertyExists(candidate, "cover") || hasPropertyType(candidate, "cover", "string")) &&
    (!propertyExists(candidate, "summary") || hasPropertyType(candidate, "summary", "string")) &&
    (!propertyExists(candidate, "description") || hasPropertyType(candidate, "description", "string")) &&
    (!propertyExists(candidate, "synopsis") || hasPropertyType(candidate, "synopsis", "string")) &&
    (!propertyExists(candidate, "releaseDate") || hasPropertyType(candidate, "releaseDate", "string"))
  );
}

/**
 * Validate boolean properties of a Chapter
 */
export function validateChapterBooleanProperties(candidate: Record<string, unknown>): boolean {
  return (
    (!propertyExists(candidate, "detailsFetched") || hasPropertyType(candidate, "detailsFetched", "boolean"))
  );
}

/**
 * Type guard for Chapter
 * Validates that an object conforms to the Chapter interface
 *
 * Decomposed from original 24-condition function
 */
export function isChapter(obj: unknown): obj is Chapter {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateChapterNumericProperties(candidate) &&
    validateChapterStringProperties(candidate) &&
    validateChapterBooleanProperties(candidate)
  );
}