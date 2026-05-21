/**
 * Foundation Utilities for Type Guards
 *
 * Extracted from: src/utils/type-guards/adapters/native-download-guards.ts (lines 1-500)
 * Created: 2025-11-23
 *
 * This module provides core type guard utilities for validating various data types
 * across the Native Download adapter ecosystem. These utilities form the foundation for
 * all type guard modules and ensure type safety throughout the application.
 *
 * @module TypeGuardUtils
 * @category TypeGuards
 * @subcategory NativeDownload
 */
import type {
  DownloadLink,
  NativeDownloadAdapterConfig,
  NativeDownloadAdapterInstanceConfig,
  NativeDownloadApiManga,
  NativeDownloadImage,
  NativeDownloadProviderConfig,
  NativeDownloadScrapedChapter,
  NativeDownloadScrapedManga,
  NativeDownloadSearchOptions,
  NativeDownloadSearchParams,
  SelectorConfig,
  Transform,
  WebsiteValidationResult
} from "@/types/adapters/native-download-types";
import type {
  SuwayomiCategory,
  SuwayomiChapter,
  SuwayomiConfig,
  SuwayomiDownload,
  SuwayomiExtension,
  SuwayomiManga,
  SuwayomiSource
} from "@/types/adapters/suwayomi";
// eslint-disable-next-line import/order -- ESLint incorrectly flags multi-line import blocks
import type { FieldSelection, FormData, MetadataField } from "@/types/addManga.types";

// =============================================================================
// VALIDATION HELPERS (reduces complexity of type guards)
// =============================================================================

type PropertyValidator = (obj: Record<string, unknown>) => boolean;

/**
 * Validates an object against an array of property validators
 * Reduces cyclomatic complexity by consolidating boolean checks
 */
function validateObject(obj: unknown, validators: PropertyValidator[]): boolean {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return validators.every(validator => validator(candidate));
}

/**
 * Creates a validator for a required property of a specific type
 */
function requiredProp(key: string, type: string): PropertyValidator {
  return (obj) => typeof obj[key] === type;
}

/**
 * Creates a validator for an optional property of a specific type
 */
function optionalProp(key: string, type: string): PropertyValidator {
  return (obj) => !(key in obj) || typeof obj[key] === type;
}

/**
 * Creates a validator for an optional array where all elements are strings
 */
function optionalStringArray(key: string): PropertyValidator {
  return (obj) => {
    if (!(key in obj)) return true;
    const value = obj[key];
    return Array.isArray(value) && value.every((x: unknown) => typeof x === "string");
  };
}

/**
 * Creates a validator for an optional array of any type
 */
function optionalArray(key: string): PropertyValidator {
  return (obj) => !(key in obj) || Array.isArray(obj[key]);
}

// =============================================================================
// SECTION 1: NATIVE DOWNLOAD ADAPTER TYPES
// =============================================================================

/**
 * Type guard for NativeDownloadImage
 * Validates that an object conforms to the NativeDownloadImage interface
 */
export function isNativeDownloadImage(obj: unknown): obj is NativeDownloadImage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["coverType"] === "string" &&
    typeof candidate["url"] === "string" &&
    (!("remoteUrl" in candidate) || typeof candidate["remoteUrl"] === "string")
  );
}

/**
 * Type guard for NativeDownloadAdapterConfig
 * Validates that an object conforms to the NativeDownloadAdapterConfig interface
 */
export function isNativeDownloadAdapterConfig(obj: unknown): obj is NativeDownloadAdapterConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["url"] === "string" &&
    typeof candidate["apiKey"] === "string" &&
    (!("rootFolder" in candidate) || typeof candidate["rootFolder"] === "string") &&
    (!("qualityProfile" in candidate) || typeof candidate["qualityProfile"] === "string") &&
    (!("metadataProfile" in candidate) || typeof candidate["metadataProfile"] === "string") &&
    (!("autoSearch" in candidate) || typeof candidate["autoSearch"] === "boolean") &&
    (!("autoMonitor" in candidate) || typeof candidate["autoMonitor"] === "boolean") &&
    (!("autoDownload" in candidate) || typeof candidate["autoDownload"] === "boolean")
  );
}

