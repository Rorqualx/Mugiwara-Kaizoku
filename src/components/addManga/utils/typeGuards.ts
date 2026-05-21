/**
 * Type guards and helpers for UniversalImportWizard
 * Eliminates unsafe double casts by providing type-safe conversions
 */

import type { VolumesData, Volume } from '@/types/universalImportWizard.types';

// ============================================================================
// Field Aliasing for Metadata Fields
// ============================================================================

/**
 * Field name aliases for metadata fields
 * Maps preference field names (from METADATA_FIELDS) to actual property names in search results
 * Order matters: first match wins
 */
const FIELD_ALIASES: Record<string, string[]> = {
  // Singular -> Plural mappings (METADATA_FIELDS uses singular, results use plural)
  author: ['authors', 'author'],
  artist: ['artists', 'artist'],

  // Image field variations
  coverImage: ['coverImage', 'cover', 'coverUrl'],
  bannerImage: ['bannerImage', 'banner', 'bannerUrl'],

  // Description variations
  description: ['description', 'synopsis', 'summary'],
  synopsis: ['synopsis', 'description', 'summary'],

  // Alternative titles variations
  alternativeTitles: ['alternativeTitles', 'alternativeNames', 'synonyms'],
};

/**
 * Type guard to check if value is VolumesData
 */
export function isVolumesData(value: unknown): value is VolumesData {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj['volumes']) &&
    typeof obj['totalVolumes'] === 'number' &&
    typeof obj['totalChapters'] === 'number'
  );
}

/**
 * Safely converts Record to VolumesData
 */
export function toVolumesData(record: Record<string, unknown> | VolumesData): VolumesData {
  if (isVolumesData(record)) {
    return record;
  }
  // Fallback to empty VolumesData structure
  return {
    volumes: Array.isArray(record['volumes']) ? record['volumes'] as VolumesData['volumes'] : [],
    totalVolumes: typeof record['totalVolumes'] === 'number' ? record['totalVolumes'] : 0,
    totalChapters: typeof record['totalChapters'] === 'number' ? record['totalChapters'] : 0
  };
}

/**
 * Safely gets a property from a volume-like object
 * This handles the case where volume might have dynamic properties
 */
export function getVolumeProperty<T = unknown>(volume: Volume | Record<string, unknown>, key: string): T | undefined {
  const volumeObj = volume as Record<string, unknown>;
  return volumeObj[key] as T | undefined;
}

/**
 * Gets cover image URL from a volume, checking all possible property names
 */
export function getVolumeCoverUrl(volume: Volume | Record<string, unknown>): string | undefined {
  if ('coverUrl' in volume && typeof volume.coverUrl === 'string') {
    return volume.coverUrl;
  }
  if ('coverImage' in volume && typeof volume.coverImage === 'string') {
    return volume.coverImage;
  }
  if ('coverImageUrl' in volume && typeof volume.coverImageUrl === 'string') {
    return volume.coverImageUrl;
  }
  // Check dynamic property as fallback
  return getVolumeProperty<string>(volume, 'image');
}

/**
 * Safely gets a field from a search result or metadata object
 * Supports field name aliasing to handle variations between METADATA_FIELDS
 * and actual property names in search results (e.g., author -> authors)
 */
export function getMetadataField<T = unknown>(
  obj: Record<string, unknown> | undefined,
  fieldName: string
): T | undefined {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  // Try exact match first
  const exactValue = obj[fieldName];
  if (exactValue !== undefined && exactValue !== null) {
    return exactValue as T;
  }

  // Try aliases if exact match not found
  const aliases = FIELD_ALIASES[fieldName];
  if (aliases) {
    for (const alias of aliases) {
      const aliasValue = obj[alias];
      if (aliasValue !== undefined && aliasValue !== null) {
        return aliasValue as T;
      }
    }
  }

  return undefined;
}
