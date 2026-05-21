/**
 * MyAnimeList External Manga Type Guards
 *
 * This module contains type guards for validating ExternalMALManga objects.
 * Complex validation logic is decomposed into smaller, focused functions to
 * maintain code readability and reduce complexity.
 *
 * @module MALExternalMangaTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { ExternalMALManga } from "@/types/manga/external";

import {
  isRecord,
  hasOptionalPropertyType,
  hasOptionalProperty,
  validateRequiredNumbers,
  validateRequiredStrings,
} from "./utils";


/**
 * Validate required MAL manga properties
 */
function validateMALRequiredProperties(obj: Record<string, unknown>): boolean {
  return (
    validateRequiredNumbers(obj, ["id"]) &&
    validateRequiredStrings(obj, ["title"])
  );
}

/**
 * Validate optional string properties for MAL manga
 */
function validateMALOptionalStrings(obj: Record<string, unknown>): boolean {
  return (
    hasOptionalPropertyType(obj, "start_date", "string") &&
    hasOptionalPropertyType(obj, "end_date", "string") &&
    hasOptionalPropertyType(obj, "synopsis", "string") &&
    hasOptionalPropertyType(obj, "created_at", "string") &&
    hasOptionalPropertyType(obj, "updated_at", "string") &&
    hasOptionalPropertyType(obj, "media_type", "string")
  );
}

/**
 * Validate optional number properties for MAL manga
 */
function validateMALOptionalNumbers(obj: Record<string, unknown>): boolean {
  return (
    hasOptionalPropertyType(obj, "mean", "number") &&
    hasOptionalPropertyType(obj, "rank", "number") &&
    hasOptionalPropertyType(obj, "popularity", "number") &&
    hasOptionalPropertyType(obj, "num_list_users", "number") &&
    hasOptionalPropertyType(obj, "num_scoring_users", "number") &&
    hasOptionalPropertyType(obj, "num_volumes", "number") &&
    hasOptionalPropertyType(obj, "num_chapters", "number")
  );
}

/**
 * Validate complex optional properties for MAL manga
 */
function validateMALComplexProperties(obj: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(obj, "main_picture") &&
    hasOptionalProperty(obj, "alternative_titles") &&
    hasOptionalProperty(obj, "nsfw") &&
    hasOptionalProperty(obj, "status") &&
    hasOptionalProperty(obj, "genres") &&
    hasOptionalProperty(obj, "my_list_status") &&
    hasOptionalProperty(obj, "authors")
  );
}

/**
 * Type guard for ExternalMALManga
 * Validates that an object conforms to the ExternalMALManga interface
 */
export function isExternalMALManga(obj: unknown): obj is ExternalMALManga {
  if (!isRecord(obj)) {
    return false;
  }

  const candidate = obj;

  return (
    validateMALRequiredProperties(candidate) &&
    validateMALOptionalStrings(candidate) &&
    validateMALOptionalNumbers(candidate) &&
    validateMALComplexProperties(candidate)
  );
}