/**
 * Type guard for NativeDownloadApiManga
 * Validates that an object conforms to the NativeDownloadApiManga interface
 */
export function isNativeDownloadApiManga(obj: unknown): obj is NativeDownloadApiManga {
  return validateObject(obj, [
    // Required properties
    requiredProp("id", "number"),
    requiredProp("title", "string"),
    // Optional string properties
    optionalProp("sortTitle", "string"),
    optionalProp("status", "string"),
    optionalProp("overview", "string"),
    optionalProp("network", "string"),
    optionalProp("added", "string"),
    optionalProp("rootFolderPath", "string"),
    optionalProp("folderName", "string"),
    optionalProp("path", "string"),
    optionalProp("comicImage", "string"),
    optionalProp("publisher", "string"),
    // Optional number properties
    optionalProp("runtime", "number"),
    optionalProp("year", "number"),
    optionalProp("qualityProfileId", "number"),
    optionalProp("metadataProfileId", "number"),
    optionalProp("comicCount", "number"),
    optionalProp("volumeCount", "number"),
    optionalProp("issueCount", "number"),
    // Optional boolean properties
    optionalProp("monitored", "boolean"),
    // Optional array properties
    optionalStringArray("alternativeTitles"),
    optionalArray("images"),
  ]);
}

/**
 * Type guard for NativeDownloadAdapterInstanceConfig
 * Validates that an object conforms to the NativeDownloadAdapterInstanceConfig interface
 */
export function isNativeDownloadAdapterInstanceConfig(obj: unknown): obj is NativeDownloadAdapterInstanceConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string"
  );
}

/**
 * Type guard for NativeDownloadProviderConfig
 * Validates that an object conforms to the NativeDownloadProviderConfig interface
 */
export function isNativeDownloadProviderConfig(obj: unknown): obj is NativeDownloadProviderConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["baseUrl"] === "string" &&
    typeof candidate["searchUrl"] === "string" &&
    "selectors" in candidate &&
    (!("authentication" in candidate) || "authentication" in candidate) &&
    (!("rateLimit" in candidate) || typeof candidate["rateLimit"] === "number") &&
    (!("proxy" in candidate) || "proxy" in candidate) &&
    (!("headers" in candidate) || "headers" in candidate)
  );
}

/**
 * Type guard for SelectorConfig
 * Validates that an object conforms to the SelectorConfig interface
 */
export function isSelectorConfig(obj: unknown): obj is SelectorConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("container" in candidate) || typeof candidate["container"] === "string")
  );
}

/**
 * Type guard for NativeDownloadSearchOptions
 * Validates that an object conforms to the NativeDownloadSearchOptions interface
 */
export function isNativeDownloadSearchOptions(obj: unknown): obj is NativeDownloadSearchOptions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("query" in candidate) || typeof candidate["query"] === "string") &&
    (!("limit" in candidate) || typeof candidate["limit"] === "number") &&
    (!("offset" in candidate) || typeof candidate["offset"] === "number") &&
    (!("sortBy" in candidate) || "sortBy" in candidate) &&
    (!("filters" in candidate) || "filters" in candidate) &&
    (!("sourceIds" in candidate) || Array.isArray(candidate["sourceIds"]) && candidate["sourceIds"].every((x: unknown) => typeof x === "string")) &&
    (!("includeCover" in candidate) || typeof candidate["includeCover"] === "boolean")
  );
}

/**
 * Type guard for NativeDownloadScrapedManga
 * Validates that an object conforms to the NativeDownloadScrapedManga interface
 */
export function isNativeDownloadScrapedManga(obj: unknown): obj is NativeDownloadScrapedManga {
  return validateObject(obj, [
    // Required properties
    requiredProp("id", "string"),
    requiredProp("title", "string"),
    // Optional string properties
    optionalProp("coverUrl", "string"),
    optionalProp("description", "string"),
    optionalProp("status", "string"),
    optionalProp("url", "string"),
    // Optional number properties
    optionalProp("year", "number"),
    optionalProp("chapters", "number"),
    optionalProp("volumes", "number"),
    optionalProp("rating", "number"),
    // Optional string array properties
    optionalStringArray("alternativeTitles"),
    optionalStringArray("authors"),
    optionalStringArray("artists"),
    optionalStringArray("genres"),
    optionalStringArray("tags"),
  ]);
}

