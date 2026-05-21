/**
 * Suwayomi Manga Type Validators
 *
 * Modular validators for ExternalSuwayomiManga type guard decomposition
 */

import {
  isString,
  isNumber,
  isBoolean,
  isObject,
  isStringArray,
  hasOptionalProperty,
  hasOptionalPropertyOfType,
  hasRequiredPropertyOfType
} from "../shared-validators/basic-validators";

/**
 * Validate required Suwayomi manga fields
 */
export function validateRequiredSuwayomiFields(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasRequiredPropertyOfType(candidate, "id", isString) &&
    hasRequiredPropertyOfType(candidate, "sourceId", isString) &&
    hasRequiredPropertyOfType(candidate, "url", isString) &&
    hasRequiredPropertyOfType(candidate, "title", isString) &&
    hasRequiredPropertyOfType(candidate, "status", isString)
  );
}

/**
 * Validate optional Suwayomi manga fields with type checking
 */
export function validateOptionalSuwayomiFields(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasOptionalPropertyOfType(candidate, "artist", isString) &&
    hasOptionalPropertyOfType(candidate, "author", isString) &&
    hasOptionalPropertyOfType(candidate, "description", isString) &&
    hasOptionalPropertyOfType(candidate, "genre", isStringArray) &&
    hasOptionalPropertyOfType(candidate, "thumbnailUrl", isString) &&
    hasOptionalPropertyOfType(candidate, "inLibrary", isBoolean) &&
    hasOptionalPropertyOfType(candidate, "source", isString) &&
    hasOptionalPropertyOfType(candidate, "realUrl", isString) &&
    hasOptionalPropertyOfType(candidate, "lastFetchedAt", isString) &&
    hasOptionalPropertyOfType(candidate, "chaptersLastFetchedAt", isString) &&
    hasOptionalPropertyOfType(candidate, "updateStrategy", isString) &&
    hasOptionalPropertyOfType(candidate, "initialized", isBoolean) &&
    hasOptionalPropertyOfType(candidate, "chapterCount", isNumber) &&
    hasOptionalPropertyOfType(candidate, "downloadCount", isNumber) &&
    hasOptionalPropertyOfType(candidate, "unreadCount", isNumber) &&
    hasOptionalProperty(candidate, "lastChapterRead")
  );
}

/**
 * Validate Suwayomi last chapter read structure
 */
export function validateSuwayomiLastChapterRead(
  chapter: unknown
): chapter is {
  id: string;
  url: string;
  name: string;
  uploadDate?: number;
  chapterNumber?: number;
  scanlator?: string;
  mangaId: string;
  read: boolean;
  bookmarked: boolean;
  lastPageRead?: number;
  lastReadAt?: number;
  index?: number;
} {
  if (!isObject(chapter)) return false;

  const chapterObj = chapter as Record<string, unknown>;
  return (
    hasRequiredPropertyOfType(chapterObj, "id", isString) &&
    hasRequiredPropertyOfType(chapterObj, "url", isString) &&
    hasRequiredPropertyOfType(chapterObj, "name", isString) &&
    hasRequiredPropertyOfType(chapterObj, "mangaId", isString) &&
    hasRequiredPropertyOfType(chapterObj, "read", isBoolean) &&
    hasRequiredPropertyOfType(chapterObj, "bookmarked", isBoolean) &&
    hasOptionalPropertyOfType(chapterObj, "uploadDate", isNumber) &&
    hasOptionalPropertyOfType(chapterObj, "chapterNumber", isNumber) &&
    hasOptionalPropertyOfType(chapterObj, "scanlator", isString) &&
    hasOptionalPropertyOfType(chapterObj, "lastPageRead", isNumber) &&
    hasOptionalPropertyOfType(chapterObj, "lastReadAt", isNumber) &&
    hasOptionalPropertyOfType(chapterObj, "index", isNumber)
  );
}