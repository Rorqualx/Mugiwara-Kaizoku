/**
 * Domain Type Guards
 *
 * This module provides type guard functions for domain entities.
 * These functions allow runtime type checking of domain objects.
 *
 * Enhanced with additional helpers for handling common domain entity validation
 * scenarios, safe type checking, and ensuring consistent error handling.
 */


import {
  MangaPublicationStatus as MangaStatus,
  ChapterStatus,
  MangaFileStatus,
  MangaLibraryStatus
} from '@prisma/client';

import type { ID } from '@/types/common';
import type { MangaMetadata, MangaSearchResult } from '@/types/search-types/core-search.types';
import type { ExternalLink } from '@/types/search-types/enums.types';
import type { ProviderMetadata } from '@/types/search-types/provider.types';
import {
  isObject,
  isString,
  isNumber,
  isBoolean,
  isDate,
  isArrayOf,
  isEnum,
  hasProperty,
  hasPropertyOfType} from '@/utils/type-guards';


import type { Manga as MangaEntity } from '@prisma/client';
import type { Chapter as ChapterEntity } from '@prisma/client';

// Define missing types locally (unused, kept for reference)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type MangaProcessingStatusUnused = {
  isProcessing: boolean;
  lastProcessed?: Date;
};

interface MonitoringConfig {
  isMonitored: boolean;
  interval?: 'daily' | 'weekly' | 'monthly' | 'custom';
  customIntervalDays?: number;
  notifyOnNew?: boolean;
  autoDownload?: boolean;
  qualityPreference?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CreateMangaInputUnused = {
  title: string;
  status?: string;
  metadata?: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type UpdateMangaInputUnused = {
  title?: string;
  status?: string;
  metadata?: unknown;
};

interface ChapterFile {
  fileName: string;
  size: number;
  path?: string;
  pageCount?: number;
  resolution?: Resolution;
  format?: string;
}

interface Resolution {
  width?: number;
  height?: number;
  label?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ChapterWithMetadataUnused = {
  id: string;
  number: number;
  metadata?: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CreateChapterInputUnused = {
  mangaId: string;
  number: number;
  title?: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type UpdateChapterInputUnused = {
  title?: string;
  status?: string;
};

/**
 * Type guard for MangaStatus enum values
 *
 * @param value - Value to check
 * @returns Whether the value is a valid MangaStatus
 */
export function isMangaStatus(value: unknown): value is MangaStatus {
  return isEnum(value, MangaStatus);
}

/**
 * Type guard for ChapterStatus enum values
 *
 * @param value - Value to check
 * @returns Whether the value is a valid ChapterStatus
 */
export function isChapterStatus(value: unknown): value is ChapterStatus {
  return isEnum(value, ChapterStatus);
}

/**
 * Type guard for MangaFileStatus enum values
 *
 * @param value - Value to check
 * @returns Whether the value is a valid MangaFileStatus
 */
export function isMangaFileStatus(value: unknown): value is MangaFileStatus {
  return isEnum(value, MangaFileStatus);
}

/**
 * Type guard for MangaLibraryStatus enum values
 *
 * @param value - Value to check
 * @returns Whether the value is a valid MangaLibraryStatus
 */
export function isMangaLibraryStatus(value: unknown): value is MangaLibraryStatus {
  return isEnum(value, MangaLibraryStatus);
}

/**
 * Type guard for ExternalLink
 *
 * @param value - Value to check
 * @returns Whether the value is a valid ExternalLink
 */
export function isExternalLink(value: unknown): value is ExternalLink {
  return (
    isObject(value) &&
    hasPropertyOfType(value, 'url', isString) &&
    hasPropertyOfType(value, 'site', isString) &&
    (!hasProperty(value, 'label') || hasPropertyOfType(value, 'label', isString))
  );
}

/**
 * Type guard for ID
 *
 * @param value - Value to check
 * @returns Whether the value is a valid ID
 */
export function isID(value: unknown): value is ID {
  return isString(value) || isNumber(value);
}

/**
 * Validates that an optional property is of the correct type
 *
 * @param obj - The object containing the property
 * @param key - The property key to validate
 * @param validator - Type guard function to validate the property value
 * @returns Whether the property is valid (doesn't exist, or exists with correct type)
 */
function validateOptionalProperty<T>(
  obj: Record<string, unknown>,
  key: string,
  validator: (value: unknown) => value is T
): boolean {
  return !hasProperty(obj, key) || validator(obj[key]);
}

/**
 * Validates nested metadata object properties
 *
 * @param metadata - The metadata object to validate
 * @returns Whether all metadata properties are valid
 */
function validateMetadataProperties(metadata: Record<string, unknown>): boolean {
  return (
    validateOptionalProperty(metadata, 'title', isString) &&
    validateOptionalProperty(metadata, 'description', isString) &&
    validateOptionalProperty(metadata, 'status', isMangaStatus) &&
    validateOptionalProperty(metadata, 'genres', (v): v is string[] => isArrayOf(v, isString))
  );
}

/**
 * Type guard for MangaMetadata
 *
 * @param value - Value to check
 * @returns Whether the value is a valid MangaMetadata
 */
export function isMangaMetadata(value: unknown): value is MangaMetadata {
  if (!isObject(value)) {
    return false;
  }

  // Check required properties
  if (!hasPropertyOfType(value, 'title', isString)) {
    return false;
  }

  // Check optional properties
  const obj = value as Record<string, unknown>;

  return (
    validateOptionalProperty(obj, 'alternativeTitles', (v): v is string[] => isArrayOf(v, isString)) &&
    validateOptionalProperty(obj, 'description', isString) &&
    validateOptionalProperty(obj, 'coverUrl', isString) &&
    validateOptionalProperty(obj, 'coverThumbnail', isString) &&
    validateOptionalProperty(obj, 'status', isMangaStatus) &&
    validateOptionalProperty(obj, 'chapters', isNumber) &&
    validateOptionalProperty(obj, 'volumes', isNumber) &&
    validateOptionalProperty(obj, 'authors', (v): v is string[] => isArrayOf(v, isString)) &&
    validateOptionalProperty(obj, 'artists', (v): v is string[] => isArrayOf(v, isString)) &&
    validateOptionalProperty(obj, 'genres', (v): v is string[] => isArrayOf(v, isString)) &&
    validateOptionalProperty(obj, 'tags', (v): v is string[] => isArrayOf(v, isString)) &&
    validateOptionalProperty(obj, 'releaseYear', isNumber) &&
    validateOptionalProperty(obj, 'publisher', isString) &&
    validateOptionalProperty(obj, 'language', isString) &&
    validateOptionalProperty(obj, 'links', (v): v is ExternalLink[] => isArrayOf(v, isExternalLink)) &&
    validateOptionalProperty(obj, 'rating', isNumber) &&
    validateOptionalProperty(obj, 'isNsfw', isBoolean)
  );
}

/**
 * Type guard for ProviderMetadata
 *
 * @param value - Value to check
 * @returns Whether the value is a valid ProviderMetadata
 */
export function isProviderMetadata(value: unknown): value is ProviderMetadata {
  return (
    isObject(value) &&
    hasPropertyOfType(value, 'providerId', isString) &&
    hasPropertyOfType(value, 'metadata', isObject) &&
    (!hasProperty(value, 'externalId') || hasPropertyOfType(value, 'externalId', isString)) &&
    (!hasProperty(value, 'url') || hasPropertyOfType(value, 'url', isString))
  );
}

/**
 * Type guard for MonitoringConfig
 *
 * @param value - Value to check
 * @returns Whether the value is a valid MonitoringConfig
 */
export function isMonitoringConfig(value: unknown): value is MonitoringConfig {
  if (!isObject(value)) {
    return false;
  }

  if (!hasPropertyOfType(value, 'isMonitored', isBoolean)) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (hasProperty(value, 'interval')) {
    const interval = obj['interval'];
    if (interval !== 'daily' && interval !== 'weekly' && interval !== 'monthly' && interval !== 'custom') {
      return false;
    }
  }

  if (hasProperty(value, 'customIntervalDays') && !isNumber(obj['customIntervalDays'])) {
    return false;
  }

  if (hasProperty(value, 'notifyOnNew') && !isBoolean(obj['notifyOnNew'])) {
    return false;
  }

  if (hasProperty(value, 'autoDownload') && !isBoolean(obj['autoDownload'])) {
    return false;
  }

  if (hasProperty(value, 'qualityPreference') && !isString(obj['qualityPreference'])) {
    return false;
  }

  return true;
}

/**
 * Type guard for Resolution
 *
 * @param value - Value to check
 * @returns Whether the value is a valid Resolution
 */
export function isResolution(value: unknown): value is Resolution {
  if (!isObject(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (hasProperty(value, 'width') && !isNumber(obj['width'])) {
    return false;
  }

  if (hasProperty(value, 'height') && !isNumber(obj['height'])) {
    return false;
  }

  if (hasProperty(value, 'label') && !isString(obj['label'])) {
    return false;
  }

  return true;
}

/**
 * Type guard for ChapterFile
 *
 * @param value - Value to check
 * @returns Whether the value is a valid ChapterFile
 */
export function isChapterFile(value: unknown): value is ChapterFile {
  if (!isObject(value)) {
    return false;
  }

  if (!hasPropertyOfType(value, 'fileName', isString)) {
    return false;
  }

  if (!hasPropertyOfType(value, 'size', isNumber)) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (hasProperty(value, 'path') && !isString(obj['path'])) {
    return false;
  }

  if (hasProperty(value, 'pageCount') && !isNumber(obj['pageCount'])) {
    return false;
  }

  if (hasProperty(value, 'resolution') && !isResolution(obj['resolution'])) {
    return false;
  }

  if (hasProperty(value, 'format') && !isString(obj['format'])) {
    return false;
  }

  return true;
}

/**
 * Validates required fields for MangaEntity
 *
 * @param value - The object to validate
 * @returns Whether all required fields are valid
 */
function validateMangaRequiredFields(value: Record<string, unknown>): boolean {
  return (
    hasPropertyOfType(value, 'id', isNumber) &&
    hasPropertyOfType(value, 'title', isString) &&
    hasPropertyOfType(value, 'source', isString) &&
    hasPropertyOfType(value, 'libraryId', isNumber) &&
    hasPropertyOfType(value, 'createdAt', (v: unknown): v is Date | string =>
      isDate(v) || isString(v)) &&
    hasPropertyOfType(value, 'updatedAt', (v: unknown): v is Date | string =>
      isDate(v) || isString(v)) &&
    hasPropertyOfType(value, 'publicationStatus', isMangaStatus) &&
    hasPropertyOfType(value, 'fileStatus', isMangaFileStatus) &&
    hasPropertyOfType(value, 'libraryStatus', isMangaLibraryStatus) &&
    hasPropertyOfType(value, 'searchProvider', isString) &&
    hasPropertyOfType(value, 'syncCount', isNumber)
  );
}

/**
 * Validates optional fields for MangaEntity
 *
 * @param obj - The object to validate
 * @returns Whether all optional fields are valid (if present)
 */
function validateMangaOptionalFields(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalProperty(obj, 'metadataId', isNumber) &&
    validateOptionalProperty(obj, 'lastChecked', (v): v is Date | string => isDate(v) || isString(v)) &&
    validateOptionalProperty(obj, 'libraryPath', isString) &&
    validateOptionalProperty(obj, 'mangaTitle', isString) &&
    validateOptionalProperty(obj, 'errorMessage', isString) &&
    validateOptionalProperty(obj, 'lastErrorAt', (v): v is Date | string => isDate(v) || isString(v)) &&
    validateOptionalProperty(obj, 'lastSyncAt', (v): v is Date | string => isDate(v) || isString(v)) &&
    validateOptionalProperty(obj, 'summary', isString) &&
    validateOptionalProperty(obj, 'providerMetadata', isObject) &&
    validateOptionalProperty(obj, 'monitoringConfig', isObject) &&
    validateOptionalProperty(obj, 'metadataConfidence', isNumber) &&
    validateOptionalProperty(obj, 'mlCorrected', isBoolean) &&
    validateOptionalProperty(obj, 'rawProviderData', isObject) &&
    validateOptionalProperty(obj, 'selectedSourceId', isString) &&
    validateOptionalProperty(obj, 'sourceId', isString)
  );
}

/**
 * Type guard for MangaEntity
 * Validates against the Prisma Manga model schema (lines 143-189)
 *
 * @param value - Value to check
 * @returns Whether the value is a valid MangaEntity
 */
export function isMangaEntity(value: unknown): value is MangaEntity {
  if (!isObject(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return validateMangaRequiredFields(obj) && validateMangaOptionalFields(obj);
}

/**
 * Validates required fields for ChapterEntity
 *
 * @param value - The object to validate
 * @returns Whether all required fields are valid
 */
function validateChapterRequiredFields(value: Record<string, unknown>): boolean {
  return (
    hasPropertyOfType(value, 'id', isNumber) &&
    hasPropertyOfType(value, 'fileName', isString) &&
    hasPropertyOfType(value, 'index', isNumber) &&
    hasPropertyOfType(value, 'size', isNumber) &&
    hasPropertyOfType(value, 'mangaId', isNumber) &&
    hasPropertyOfType(value, 'title', isString) &&
    hasPropertyOfType(value, 'createdAt', (v: unknown): v is Date | string =>
      isDate(v) || isString(v)) &&
    hasPropertyOfType(value, 'updatedAt', (v: unknown): v is Date | string =>
      isDate(v) || isString(v)) &&
    hasPropertyOfType(value, 'downloadStatus', isChapterStatus)
  );
}

/**
 * Validates optional metadata fields for ChapterEntity
 *
 * @param obj - The object to validate
 * @returns Whether all optional metadata fields are valid (if present)
 */
function validateChapterOptionalMetadataFields(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalProperty(obj, 'downloadUrl', isString) &&
    validateOptionalProperty(obj, 'hash', isString) &&
    validateOptionalProperty(obj, 'mimeType', isString) &&
    validateOptionalProperty(obj, 'pageCount', isNumber) &&
    validateOptionalProperty(obj, 'resolutionWidth', isNumber) &&
    validateOptionalProperty(obj, 'resolutionHeight', isNumber) &&
    validateOptionalProperty(obj, 'resolutionLabel', isString) &&
    validateOptionalProperty(obj, 'language', isString) &&
    validateOptionalProperty(obj, 'alternativeTitles', (v): v is string[] => isArrayOf(v, isString)) &&
    validateOptionalProperty(obj, 'chapterNumber', isNumber) &&
    validateOptionalProperty(obj, 'coverImage', isString)
  );
}

/**
 * Validates optional file and state fields for ChapterEntity
 *
 * @param obj - The object to validate
 * @returns Whether all optional file and state fields are valid (if present)
 */
function validateChapterOptionalFileFields(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalProperty(obj, 'description', isString) &&
    validateOptionalProperty(obj, 'fileFormat', isString) &&
    validateOptionalProperty(obj, 'filePath', isString) &&
    validateOptionalProperty(obj, 'isRead', isBoolean) &&
    validateOptionalProperty(obj, 'monitored', isBoolean) &&
    validateOptionalProperty(obj, 'number', isNumber) &&
    validateOptionalProperty(obj, 'packDownloadId', (v): v is bigint | number => typeof v === 'bigint' || isNumber(v)) &&
    validateOptionalProperty(obj, 'pages', isNumber) &&
    validateOptionalProperty(obj, 'releaseDate', (v): v is Date | string => isDate(v) || isString(v)) &&
    validateOptionalProperty(obj, 'volume', isNumber)
  );
}

/**
 * Validates optional fields for ChapterEntity
 *
 * @param obj - The object to validate
 * @returns Whether all optional fields are valid (if present)
 */
function validateChapterOptionalFields(obj: Record<string, unknown>): boolean {
  return (
    validateChapterOptionalMetadataFields(obj) &&
    validateChapterOptionalFileFields(obj)
  );
}

/**
 * Type guard for ChapterEntity
 * Validates against the Prisma Chapter model schema (lines 87-132)
 *
 * @param value - Value to check
 * @returns Whether the value is a valid ChapterEntity
 */
export function isChapterEntity(value: unknown): value is ChapterEntity {
  if (!isObject(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return validateChapterRequiredFields(obj) && validateChapterOptionalFields(obj);
}

/**
 * Type guard for MangaSearchResult
 *
 * @param value - Value to check
 * @returns Whether the value is a valid MangaSearchResult
 */
export function isMangaSearchResult(value: unknown): value is MangaSearchResult {
  if (!isObject(value)) {
    return false;
  }

  if (!hasPropertyOfType(value, 'title', isString)) {
    return false;
  }

  if (!hasPropertyOfType(value, 'source', isString)) {
    return false;
  }

  if (!hasPropertyOfType(value, 'sourceId', isString)) {
    return false;
  }

  // Optional properties
  const obj = value as Record<string, unknown>;

  // Check metadata if present
  const hasValidMetadata =
    !hasProperty(value, 'metadata') ||
    !isObject(obj['metadata']) ||
    validateMetadataProperties(obj['metadata'] as Record<string, unknown>);

  return (
    validateOptionalProperty(obj, 'id', isString) &&
    validateOptionalProperty(obj, 'coverUrl', isString) &&
    validateOptionalProperty(obj, 'url', isString) &&
    hasValidMetadata
  );
}

/**
 * Type guard for arrays of MangaEntity objects
 *
 * @param value - Value to check
 * @returns Whether the value is an array of MangaEntity objects
 */
export function isMangaEntityArray(value: unknown): value is MangaEntity[] {
  return isArrayOf(value, isMangaEntity);
}

/**
 * Type guard for arrays of ChapterEntity objects
 *
 * @param value - Value to check
 * @returns Whether the value is an array of ChapterEntity objects
 */
export function isChapterEntityArray(value: unknown): value is ChapterEntity[] {
  return isArrayOf(value, isChapterEntity);
}

/**
 * Type guard for arrays of MangaSearchResult objects
 *
 * @param value - Value to check
 * @returns Whether the value is an array of MangaSearchResult objects
 */
export function isMangaSearchResultArray(value: unknown): value is MangaSearchResult[] {
  return isArrayOf(value, isMangaSearchResult);
}

/**
 * Safe type assertion that preserves type safety but provides runtime validation
 *
 * @template T - The expected type
 * @param value - Value to assert type for
 * @param typeGuard - Function to check if value matches expected type
 * @param errorMessage - Optional error message
 * @returns The value with the asserted type
 * @throws If value doesn't match expected type
 *
 * @example
 * ```ts
 * // Instead of unsafe cast: const manga = value as MangaEntity;
 * const manga = assertType(value, isMangaEntity, 'Invalid manga entity');
 * ```
 */
export function assertType<T>(
  value: unknown,
  typeGuard: (val: unknown) => val is T,
  errorMessage = 'Value does not match expected type'
): T {
  if (typeGuard(value)) {
    return value;
  }
  throw new TypeError(errorMessage);
}

/**
 * Safely ensures a value is of the expected type, or returns a default value
 *
 * @template T - The expected type
 * @template D - The default value type
 * @param value - Value to validate
 * @param typeGuard - Function to check if value matches expected type
 * @param defaultValue - Default value to use if validation fails
 * @returns The original value if valid, or the default value
 *
 * @example
 * ```ts
 * // Get manga or fallback to empty entity
 * const manga = ensureType(data, isMangaEntity, createEmptyManga());
 * ```
 */
export function ensureType<T, D = T>(
  value: unknown,
  typeGuard: (val: unknown) => val is T,
  defaultValue: D
): T | D {
  return typeGuard(value) ? value : defaultValue;
}

/**
 * Validates a value against multiple type guards
 *
 * @template T - Union of the expected types
 * @param value - Value to validate
 * @param typeGuards - Array of type guard functions
 * @returns Whether the value matches any of the type guards
 *
 * @example
 * ```ts
 * if (matchesAny(item, [isMangaEntity, isChapterEntity])) {
 *   // item is either MangaEntity or ChapterEntity
 * }
 * ```
 */
export function matchesAny<T extends unknown[]>(
  value: unknown,
  typeGuards: { [K in keyof T]: (val: unknown) => val is T[K] }
): value is T[number] {
  return typeGuards.some(guard => guard(value));
}

/**
 * Safe mapper for arrays of unknown values
 *
 * @template T - The expected item type
 * @template R - The result type
 * @param items - Array of items to map
 * @param typeGuard - Function to validate items
 * @param mapFn - Function to transform valid items
 * @param onInvalid - Optional handler for invalid items
 * @returns Array of mapped items (invalid items are filtered out by default)
 *
 * @example
 * ```ts
 * // Only map valid manga entities, skip invalid ones
 * const mangaTitles = safeMap(
 *   data,
 *   isMangaEntity,
 *   manga => manga.title
 * );
 * ```
 */
export function safeMap<T, R>(
  items: unknown[],
  typeGuard: (item: unknown) => item is T,
  mapFn: (item: T) => R,
  onInvalid?: (item: unknown) => void
): R[] {
  return (items
    .filter(item => {
      const isValid = typeGuard(item);
      if (!isValid && onInvalid) {
        onInvalid(item);
      }
      return isValid;
    }) as T[])
    .map(mapFn);
}

/**
 * Creates an empty MangaEntity with default values matching Prisma schema
 *
 * @returns A minimal valid MangaEntity
 */
export function createEmptyManga(): MangaEntity {
  return {
    id: 0,
    title: '',
    source: '',
    libraryId: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    publicationStatus: MangaStatus.UNKNOWN,
    fileStatus: MangaFileStatus.PENDING,
    libraryStatus: MangaLibraryStatus.ACTIVE,
    searchProvider: 'anilist',
    syncCount: 0
  } as MangaEntity;
}

/**
 * Creates an empty ChapterEntity with default values matching Prisma schema
 *
 * @returns A minimal valid ChapterEntity
 */
export function createEmptyChapter(): ChapterEntity {
  return {
    id: 0,
    fileName: '',
    index: 0,
    size: 0,
    mangaId: 0,
    title: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    downloadStatus: ChapterStatus.PENDING
  } as ChapterEntity;
}
