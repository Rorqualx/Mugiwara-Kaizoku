/**
 * Manga Views Type Guards
 *
 * This module contains type guards for validating manga view type objects,
 * ensuring type safety for manga display and presentation across different UI contexts.
 *
 * @module MangaViewsTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  MangaListView,
  MangaDetailView,
  MangaCardView,
  MangaOptionView,
  MangaFormData,
  MangaSearchResult
} from "@/types/manga/views";

// Helper functions for validation decomposition

/**
 * Validates that a property exists and is of the expected type
 */
function validateRequiredString(candidate: Record<string, unknown>, property: string): boolean {
  return typeof candidate[property] === "string";
}

/**
 * Validates that a property exists and is of the expected type, or is optional
 */
function validateOptionalString(candidate: Record<string, unknown>, property: string): boolean {
  return !(property in candidate) || typeof candidate[property] === "string";
}

/**
 * Validates that a property exists and is a number, or is optional
 */
function validateOptionalNumber(candidate: Record<string, unknown>, property: string): boolean {
  return !(property in candidate) || typeof candidate[property] === "number";
}

/**
 * Validates that a property exists and is a boolean, or is optional
 */
function validateOptionalBoolean(candidate: Record<string, unknown>, property: string): boolean {
  return !(property in candidate) || typeof candidate[property] === "boolean";
}

/**
 * Validates that a property exists and is an array of strings, or is optional
 */
function validateOptionalStringArray(candidate: Record<string, unknown>, property: string): boolean {
  if (!(property in candidate)) {
    return true;
  }
  const value = candidate[property];
  return Array.isArray(value) && value.every((x: unknown) => typeof x === "string");
}

/**
 * Validates that a property exists (presence only), or is optional
 */
function validateOptionalProperty(candidate: Record<string, unknown>, property: string): boolean {
  return !(property in candidate) || property in candidate;
}

/**
 * Validates the core required fields for MangaFormData
 */
function validateMangaFormDataCore(candidate: Record<string, unknown>): boolean {
  return (
    validateRequiredString(candidate, "title") &&
    validateRequiredString(candidate, "source") &&
    typeof candidate["libraryId"] === "number"
  );
}

/**
 * Validates the optional fields for MangaFormData
 */
function validateMangaFormDataOptional(candidate: Record<string, unknown>): boolean {
  return (
    validateOptionalString(candidate, "displayTitle") &&
    validateOptionalString(candidate, "description") &&
    validateOptionalString(candidate, "summary") &&
    validateOptionalString(candidate, "sourceId") &&
    validateOptionalString(candidate, "sourceUrl") &&
    validateOptionalString(candidate, "searchProvider") &&
    validateOptionalStringArray(candidate, "genres") &&
    validateOptionalStringArray(candidate, "tags") &&
    validateOptionalStringArray(candidate, "alternativeTitles") &&
    validateOptionalProperty(candidate, "authors") &&
    validateOptionalProperty(candidate, "artists") &&
    validateOptionalString(candidate, "coverUrl") &&
    validateOptionalString(candidate, "thumbnailUrl") &&
    validateOptionalNumber(candidate, "releaseYear") &&
    validateOptionalProperty(candidate, "publicationStatus") &&
    validateOptionalProperty(candidate, "libraryStatus")
  );
}

/**
 * Validates the core required fields for MangaSearchResult
 */
function validateMangaSearchResultCore(candidate: Record<string, unknown>): boolean {
  return (
    "id" in candidate &&
    validateRequiredString(candidate, "title") &&
    validateRequiredString(candidate, "source") &&
    validateRequiredString(candidate, "sourceId")
  );
}

/**
 * Validates the optional fields for MangaSearchResult
 */
function validateMangaSearchResultOptional(candidate: Record<string, unknown>): boolean {
  return (
    validateOptionalStringArray(candidate, "alternativeTitles") &&
    validateOptionalString(candidate, "description") &&
    validateOptionalString(candidate, "coverUrl") &&
    validateOptionalStringArray(candidate, "authors") &&
    validateOptionalStringArray(candidate, "genres") &&
    validateOptionalNumber(candidate, "year") &&
    validateOptionalNumber(candidate, "score") &&
    validateOptionalBoolean(candidate, "isInLibrary")
  );
}

/**
 * Type guard for MangaListView
 * Validates that an object conforms to the MangaListView interface
 */
export function isMangaListView(obj: unknown): obj is MangaListView {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["title"] === "string" &&
    "displayTitle" in candidate &&
    "coverUrl" in candidate &&
    "thumbnailUrl" in candidate &&
    typeof candidate["chapterCount"] === "number" &&
    typeof candidate["unreadCount"] === "number" &&
    "publicationStatus" in candidate &&
    "libraryStatus" in candidate &&
    candidate["lastUpdatedAt"] instanceof Date &&
    typeof candidate["hasNewChapters"] === "boolean"
  );
}

/**
 * Type guard for MangaDetailView
 * Validates that an object conforms to the MangaDetailView interface
 */
export function isMangaDetailView(obj: unknown): obj is MangaDetailView {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "description" in candidate &&
    "summary" in candidate &&
    "authors" in candidate &&
    "artists" in candidate &&
    Array.isArray(candidate["genres"]) && candidate["genres"].every((x: unknown) => typeof x === "string") &&
    Array.isArray(candidate["tags"]) && candidate["tags"].every((x: unknown) => typeof x === "string") &&
    Array.isArray(candidate["alternativeTitles"]) && candidate["alternativeTitles"].every((x: unknown) => typeof x === "string") &&
    "score" in candidate &&
    "popularity" in candidate &&
    "releaseYear" in candidate &&
    typeof candidate["source"] === "string" &&
    "sourceUrl" in candidate &&
    "fileStatus" in candidate &&
    "lastSyncAt" in candidate &&
    "errorMessage" in candidate
  );
}

/**
 * Type guard for MangaCardView
 * Validates that an object conforms to the MangaCardView interface
 */
export function isMangaCardView(obj: unknown): obj is MangaCardView {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["title"] === "string" &&
    "displayTitle" in candidate &&
    "coverUrl" in candidate &&
    "thumbnailUrl" in candidate &&
    "latestChapterNumber" in candidate &&
    "latestChapterTitle" in candidate &&
    typeof candidate["unreadCount"] === "number" &&
    typeof candidate["isUpdated"] === "boolean" &&
    "publicationStatus" in candidate
  );
}

/**
 * Type guard for MangaOptionView
 * Validates that an object conforms to the MangaOptionView interface
 */
export function isMangaOptionView(obj: unknown): obj is MangaOptionView {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["title"] === "string" &&
    "displayTitle" in candidate &&
    typeof candidate["source"] === "string"
  );
}

/**
 * Type guard for MangaFormData
 * Validates that an object conforms to the MangaFormData interface
 */
export function isMangaFormData(obj: unknown): obj is MangaFormData {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateMangaFormDataCore(candidate) &&
    validateMangaFormDataOptional(candidate)
  );
}

/**
 * Type guard for MangaSearchResult
 * Validates that an object conforms to the MangaSearchResult interface
 */
export function isMangaSearchResult(obj: unknown): obj is MangaSearchResult {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateMangaSearchResultCore(candidate) &&
    validateMangaSearchResultOptional(candidate)
  );
}