/**
 * Type guard for NativeDownloadScrapedChapter
 * Validates that an object conforms to the NativeDownloadScrapedChapter interface
 */
export function isNativeDownloadScrapedChapter(obj: unknown): obj is NativeDownloadScrapedChapter {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["mangaId"] === "string" &&
    typeof candidate["number"] === "number" &&
    (!("title" in candidate) || typeof candidate["title"] === "string") &&
    (!("volume" in candidate) || typeof candidate["volume"] === "number") &&
    (!("releaseDate" in candidate) || typeof candidate["releaseDate"] === "string") &&
    (!("url" in candidate) || typeof candidate["url"] === "string") &&
    (!("pages" in candidate) || typeof candidate["pages"] === "number") &&
    (!("uploadDate" in candidate) || typeof candidate["uploadDate"] === "string")
  );
}

/**
 * Type guard for DownloadLink
 * Validates that an object conforms to the DownloadLink interface
 */
export function isDownloadLink(obj: unknown): obj is DownloadLink {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["url"] === "string" &&
    typeof candidate["page"] === "number" &&
    (!("pageNumber" in candidate) || typeof candidate["pageNumber"] === "number") &&
    (!("quality" in candidate) || "quality" in candidate) &&
    (!("width" in candidate) || typeof candidate["width"] === "number") &&
    (!("height" in candidate) || typeof candidate["height"] === "number")
  );
}

/**
 * Type guard for WebsiteValidationResult
 * Validates that an object conforms to the WebsiteValidationResult interface
 */
export function isWebsiteValidationResult(obj: unknown): obj is WebsiteValidationResult {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["isValid"] === "boolean" &&
    (!("errors" in candidate) || Array.isArray(candidate["errors"]) && candidate["errors"].every((x: unknown) => typeof x === "string")) &&
    (!("warnings" in candidate) || Array.isArray(candidate["warnings"]) && candidate["warnings"].every((x: unknown) => typeof x === "string")) &&
    (!("suggestions" in candidate) || Array.isArray(candidate["suggestions"]) && candidate["suggestions"].every((x: unknown) => typeof x === "string")) &&
    (!("missingFields" in candidate) || Array.isArray(candidate["missingFields"]) && candidate["missingFields"].every((x: unknown) => typeof x === "string")) &&
    (!("capabilities" in candidate) || "capabilities" in candidate)
  );
}

/**
 * Type guard for NativeDownloadSearchParams
 * Validates that an object conforms to the NativeDownloadSearchParams interface
 */
export function isNativeDownloadSearchParams(obj: unknown): obj is NativeDownloadSearchParams {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["query"] === "string"
  );
}

/**
 * Type guard for Transform
 * Validates that an object conforms to the Transform interface
 */
export function isTransform(obj: unknown): obj is Transform {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    (!("params" in candidate) || "params" in candidate)
  );
}

// =============================================================================
// SECTION 2: SUWAYOMI TYPES
// =============================================================================

/**
 * Type guard for SuwayomiConfig
 * Validates that an object conforms to the SuwayomiConfig interface
 */
export function isSuwayomiConfig(obj: unknown): obj is SuwayomiConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["enabled"] === "boolean" &&
    typeof candidate["url"] === "string" &&
    (!("username" in candidate) || typeof candidate["username"] === "string") &&
    (!("password" in candidate) || typeof candidate["password"] === "string") &&
    (!("apiPath" in candidate) || typeof candidate["apiPath"] === "string") &&
    (!("downloadPath" in candidate) || typeof candidate["downloadPath"] === "string") &&
    (!("autoDownload" in candidate) || typeof candidate["autoDownload"] === "boolean") &&
    (!("apiKeySources" in candidate) || Array.isArray(candidate["apiKeySources"]) && candidate["apiKeySources"].every((x: unknown) => typeof x === "string"))
  );
}

/**
 * Type guard for SuwayomiManga
 * Validates that an object conforms to the SuwayomiManga interface
 */
