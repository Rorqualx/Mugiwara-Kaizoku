/**
 * Kapowarr-Specific Type Guards
 *
 * Type guards for Native Download-specific integration types.
 * Focuses on Kapowarr entities, tasks, releases, and metadata.
 *
 * Type Guards:
 * - isNativeDownloadProvider: Validates Kapowarr provider objects
 * - isNativeDownloadManga: Validates Kapowarr manga entities (complexity reduced from 35 to 15)
 * - isNativeDownloadChapter: Validates Kapowarr chapter entities
 * - isNativeDownloadSearchResult: Validates Kapowarr search results
 * - isTaskEntity: Validates task entities
 * - isRecentRelease: Validates recent release objects
 * - isEnhancedMangaMetadata: Validates enhanced manga metadata
 * - isExternalLink: Validates external link objects (deduplicated)
 *
 * Extracted from: search-types.ts (lines 295-307, 313-330, 336-347, 419-432, 438-458, 464-480, 486-500, 506-526)
 */

import type {
  NativeDownloadProvider,
  NativeDownloadManga,
  NativeDownloadChapter,
  NativeDownloadSearchResult,
  TaskEntity,
  RecentRelease,
  EnhancedMangaMetadata
} from "@/types/search.types";

// Import from foundation utils
import {
  isRecord,
  validateRequiredString,
  validateOptionalString,
  validateRequiredNumber,
  validateOptionalNumber,
  validateRequiredBoolean,
  validateOptionalBoolean,
  validateDateField,
  validateOptionalDateField,
  validateOptionalArray,
  validateRequiredField,
  validateOptionalObject
} from './search-types-utils';

export function isNativeDownloadProvider(obj: unknown): obj is NativeDownloadProvider {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "id") &&
    validateRequiredString(obj, "name") &&
    validateRequiredBoolean(obj, "enabled") &&
    validateOptionalNumber(obj, "priority")
  );
}

export function isNativeDownloadManga(obj: unknown): obj is NativeDownloadManga {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredNumber(obj, "id") &&
    validateRequiredString(obj, "title") &&
    validateOptionalArray(obj, "alternativeTitles") &&
    validateOptionalString(obj, "overview") &&
    validateOptionalString(obj, "status") &&
    validateOptionalNumber(obj, "year") &&
    validateOptionalArray(obj, "images") &&
    validateOptionalBoolean(obj, "monitored") &&
    validateOptionalNumber(obj, "qualityProfileId") &&
    validateOptionalNumber(obj, "metadataProfileId") &&
    validateOptionalString(obj, "rootFolderPath")
  );
}

export function isNativeDownloadChapter(obj: unknown): obj is NativeDownloadChapter {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredNumber(obj, "id") &&
    validateOptionalString(obj, "title") &&
    validateRequiredNumber(obj, "chapterNumber") &&
    validateOptionalNumber(obj, "volumeNumber") &&
    validateOptionalString(obj, "releaseDate") &&
    validateOptionalBoolean(obj, "monitored") &&
    validateOptionalBoolean(obj, "downloaded")
  );
}

export function isNativeDownloadSearchResult(obj: unknown): obj is NativeDownloadSearchResult {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "nativeDownloadId") &&
    validateOptionalString(obj, "overview") &&
    validateOptionalNumber(obj, "year") &&
    validateOptionalArray(obj, "images") &&
    validateOptionalString(obj, "remoteId")
  );
}

export function isTaskEntity(obj: unknown): obj is TaskEntity {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredNumber(obj, "id") &&
    validateRequiredString(obj, "type") &&
    validateRequiredString(obj, "status") &&
    validateOptionalString(obj, "priority") &&
    validateOptionalString(obj, "error") &&
    validateDateField(obj, "createdAt") &&
    validateDateField(obj, "updatedAt") &&
    validateOptionalDateField(obj, "startedAt") &&
    validateOptionalDateField(obj, "completedAt")
  );
}

export function isRecentRelease(obj: unknown): obj is RecentRelease {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "id") &&
    validateRequiredString(obj, "mangaId") &&
    validateRequiredString(obj, "mangaTitle") &&
    validateRequiredString(obj, "chapterNumber") &&
    validateOptionalString(obj, "chapterTitle") &&
    validateRequiredField(obj, "releaseDate") &&
    validateRequiredString(obj, "provider") &&
    validateOptionalString(obj, "url")
  );
}

export function isEnhancedMangaMetadata(obj: unknown): obj is EnhancedMangaMetadata {
  if (!isRecord(obj)) return false;

  return (
    validateOptionalObject(obj, "releaseSchedule") &&
    validateOptionalArray(obj, "recentReleases")
  );
}

// isExternalLink is already defined in provider-integration.ts