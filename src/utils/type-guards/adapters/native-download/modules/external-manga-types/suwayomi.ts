/**
 * Suwayomi External Manga Type Guards
 *
 * This module contains type guards for validating ExternalSuwayomiManga objects.
 * Complex validation logic is decomposed into smaller, focused functions to
 * maintain code readability and reduce complexity.
 *
 * @module SuwayomiExternalMangaTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { ExternalSuwayomiManga } from "@/types/manga/external";

import {
  isRecord,
  hasOptionalPropertyType,
  hasOptionalArrayPropertyType,
  hasOptionalProperty,
  validateRequiredStrings,
} from "./utils";


/**
 * Validate required Suwayomi manga properties
 */
function validateSuwayomiRequiredProperties(obj: Record<string, unknown>): boolean {
  return (
    validateRequiredStrings(obj, ["id", "sourceId", "url", "title", "status"]) &&
    hasOptionalPropertyType(obj, "artist", "string") &&
    hasOptionalPropertyType(obj, "author", "string") &&
    hasOptionalPropertyType(obj, "description", "string")
  );
}

/**
 * Validate optional string properties for Suwayomi manga
 */
function validateSuwayomiOptionalStrings(obj: Record<string, unknown>): boolean {
  return (
    hasOptionalPropertyType(obj, "thumbnailUrl", "string") &&
    hasOptionalPropertyType(obj, "source", "string") &&
    hasOptionalPropertyType(obj, "realUrl", "string") &&
    hasOptionalPropertyType(obj, "lastFetchedAt", "string") &&
    hasOptionalPropertyType(obj, "chaptersLastFetchedAt", "string") &&
    hasOptionalPropertyType(obj, "updateStrategy", "string")
  );
}

/**
 * Validate optional boolean properties for Suwayomi manga
 */
function validateSuwayomiOptionalBooleans(obj: Record<string, unknown>): boolean {
  return (
    hasOptionalPropertyType(obj, "inLibrary", "boolean") &&
    hasOptionalPropertyType(obj, "initialized", "boolean")
  );
}

/**
 * Validate optional number properties for Suwayomi manga
 */
function validateSuwayomiOptionalNumbers(obj: Record<string, unknown>): boolean {
  return (
    hasOptionalPropertyType(obj, "chapterCount", "number") &&
    hasOptionalPropertyType(obj, "downloadCount", "number") &&
    hasOptionalPropertyType(obj, "unreadCount", "number")
  );
}

/**
 * Validate optional array properties for Suwayomi manga
 */
function validateSuwayomiOptionalArrays(obj: Record<string, unknown>): boolean {
  return hasOptionalArrayPropertyType(obj, "genre", "string");
}

/**
 * Validate complex optional properties for Suwayomi manga
 */
function validateSuwayomiComplexProperties(obj: Record<string, unknown>): boolean {
  return hasOptionalProperty(obj, "lastChapterRead");
}

/**
 * Type guard for ExternalSuwayomiManga
 * Validates that an object conforms to the ExternalSuwayomiManga interface
 */
export function isExternalSuwayomiManga(obj: unknown): obj is ExternalSuwayomiManga {
  if (!isRecord(obj)) {
    return false;
  }

  const candidate = obj;

  return (
    validateSuwayomiRequiredProperties(candidate) &&
    validateSuwayomiOptionalStrings(candidate) &&
    validateSuwayomiOptionalBooleans(candidate) &&
    validateSuwayomiOptionalNumbers(candidate) &&
    validateSuwayomiOptionalArrays(candidate) &&
    validateSuwayomiComplexProperties(candidate)
  );
}