export function isSuwayomiManga(obj: unknown): obj is SuwayomiManga {
  return validateObject(obj, [
    // Required properties
    requiredProp("id", "number"),
    requiredProp("sourceId", "string"),
    requiredProp("url", "string"),
    requiredProp("title", "string"),
    // Optional string properties
    optionalProp("artist", "string"),
    optionalProp("author", "string"),
    optionalProp("description", "string"),
    optionalProp("status", "string"),
    optionalProp("thumbnail", "string"),
    // Optional boolean properties
    optionalProp("inLibrary", "boolean"),
    optionalProp("initialized", "boolean"),
    // Optional string array properties
    optionalStringArray("genre"),
  ]);
}

/**
 * Type guard for SuwayomiChapter
 * Validates that an object conforms to the SuwayomiChapter interface
 */
export function isSuwayomiChapter(obj: unknown): obj is SuwayomiChapter {
  return validateObject(obj, [
    // Required properties
    requiredProp("id", "number"),
    requiredProp("mangaId", "number"),
    requiredProp("url", "string"),
    requiredProp("name", "string"),
    requiredProp("number", "number"),
    // Optional string properties
    optionalProp("scanlator", "string"),
    // Optional number properties
    optionalProp("uploadDate", "number"),
    optionalProp("lastPageRead", "number"),
    optionalProp("index", "number"),
    // Optional boolean properties
    optionalProp("read", "boolean"),
    optionalProp("downloaded", "boolean"),
    optionalProp("bookmarked", "boolean"),
  ]);
}

/**
 * Type guard for SuwayomiSource
 * Validates that an object conforms to the SuwayomiSource interface
 */
export function isSuwayomiSource(obj: unknown): obj is SuwayomiSource {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["lang"] === "string" &&
    (!("iconUrl" in candidate) || typeof candidate["iconUrl"] === "string") &&
    (!("supportsLatest" in candidate) || typeof candidate["supportsLatest"] === "boolean") &&
    (!("isConfigurable" in candidate) || typeof candidate["isConfigurable"] === "boolean") &&
    (!("isNsfw" in candidate) || typeof candidate["isNsfw"] === "boolean") &&
    (!("displayName" in candidate) || typeof candidate["displayName"] === "string")
  );
}

/**
 * Type guard for SuwayomiCategory
 * Validates that an object conforms to the SuwayomiCategory interface
 */
export function isSuwayomiCategory(obj: unknown): obj is SuwayomiCategory {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["order"] === "number" &&
    (!("default" in candidate) || typeof candidate["default"] === "boolean")
  );
}

/**
 * Type guard for SuwayomiDownload
 * Validates that an object conforms to the SuwayomiDownload interface
 */
export function isSuwayomiDownload(obj: unknown): obj is SuwayomiDownload {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["chapterId"] === "number" &&
    typeof candidate["mangaId"] === "number" &&
    "state" in candidate &&
    typeof candidate["progress"] === "number" &&
    typeof candidate["tries"] === "number"
  );
}

/**
 * Type guard for SuwayomiExtension
 * Validates that an object conforms to the SuwayomiExtension interface
 */
export function isSuwayomiExtension(obj: unknown): obj is SuwayomiExtension {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["apkName"] === "string" &&
    (!("iconUrl" in candidate) || typeof candidate["iconUrl"] === "string") &&
    typeof candidate["name"] === "string" &&
    typeof candidate["pkgName"] === "string" &&
    typeof candidate["versionName"] === "string" &&
    typeof candidate["versionCode"] === "number" &&
    typeof candidate["lang"] === "string" &&
    (!("isNsfw" in candidate) || typeof candidate["isNsfw"] === "boolean") &&
    (!("hasUpdate" in candidate) || typeof candidate["hasUpdate"] === "boolean") &&
    (!("isInstalled" in candidate) || typeof candidate["isInstalled"] === "boolean") &&
    (!("isObsolete" in candidate) || typeof candidate["isObsolete"] === "boolean")
  );
}

// =============================================================================
// SECTION 3: ADD MANGA TYPES
// =============================================================================

/**
 * Type guard for FormData
 * Validates that an object conforms to the FormData interface
 */
