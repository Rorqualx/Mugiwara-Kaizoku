/**
 * Anilist Manga Type Validators
 *
 * Modular validators for ExternalAnilistManga type guard decomposition
 */

import {
  isNumber,
  isString,
  isBoolean,
  isObject,
  isStringArray,
  hasOptionalProperty,
  hasOptionalPropertyOfType,
  hasRequiredPropertyOfType,
  hasProperty
} from "../shared-validators/basic-validators";

/**
 * Validate required Anilist manga fields
 */
export function validateRequiredAnilistFields(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasRequiredPropertyOfType(candidate, "id", isNumber) &&
    hasProperty(candidate, "title")
  );
}

/**
 * Validate optional Anilist manga fields with type checking
 */
export function validateOptionalAnilistFields(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasOptionalPropertyOfType(candidate, "idMal", isNumber) &&
    hasOptionalProperty(candidate, "description") &&
    hasOptionalPropertyOfType(candidate, "format", isString) &&
    hasOptionalProperty(candidate, "status") &&
    hasOptionalProperty(candidate, "startDate") &&
    hasOptionalProperty(candidate, "endDate") &&
    hasOptionalProperty(candidate, "chapters") &&
    hasOptionalProperty(candidate, "volumes") &&
    hasOptionalProperty(candidate, "coverImage") &&
    hasOptionalPropertyOfType(candidate, "bannerImage", isString) &&
    hasOptionalPropertyOfType(candidate, "genres", isStringArray) &&
    hasOptionalPropertyOfType(candidate, "synonyms", isStringArray) &&
    hasOptionalPropertyOfType(candidate, "meanScore", isNumber) &&
    hasOptionalPropertyOfType(candidate, "popularity", isNumber) &&
    hasOptionalPropertyOfType(candidate, "favourites", isNumber) &&
    hasOptionalProperty(candidate, "tags") &&
    hasOptionalProperty(candidate, "staff") &&
    hasOptionalPropertyOfType(candidate, "isAdult", isBoolean) &&
    hasOptionalPropertyOfType(candidate, "siteUrl", isString) &&
    hasOptionalPropertyOfType(candidate, "countryOfOrigin", isString)
  );
}

/**
 * Validate Anilist title structure
 */
export function validateAnilistTitle(
  title: unknown
): title is { romaji: string; english?: string | null; native: string; userPreferred?: string } {
  if (!isObject(title)) return false;

  const titleObj = title as Record<string, unknown>;
  return (
    hasRequiredPropertyOfType(titleObj, "romaji", isString) &&
    hasRequiredPropertyOfType(titleObj, "native", isString) &&
    hasOptionalProperty(titleObj, "english") &&
    hasOptionalProperty(titleObj, "userPreferred")
  );
}

/**
 * Validate Anilist date structure
 */
export function validateAnilistDate(
  date: unknown
): date is { year?: number | null; month?: number | null; day?: number | null } {
  if (!isObject(date)) return false;

  const dateObj = date as Record<string, unknown>;
  return (
    hasOptionalProperty(dateObj, "year") &&
    hasOptionalProperty(dateObj, "month") &&
    hasOptionalProperty(dateObj, "day")
  );
}

/**
 * Validate Anilist cover image structure
 */
export function validateAnilistCoverImage(
  coverImage: unknown
): coverImage is { extraLarge?: string; large?: string; medium?: string; color?: string } {
  if (!isObject(coverImage)) return false;

  const coverObj = coverImage as Record<string, unknown>;
  return (
    hasOptionalProperty(coverObj, "extraLarge") &&
    hasOptionalProperty(coverObj, "large") &&
    hasOptionalProperty(coverObj, "medium") &&
    hasOptionalProperty(coverObj, "color")
  );
}

/**
 * Validate Anilist tag structure
 */
export function validateAnilistTag(
  tag: unknown
): tag is { id: number; name: string; description?: string; category?: string; rank?: number; isGeneralSpoiler?: boolean; isMediaSpoiler?: boolean; isAdult?: boolean } {
  if (!isObject(tag)) return false;

  const tagObj = tag as Record<string, unknown>;
  return (
    hasRequiredPropertyOfType(tagObj, "id", isNumber) &&
    hasRequiredPropertyOfType(tagObj, "name", isString) &&
    hasOptionalProperty(tagObj, "description") &&
    hasOptionalProperty(tagObj, "category") &&
    hasOptionalProperty(tagObj, "rank") &&
    hasOptionalProperty(tagObj, "isGeneralSpoiler") &&
    hasOptionalProperty(tagObj, "isMediaSpoiler") &&
    hasOptionalProperty(tagObj, "isAdult")
  );
}

/**
 * Validate Anilist staff structure
 */
export function validateAnilistStaff(
  staff: unknown
): staff is { nodes?: Array<{ id: number; name: { full: string; native?: string }; role?: string }> } {
  if (!isObject(staff)) return false;

  const staffObj = staff as Record<string, unknown>;
  return hasOptionalProperty(staffObj, "nodes");
}