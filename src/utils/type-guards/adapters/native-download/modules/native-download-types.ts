/**
 * Kapowarr Types Type Guards
 *
 * This module contains type guards for validating Native Download-specific type objects,
 * ensuring type safety for Native download adapter configuration and data structures.
 *
 * @module KapowarrTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  MetadataSourceInfo,
  RateLimitConfig,
  AuthConfig,
  SelectorMapping,
  SearchResultSelectors,
  MangaDetailSelectors,
  ChapterListSelectors,
  DownloadLinkSelectors,
  DownloadServiceConfig,
  NativeDownloadMangaData,
  NativeDownloadChapterData,
  INativeDownloadAdapter
} from "@/types/adapters/native-download-types";

import {
  isObject,
  isString,
  isStringArray,
  hasOptionalPropertyOfType,
  hasRequiredPropertyOfType
} from "./shared-validators/basic-validators";

/**
 * Type guard for MetadataSourceInfo
 * Validates that an object conforms to the MetadataSourceInfo interface
 */
export function isMetadataSourceInfo(obj: unknown): obj is MetadataSourceInfo {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["type"] === "string" &&
    (!("version" in candidate) || typeof candidate["version"] === "string") &&
    (!("baseUrl" in candidate) || typeof candidate["baseUrl"] === "string") &&
    (!("supportedFeatures" in candidate) || Array.isArray(candidate["supportedFeatures"]) && candidate["supportedFeatures"].every((x: unknown) => typeof x === "string")) &&
    (!("isActive" in candidate) || typeof candidate["isActive"] === "boolean")
  );
}

/**
 * Type guard for RateLimitConfig
 * Validates that an object conforms to the RateLimitConfig interface
 */
export function isRateLimitConfig(obj: unknown): obj is RateLimitConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["maxRequests"] === "number" &&
    typeof candidate["windowMs"] === "number" &&
    (!("requestsPerSecond" in candidate) || typeof candidate["requestsPerSecond"] === "number") &&
    (!("requestsPerMinute" in candidate) || typeof candidate["requestsPerMinute"] === "number") &&
    (!("concurrentRequests" in candidate) || typeof candidate["concurrentRequests"] === "number")
  );
}

/**
 * Type guard for AuthConfig
 * Validates that an object conforms to the AuthConfig interface
 */
export function isAuthConfig(obj: unknown): obj is AuthConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    (!("credentials" in candidate) || "credentials" in candidate)
  );
}

/**
 * Type guard for SelectorMapping
 * Validates that an object conforms to the SelectorMapping interface
 */
export function isSelectorMapping(obj: unknown): obj is SelectorMapping {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "searchResults" in candidate &&
    "mangaDetails" in candidate &&
    "chapterList" in candidate &&
    "downloadLinks" in candidate
  );
}

/**
 * Type guard for SearchResultSelectors
 * Validates that an object conforms to the SearchResultSelectors interface
 */
export function isSearchResultSelectors(obj: unknown): obj is SearchResultSelectors {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["container"] === "string" &&
    "id" in candidate &&
    "title" in candidate &&
    "coverUrl" in candidate &&
    "url" in candidate &&
    (!("metadata" in candidate) || "metadata" in candidate)
  );
}

/**
 * Type guard for MangaDetailSelectors
 * Validates that an object conforms to the MangaDetailSelectors interface
 */
export function isMangaDetailSelectors(obj: unknown): obj is MangaDetailSelectors {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "title" in candidate &&
    (!("alternativeTitles" in candidate) || "alternativeTitles" in candidate) &&
    (!("description" in candidate) || "description" in candidate) &&
    (!("coverUrl" in candidate) || "coverUrl" in candidate) &&
    (!("status" in candidate) || "status" in candidate) &&
    (!("authors" in candidate) || "authors" in candidate) &&
    (!("genres" in candidate) || "genres" in candidate) &&
    (!("tags" in candidate) || "tags" in candidate)
  );
}