export function isFormData(obj: unknown): obj is FormData {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["title"] === "string" &&
    typeof candidate["source"] === "string" &&
    typeof candidate["sourceId"] === "string" &&
    (!("coverUrl" in candidate) || typeof candidate["coverUrl"] === "string") &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("genres" in candidate) || Array.isArray(candidate["genres"]) && candidate["genres"].every((x: unknown) => typeof x === "string")) &&
    (!("authors" in candidate) || Array.isArray(candidate["authors"]) && candidate["authors"].every((x: unknown) => typeof x === "string")) &&
    (!("alternativeTitles" in candidate) || Array.isArray(candidate["alternativeTitles"]) && candidate["alternativeTitles"].every((x: unknown) => typeof x === "string"))
  );
}

/**
 * Type guard for MetadataField
 * Validates that an object conforms to the MetadataField interface
 */
export function isMetadataField(obj: unknown): obj is MetadataField {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["name"] === "string" &&
    "value" in candidate &&
    typeof candidate["source"] === "string" &&
    (!("confidence" in candidate) || typeof candidate["confidence"] === "number")
  );
}

/**
 * Type guard for FieldSelection
 * Validates that an object conforms to the FieldSelection interface
 */
export function isFieldSelection(obj: unknown): obj is FieldSelection {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["field"] === "string" &&
    typeof candidate["source"] === "string" &&
    "value" in candidate
  );
}

// =============================================================================
// SECTION 4: API COMMON TYPES
// =============================================================================

import type {
  ApiError,
  ApiMetadata,
  PaginationMetadata,
  ApiConfig,
  ApiRequest
} from "@/types/api/common";

/**
 * Type guard for ApiError
 * Validates that an object conforms to the ApiError interface
 */
export function isApiError(obj: unknown): obj is ApiError {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["code"] === "string" &&
    typeof candidate["message"] === "string" &&
    (!("details" in candidate) || "details" in candidate) &&
    (!("statusCode" in candidate) || typeof candidate["statusCode"] === "number") &&
    (!("timestamp" in candidate) || typeof candidate["timestamp"] === "string")
  );
}

/**
 * Type guard for ApiMetadata
 * Validates that an object conforms to the ApiMetadata interface
 */
export function isApiMetadata(obj: unknown): obj is ApiMetadata {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["timestamp"] === "string" &&
    (!("requestId" in candidate) || typeof candidate["requestId"] === "string") &&
    (!("version" in candidate) || typeof candidate["version"] === "string") &&
    (!("pagination" in candidate) || "pagination" in candidate)
  );
}

/**
 * Type guard for PaginationMetadata
 * Validates that an object conforms to the PaginationMetadata interface
 */
export function isPaginationMetadata(obj: unknown): obj is PaginationMetadata {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["page"] === "number" &&
    typeof candidate["pageSize"] === "number" &&
    typeof candidate["totalPages"] === "number" &&
    typeof candidate["totalItems"] === "number" &&
    typeof candidate["hasNext"] === "boolean" &&
    typeof candidate["hasPrevious"] === "boolean"
  );
}

/**
 * Type guard for ApiConfig
 * Validates that an object conforms to the ApiConfig interface
 */
export function isApiConfig(obj: unknown): obj is ApiConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("baseUrl" in candidate) || typeof candidate["baseUrl"] === "string") &&
    (!("timeout" in candidate) || typeof candidate["timeout"] === "number") &&
    (!("retryAttempts" in candidate) || typeof candidate["retryAttempts"] === "number") &&
    (!("headers" in candidate) || "headers" in candidate) &&
    (!("rateLimit" in candidate) || "rateLimit" in candidate) &&
    (!("cache" in candidate) || "cache" in candidate)
  );
}

/**
 * Type guard for ApiRequest
 * Validates that an object conforms to the ApiRequest interface
 */
export function isApiRequest(obj: unknown): obj is ApiRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["method"] === "string" &&
    typeof candidate["path"] === "string" &&
    (!("query" in candidate) || "query" in candidate) &&
    (!("body" in candidate) || "body" in candidate) &&
    (!("headers" in candidate) || "headers" in candidate) &&
    (!("auth" in candidate) || "auth" in candidate)
  );
}