/**
 * AniList External Manga Type Guards
 *
 * This module contains type guards for validating ExternalAnilistManga objects.
 * Complex validation logic is decomposed into smaller, focused functions to
 * maintain code readability and reduce complexity.
 *
 * @module AnilistExternalMangaTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { ExternalAnilistManga } from "@/types/manga/external";

import {
  isRecord,
  hasOptionalPropertyType,
  hasOptionalArrayPropertyType,
  hasOptionalProperty,
  validateRequiredNumbers,
} from "./utils";


/**
 * Validate required AniList manga properties
 */
function validateAnilistRequiredProperties(obj: Record<string, unknown>): boolean {
  return (
    validateRequiredNumbers(obj, ["id"]) &&
    hasOptionalPropertyType(obj, "idMal", "number") &&
    "title" in obj
  );
}

/**
 * Validate optional string properties for AniList manga
 */
function validateAnilistOptionalStrings(obj: Record<string, unknown>): boolean {
  return (
    hasOptionalPropertyType(obj, "format", "string") &&
    hasOptionalPropertyType(obj, "bannerImage", "string") &&
    hasOptionalPropertyType(obj, "siteUrl", "string") &&
    hasOptionalPropertyType(obj, "countryOfOrigin", "string")
  );
}

/**
 * Validate optional number properties for AniList manga
 */
function validateAnilistOptionalNumbers(obj: Record<string, unknown>): boolean {
  return (
    hasOptionalPropertyType(obj, "meanScore", "number") &&
    hasOptionalPropertyType(obj, "popularity", "number") &&
    hasOptionalPropertyType(obj, "favourites", "number")
  );
}

/**
 * Validate optional boolean properties for AniList manga
 */
function validateAnilistOptionalBooleans(obj: Record<string, unknown>): boolean {
  return hasOptionalPropertyType(obj, "isAdult", "boolean");
}

/**
 * Validate optional array properties for AniList manga
 */
function validateAnilistOptionalArrays(obj: Record<string, unknown>): boolean {
  return (
    hasOptionalArrayPropertyType(obj, "genres", "string") &&
    hasOptionalArrayPropertyType(obj, "synonyms", "string")
  );
}

/**
 * Validate complex optional properties for AniList manga
 */
function validateAnilistComplexProperties(obj: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(obj, "description") &&
    hasOptionalProperty(obj, "status") &&
    hasOptionalProperty(obj, "startDate") &&
    hasOptionalProperty(obj, "endDate") &&
    hasOptionalProperty(obj, "chapters") &&
    hasOptionalProperty(obj, "volumes") &&
    hasOptionalProperty(obj, "coverImage") &&
    hasOptionalProperty(obj, "tags") &&
    hasOptionalProperty(obj, "staff")
  );
}

/**
 * Type guard for ExternalAnilistManga
 * Validates that an object conforms to the ExternalAnilistManga interface
 */
export function isExternalAnilistManga(obj: unknown): obj is ExternalAnilistManga {
  if (!isRecord(obj)) {
    return false;
  }

  const candidate = obj;

  return (
    validateAnilistRequiredProperties(candidate) &&
    validateAnilistOptionalStrings(candidate) &&
    validateAnilistOptionalNumbers(candidate) &&
    validateAnilistOptionalBooleans(candidate) &&
    validateAnilistOptionalArrays(candidate) &&
    validateAnilistComplexProperties(candidate)
  );
}