/**
 * Type guard for ChapterListSelectors
 * Validates that an object conforms to the ChapterListSelectors interface
 */
export function isChapterListSelectors(obj: unknown): obj is ChapterListSelectors {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["container"] === "string" &&
    "chapterId" in candidate &&
    "chapterNumber" in candidate &&
    "chapterTitle" in candidate &&
    "chapterUrl" in candidate &&
    (!("uploadDate" in candidate) || "uploadDate" in candidate)
  );
}

/**
 * Type guard for DownloadLinkSelectors
 * Validates that an object conforms to the DownloadLinkSelectors interface
 */
export function isDownloadLinkSelectors(obj: unknown): obj is DownloadLinkSelectors {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["imageContainer"] === "string" &&
    "imageUrl" in candidate &&
    (!("pageNumber" in candidate) || "pageNumber" in candidate) &&
    (!("nextPageUrl" in candidate) || "nextPageUrl" in candidate)
  );
}

/**
 * Type guard for DownloadServiceConfig
 * Validates that an object conforms to the DownloadServiceConfig interface
 */
export function isDownloadServiceConfig(obj: unknown): obj is DownloadServiceConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    (!("config" in candidate) || "config" in candidate)
  );
}

/**
 * Validates required string fields for NativeDownloadMangaData
 */
function hasNativeDownloadMangaRequiredFields(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasRequiredPropertyOfType(candidate, "id", isString) &&
    hasRequiredPropertyOfType(candidate, "title", isString) &&
    hasRequiredPropertyOfType(candidate, "source", isString) &&
    hasRequiredPropertyOfType(candidate, "sourceUrl", isString)
  );
}

/**
 * Validates optional string fields for NativeDownloadMangaData
 */
function hasNativeDownloadMangaOptionalStrings(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasOptionalPropertyOfType(candidate, "description", isString) &&
    hasOptionalPropertyOfType(candidate, "coverUrl", isString) &&
    hasOptionalPropertyOfType(candidate, "status", isString)
  );
}

/**
 * Validates optional string array fields for NativeDownloadMangaData
 */
function hasNativeDownloadMangaOptionalArrays(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasOptionalPropertyOfType(candidate, "alternativeTitles", isStringArray) &&
    hasOptionalPropertyOfType(candidate, "authors", isStringArray) &&
    hasOptionalPropertyOfType(candidate, "genres", isStringArray) &&
    hasOptionalPropertyOfType(candidate, "tags", isStringArray) &&
    hasOptionalPropertyOfType(candidate, "chapters", Array.isArray)
  );
}

/**
 * Type guard for NativeDownloadMangaData
 * Validates that an object conforms to the NativeDownloadMangaData interface
 */
export function isNativeDownloadMangaData(obj: unknown): obj is NativeDownloadMangaData {
  if (!isObject(obj)) {
    return false;
  }

  return (
    hasNativeDownloadMangaRequiredFields(obj) &&
    hasNativeDownloadMangaOptionalStrings(obj) &&
    hasNativeDownloadMangaOptionalArrays(obj)
  );
}

/**
 * Type guard for NativeDownloadChapterData
 * Validates that an object conforms to the NativeDownloadChapterData interface
 */
export function isNativeDownloadChapterData(obj: unknown): obj is NativeDownloadChapterData {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["number"] === "number" &&
    (!("title" in candidate) || typeof candidate["title"] === "string") &&
    typeof candidate["url"] === "string" &&
    (!("uploadDate" in candidate) || candidate["uploadDate"] instanceof Date) &&
    (!("pages" in candidate) || Array.isArray(candidate["pages"]) && candidate["pages"].every((x: unknown) => typeof x === "string"))
  );
}

/**
 * Type guard for INativeDownloadAdapter
 * Validates that an object conforms to the INativeDownloadAdapter interface
 */
export function isINativeDownloadAdapter(obj: unknown): obj is INativeDownloadAdapter {
  return typeof obj === "object" && obj !== null;
}