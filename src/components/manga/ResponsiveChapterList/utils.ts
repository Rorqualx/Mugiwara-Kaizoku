/**
 * ResponsiveChapterList Utility Functions
 *
 * Foundation utilities for safe type handling and data transformation.
 * Provides type guards, safe accessors, and data transformers for volume extraction.
 *
 * This module contains:
 * - Type Guards: Runtime type validation for unknown data structures
 * - Safe Accessors: Null-safe property extraction from unknown objects
 * - Data Transformers: Volume data extraction and normalization
 *
 * Extracted from: ResponsiveChapterList.tsx (404 lines)
 * Created: 2025-11-17
 */

import { logger } from '@/utils/logger';

import type {
  EnrichedVolume,
  VolumeMetadata,
  ProviderMetadataStructure,
} from './types';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if value is a plain object record
 *
 * @param value - Value to check
 * @returns True if value is a non-null, non-array object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if value is a string array
 *
 * @param value - Value to check
 * @returns True if value is an array of strings
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Type guard to check if value is an EnrichedVolume
 *
 * Validates that the object has at least one volume number field
 * (volumeNumber or number) as defined in the EnrichedVolume interface.
 *
 * @param value - Value to check
 * @returns True if value conforms to EnrichedVolume structure
 */
export function isEnrichedVolume(value: unknown): value is EnrichedVolume {
  if (!isRecord(value)) return false;
  const hasVolumeNumber = 'volumeNumber' in value || 'number' in value;
  return hasVolumeNumber;
}

/**
 * Type guard to check if value is an array of EnrichedVolume
 *
 * @param value - Value to check
 * @returns True if value is an array where every element is an EnrichedVolume
 */
export function isEnrichedVolumeArray(value: unknown): value is EnrichedVolume[] {
  return Array.isArray(value) && value.every(item => isEnrichedVolume(item));
}

/**
 * Generic type guard to check if object has a specific property
 *
 * @param obj - Object to check
 * @param key - Property key to look for
 * @returns True if obj is a record containing the specified key
 */
export function hasProperty<T extends string>(
  obj: unknown,
  key: T
): obj is Record<T, unknown> {
  return isRecord(obj) && key in obj;
}

/**
 * Type guard for provider metadata structure
 *
 * @param value - Value to check
 * @returns True if value is a valid provider metadata structure
 */
export function isProviderMetadata(value: unknown): value is ProviderMetadataStructure {
  return isRecord(value);
}

// ============================================================================
// Safe Accessors
// ============================================================================

/**
 * Safely get a value from an object by key
 *
 * Provides null-safe property access with type casting.
 * Returns undefined if object is not a record or key doesn't exist.
 *
 * @param obj - Object to extract value from
 * @param key - Property key to access
 * @returns Value at key, or undefined if not found
 */
export function safeGet<T = unknown>(obj: unknown, key: string): T | undefined {
  if (!isRecord(obj) || !(key in obj)) {
    return undefined;
  }
  return obj[key] as T;
}

/**
 * Safely get a string value
 *
 * @param obj - Object to extract value from
 * @param key - Property key to access
 * @returns String value at key, or undefined if not a string
 */
