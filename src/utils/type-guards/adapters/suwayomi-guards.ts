/**
 * Suwayomi Adapter Type Guards
 *
 * Type guards for Suwayomi adapter types and API responses
 */

import type {
  SuwayomiConfig,
  SuwayomiManga,
  SuwayomiChapter,
  SuwayomiSource,
  SuwayomiCategory,
  SuwayomiDownload,
  SuwayomiExtension
} from "@/types/adapters/suwayomi";

/**
 * Check if a value is a SuwayomiConfig
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
 * Validate required SuwayomiManga fields
 */
function validateSuwayomiMangaRequired(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["sourceId"] === "string" &&
    typeof candidate["url"] === "string" &&
    typeof candidate["title"] === "string"
  );
}

/**
 * Validate optional string fields for SuwayomiManga
 */
function validateSuwayomiMangaStrings(candidate: Record<string, unknown>): boolean {
  return (
    (!("artist" in candidate) || typeof candidate["artist"] === "string") &&
    (!("author" in candidate) || typeof candidate["author"] === "string") &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("status" in candidate) || typeof candidate["status"] === "string") &&
    (!("thumbnail" in candidate) || typeof candidate["thumbnail"] === "string")
  );
}

/**
 * Validate optional array/boolean fields for SuwayomiManga
 */
function validateSuwayomiMangaOthers(candidate: Record<string, unknown>): boolean {
  return (
    (!("genre" in candidate) || Array.isArray(candidate["genre"]) && candidate["genre"].every((x: unknown) => typeof x === "string")) &&
    (!("inLibrary" in candidate) || typeof candidate["inLibrary"] === "boolean") &&
    (!("initialized" in candidate) || typeof candidate["initialized"] === "boolean")
  );
}

/**
 * Check if a value is a SuwayomiManga
 */
export function isSuwayomiManga(obj: unknown): obj is SuwayomiManga {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateSuwayomiMangaRequired(candidate) &&
    validateSuwayomiMangaStrings(candidate) &&
    validateSuwayomiMangaOthers(candidate)
  );
}

/**
 * Validate required SuwayomiChapter fields
 */
function validateSuwayomiChapterRequired(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["mangaId"] === "number" &&
    typeof candidate["url"] === "string" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["number"] === "number"
  );
}

/**
 * Validate optional number fields for SuwayomiChapter
 */
function validateSuwayomiChapterNumbers(candidate: Record<string, unknown>): boolean {
  return (
    (!("uploadDate" in candidate) || typeof candidate["uploadDate"] === "number") &&
    (!("lastPageRead" in candidate) || typeof candidate["lastPageRead"] === "number") &&
    (!("index" in candidate) || typeof candidate["index"] === "number")
  );
}

/**
 * Validate optional boolean/string fields for SuwayomiChapter
 */
function validateSuwayomiChapterOthers(candidate: Record<string, unknown>): boolean {
  return (
    (!("scanlator" in candidate) || typeof candidate["scanlator"] === "string") &&
    (!("read" in candidate) || typeof candidate["read"] === "boolean") &&
    (!("downloaded" in candidate) || typeof candidate["downloaded"] === "boolean") &&
    (!("bookmarked" in candidate) || typeof candidate["bookmarked"] === "boolean")
  );
}

/**
 * Check if a value is a SuwayomiChapter
 */
export function isSuwayomiChapter(obj: unknown): obj is SuwayomiChapter {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateSuwayomiChapterRequired(candidate) &&
    validateSuwayomiChapterNumbers(candidate) &&
    validateSuwayomiChapterOthers(candidate)
  );
}

/**
 * Check if a value is a SuwayomiSource
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
 * Check if a value is a SuwayomiCategory
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
 * Check if a value is a SuwayomiDownload
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
 * Check if a value is a SuwayomiExtension
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