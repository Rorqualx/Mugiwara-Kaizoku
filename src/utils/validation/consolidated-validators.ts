/**
 * Consolidated Validators
 *
 * This is the single source of truth for all domain-specific validation functions.
 * Basic type guards are imported from the centralized type-guards library.
 */

// Import enums from Prisma
import {
  MangaPublicationStatus,
  JobStatus,
  ChapterStatus} from '@prisma/client';

import type { ID, DateLike, Nullable, Optional } from '@/types/common';
// Import basic type guards from the canonical type-guards module
import {
  isObject,
  isArray,
  isStringArray,
  isNumberArray,
  isString,
  isNumber,
  isBoolean,
  isDefined,
  isPresent,
  hasProperty,
  isArrayOf
} from '@/utils/type-guards';

import { isValidId } from '../id-converters';


import type {
  Manga as MangaEntity,
  Chapter as ChapterEntity,
  Library as LibraryEntity
} from '@prisma/client';

// Re-export for backward compatibility
export {
  isObject,
  isArray,
  isStringArray,
  isNumberArray,
  isString,
  isNumber,
  isBoolean,
  isDefined,
  isPresent,
  hasProperty,
  isArrayOf,
  isValidId  // Re-export from canonical source
};

interface BaseEntity {
  id: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface VolumeEntity extends BaseEntity {
  mangaId: number;
  number: number;
}

interface MetadataResult {
  title: string;
  provider: string;
}

interface EnrichedMetadata extends MetadataResult {
  confidence: number;
}

interface ProviderMetadata {
  provider: string;
  data: unknown;
  confidence?: number;
  lastUpdated?: Date;
}

// ============================================================================
// ID Validators
// ============================================================================

/**
 * Validates if a value is a numeric ID
 * @param value - Value to validate
 * @returns True if the value is a numeric ID
 */
export function isNumericId(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Validates if a value is a string ID
 * @param value - Value to validate
 * @returns True if the value is a string ID
 */
export function isStringId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

// ============================================================================
// Entity Validators
// ============================================================================

/**
 * Validates if a value is a Manga entity
 * @param value - Value to validate
 * @returns True if the value is a Manga entity
 */
export function isMangaEntity(value: unknown): value is MangaEntity {
  if (!isObject(value)) return false;
  return (
    hasProperty(value, 'id') && isNumericId(value['id']) &&
    hasProperty(value, 'title') && isString(value['title']) &&
    hasProperty(value, 'source') && isString(value['source'])
  );
}

/**
 * Validates if a value is a Chapter entity
 * @param value - Value to validate
 * @returns True if the value is a Chapter entity
 */
export function isChapterEntity(value: unknown): value is ChapterEntity {
  if (!isObject(value)) return false;
  return (
    hasProperty(value, 'id') && isNumericId(value['id']) &&
    hasProperty(value, 'mangaId') && isNumericId(value['mangaId']) &&
    hasProperty(value, 'title') && isString(value['title'])
  );
}

/**
 * Validates if a value is a Library entity
 * @param value - Value to validate
 * @returns True if the value is a Library entity
 */
export function isLibraryEntity(value: unknown): value is LibraryEntity {
  if (!isObject(value)) return false;
  return (
    hasProperty(value, 'id') && isNumericId(value['id']) &&
    hasProperty(value, 'name') && isString(value['name']) &&
    hasProperty(value, 'path') && isString(value['path'])
  );
}

/**
 * Validates if a value is a Volume entity
 * @param value - Value to validate
 * @returns True if the value is a Volume entity
 */
export function isVolumeEntity(value: unknown): value is VolumeEntity {
  if (!isObject(value)) return false;
  return (
    hasProperty(value, 'id') && isNumericId(value['id']) &&
    hasProperty(value, 'mangaId') && isNumericId(value['mangaId']) &&
    hasProperty(value, 'number') && isNumber(value['number'])
  );
}

// ============================================================================
// Status Validators
// ============================================================================

/**
 * Validates if a value is a valid MangaPublicationStatus
 * @param value - Value to validate
 * @returns True if the value is a valid MangaPublicationStatus
 */
export function isValidMangaStatus(value: unknown): value is MangaPublicationStatus {
  return Object.values(MangaPublicationStatus).includes(value as MangaPublicationStatus);
}

/**
 * Validates if a value is a valid JobStatus
 * @param value - Value to validate
 * @returns True if the value is a valid JobStatus
 */
export function isValidJobStatus(value: unknown): value is JobStatus {
  return Object.values(JobStatus).includes(value as JobStatus);
}

/**
 * Validates if a value is a valid ChapterStatus
 * @param value - Value to validate
 * @returns True if the value is a valid ChapterStatus
 */
export function isValidChapterStatus(value: unknown): value is ChapterStatus {
  return Object.values(ChapterStatus).includes(value as ChapterStatus);
}

// ============================================================================
// Date Validators
// ============================================================================

/**
 * Validates if a value is a valid date-like value
 * @param value - Value to validate
 * @returns True if the value can be converted to a Date
 */
export function isDateLike(value: unknown): value is DateLike {
  if (value instanceof Date) return !isNaN(value.getTime());
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return false;
}

/**
 * Validates if a value is a valid Date object
 * @param value - Value to validate
 * @returns True if the value is a valid Date
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

// ============================================================================
// Metadata Validators
// ============================================================================

/**
 * Validates if a value is a MetadataResult
 * @param value - Value to validate
 * @returns True if the value is a MetadataResult
 */
export function isMetadataResult(value: unknown): value is MetadataResult {
  if (!isObject(value)) return false;
  return (
    hasProperty(value, 'title') && isString(value['title']) &&
    hasProperty(value, 'provider') && isString(value['provider'])
  );
}

/**
 * Validates if a value is an EnrichedMetadata
 * @param value - Value to validate
 * @returns True if the value is an EnrichedMetadata
 */
export function isEnrichedMetadata(value: unknown): value is EnrichedMetadata {
  if (!isMetadataResult(value)) return false;
  return hasProperty(value, 'confidence') && isNumber(value['confidence']);
}

/**
 * Validates if a value is a ProviderMetadata
 * @param value - Value to validate
 * @returns True if the value is a ProviderMetadata
 */
export function isProviderMetadata(value: unknown): value is ProviderMetadata {
  if (!isObject(value)) return false;
  return (
    hasProperty(value, 'provider') && isString(value['provider']) &&
    hasProperty(value, 'data') && isDefined(value['data'])
  );
}

// ============================================================================
// Array Validators
// ============================================================================

/**
 * Validates if a value is an array of Manga entities
 * @param value - Value to validate
 * @returns True if the value is an array of Manga entities
 */
export function isMangaEntityArray(value: unknown): value is MangaEntity[] {
  return isArray(value) && value.every(isMangaEntity);
}

/**
 * Validates if a value is an array of Chapter entities
 * @param value - Value to validate
 * @returns True if the value is an array of Chapter entities
 */
export function isChapterEntityArray(value: unknown): value is ChapterEntity[] {
  return isArray(value) && value.every(isChapterEntity);
}

/**
 * Validates if a value is an array of valid IDs
 * @param value - Value to validate
 * @returns True if the value is an array of IDs
 */
export function isIdArray(value: unknown): value is ID[] {
  return isArray(value) && value.every(isValidId);
}

// ============================================================================
// Nullable and Optional Validators
// ============================================================================

/**
 * Creates a nullable validator for a given type guard
 * @param guard - Type guard function
 * @returns Nullable type guard function
 */
export function nullable<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is Nullable<T> => {
    return value === null || guard(value);
  };
}

/**
 * Creates an optional validator for a given type guard
 * @param guard - Type guard function
 * @returns Optional type guard function
 */
export function optional<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is Optional<T> => {
    return value === null || guard(value);
  };
}

// ============================================================================
// Utility Validators
// ============================================================================

/**
 * Validates if a value has all required properties
 * @param value - Value to validate
 * @param properties - Required properties
 * @returns True if the value has all required properties
 */
export function hasRequiredProperties(
  value: unknown,
  properties: string[]
): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  return properties.every(prop => prop in value);
}

/**
 * Validates if a value matches a specific shape
 * @param value - Value to validate
 * @param shape - Shape definition with property validators
 * @returns True if the value matches the shape
 */
export function matchesShape<T extends Record<string, (v: unknown) => boolean>>(
  value: unknown,
  shape: T
): value is { [K in keyof T]: T[K] extends (v: unknown) => v is infer U ? U : never } {
  if (!isObject(value)) return false;

  for (const [key, validator] of Object.entries(shape)) {
    if (!hasProperty(value, key) || !validator(value[key as keyof typeof value])) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Export Type Definitions
// ============================================================================

export type {
  ID,
  DateLike,
  Nullable,
  Optional,
  BaseEntity,
  VolumeEntity,
  MetadataResult,
  EnrichedMetadata,
  ProviderMetadata,
  MangaEntity,
  ChapterEntity,
  LibraryEntity
};