export function safeGetString(obj: unknown, key: string): string | undefined {
  const value = safeGet(obj, key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Safely get a number value
 *
 * @param obj - Object to extract value from
 * @param key - Property key to access
 * @returns Number value at key, or undefined if not a number
 */
export function safeGetNumber(obj: unknown, key: string): number | undefined {
  const value = safeGet(obj, key);
  return typeof value === 'number' ? value : undefined;
}

/**
 * Safely get an array value
 *
 * @param obj - Object to extract value from
 * @param key - Property key to access
 * @returns Array value at key, or undefined if not an array
 */
export function safeGetArray<T = unknown>(obj: unknown, key: string): T[] | undefined {
  const value = safeGet(obj, key);
  return Array.isArray(value) ? (value as T[]) : undefined;
}

/**
 * Safely get a record value
 *
 * @param obj - Object to extract value from
 * @param key - Property key to access
 * @returns Record value at key, or undefined if not a record
 */
export function safeGetRecord(obj: unknown, key: string): Record<string, unknown> | undefined {
  const value = safeGet(obj, key);
  return isRecord(value) ? value : undefined;
}

/**
 * Parse JSON with error handling
 *
 * Handles both string JSON and already-parsed objects.
 * Returns null on parse errors instead of throwing.
 *
 * @param value - JSON string or already-parsed value
 * @returns Parsed JSON value, or null on error
 */
export function parseJSON<T = unknown>(value: unknown): T | null {
  if (typeof value !== 'string') {
    return value as T;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('[utils] Failed to parse JSON', { error });
    return null;
  }
}

/**
 * Parse double-encoded JSON (common in provider metadata)
 *
 * Some providers store JSON as double-encoded strings (JSON.stringify twice).
 * This function handles parsing both layers automatically.
 *
 * @param value - Single or double-encoded JSON string
 * @returns Parsed JSON value, or null on error
 */
export function parseDoubleEncodedJSON<T = unknown>(value: unknown): T | null {
  const firstParse = parseJSON(value);
  if (typeof firstParse === 'string') {
    return parseJSON<T>(firstParse);
  }
  return firstParse as T;
}

/**
 * Extract volume number from EnrichedVolume
 *
 * Tries `volumeNumber` field first, falls back to `number` field.
 *
 * @param volume - EnrichedVolume object
 * @returns Volume number, or undefined if not present
 */
export function extractVolumeNumber(volume: EnrichedVolume): number | undefined {
  return volume.volumeNumber ?? volume.number;
}

// ============================================================================
// Data Transformers
// ============================================================================

/**
 * Extract volume title from EnrichedVolume with fallback chain
 *
 * Tries multiple title field variations used by different providers:
 * 1. `title` (primary)
 * 2. `volumeTitle`
 * 3. `name` (Fandom)
 * 4. `volumeName`
 *
 * @param volume - EnrichedVolume object
 * @returns Volume title, or undefined if not present
 */
export function extractVolumeTitle(volume: EnrichedVolume): string | undefined {
  return volume.title ?? volume.volumeTitle ?? volume.name ?? volume.volumeName;
}

/**
 * Extract volume cover URL from EnrichedVolume
 *
 * Tries multiple cover field variations used by different providers:
 * 1. `coverImageUrl` (primary)
 * 2. `coverUrl`
 * 3. `cover` (Fandom)
 *
 * @param volume - EnrichedVolume object
 * @returns Cover image URL, or undefined if not present or not a string
 */
export function extractVolumeCover(volume: EnrichedVolume): string | undefined {
  const cover = volume.coverImageUrl ?? volume.coverUrl ?? volume.cover;
  return typeof cover === 'string' ? cover : undefined;
}

/**
 * Create VolumeMetadata from EnrichedVolume array
 *
 * Extracts volume titles and cover URLs from an array of enriched volumes
 * and creates lookup maps indexed by volume number.
 *
 * Skips volumes that don't have a valid volume number.
 * Only includes titles/covers that are present and valid.
 *
 * @param volumes - Array of EnrichedVolume objects
 * @returns VolumeMetadata with title and cover lookup maps
 */
export function createVolumeMetadata(volumes: EnrichedVolume[]): VolumeMetadata {
  const volumeTitles: Record<number, string> = {};
  const volumeCovers: Record<number, string> = {};

  volumes.forEach((volume) => {
    const volumeNum = extractVolumeNumber(volume);
    const title = extractVolumeTitle(volume);
    const cover = extractVolumeCover(volume);

    if (volumeNum !== undefined) {
      if (title !== undefined) {
        volumeTitles[volumeNum] = title;
      }
      if (cover !== undefined) {
        volumeCovers[volumeNum] = cover;
      }
    }
  });

  return { volumeTitles, volumeCovers };
}
