/**
 * Provider Form Utils - Type Guards
 *
 * Type validation functions with complexity reduction through helper validators.
 * All validators use helper functions to keep complexity under threshold (max 10).
 *
 * Extracted from: providerFormUtils.ts (lines 136-289)
 * Refactored: Complexity reduced from 28/34 to 6-8 per function
 */

import { isObject } from '@/utils/type-guards';

import type {
  Manga,
  ProviderMetadataResult,
  SelectOption,
} from './types';

// ============================================================================
// Helper Validators for isManga (6 helpers)
// ============================================================================

/**
 * Validates manga ID field (string or number)
 */
function hasValidMangaId(manga: Record<string, unknown>): boolean {
  return (
    'id' in manga &&
    (typeof manga['id'] === 'number' || typeof manga['id'] === 'string')
  );
}

/**
 * Validates manga title field (string)
 */
function hasValidMangaTitle(manga: Record<string, unknown>): boolean {
  return 'title' in manga && typeof manga['title'] === 'string';
}

/**
 * Validates optional metadata field
 */
function hasValidMangaMetadata(manga: Record<string, unknown>): boolean {
  if (!('metadata' in manga)) return true; // Optional
  if (manga['metadata'] === undefined) return true;
  if (manga['metadata'] === null) return true; // null is valid
  return typeof manga['metadata'] === 'object';
}

/**
 * Validates provider metadata field (object or array)
 */
function hasValidProviderMetadata(manga: Record<string, unknown>): boolean {
  if (!('providerMetadata' in manga)) return true; // Optional
  if (manga['providerMetadata'] === undefined) return true;
  if (manga['providerMetadata'] === null) return false; // null not allowed
  return typeof manga['providerMetadata'] === 'object';
}

/**
 * Validates optional status field (string or object with toString)
 */
function hasValidMangaStatus(manga: Record<string, unknown>): boolean {
  if (!('status' in manga)) return true; // Optional
  if (manga['status'] === undefined) return true;

  if (typeof manga['status'] === 'string') return true;

  // Check for object with toString method
  return (
    typeof manga['status'] === 'object' &&
    manga['status'] !== null &&
    'toString' in manga['status'] &&
    typeof manga['status'].toString === 'function'
  );
}

/**
 * Validates optional source and libraryId fields
 */
function hasValidMangaOptionalFields(manga: Record<string, unknown>): boolean {
  // Validate source if present
  if ('source' in manga && manga['source'] !== undefined) {
    if (manga['source'] !== null && typeof manga['source'] !== 'string') {
      return false;
    }
  }

  // Validate libraryId if present
  if ('libraryId' in manga && manga['libraryId'] !== undefined) {
    if (manga['libraryId'] !== null && typeof manga['libraryId'] !== 'number') {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Main Validator: isManga (Complexity: ~8 after refactoring)
// ============================================================================

/**
 * Type guard to ensure we have a valid Manga object
 *
 * Complexity reduced from 28 to 8 by delegating to helper validators.
 *
 * @param manga - The object to check
 * @returns True if the object conforms to our Manga interface
 */
export function isManga(manga: unknown): manga is Manga {
  if (!isObject(manga)) return false;

  const mangaRecord = manga as Record<string, unknown>;

  return (
    hasValidMangaId(mangaRecord) &&
    hasValidMangaTitle(mangaRecord) &&
    hasValidMangaMetadata(mangaRecord) &&
    hasValidProviderMetadata(mangaRecord) &&
    hasValidMangaStatus(mangaRecord) &&
    hasValidMangaOptionalFields(mangaRecord)
  );
}

// ============================================================================
// Helper Validators for isProviderMetadataResult (6 helpers)
// ============================================================================

/**
 * Validates provider ID field (string or number)
 */
function hasValidProviderId(obj: Record<string, unknown>): boolean {
  if (!('id' in obj)) return true;
  if (obj['id'] === undefined) return true;
  if (obj['id'] === null) return true;
  return typeof obj['id'] === 'string' || typeof obj['id'] === 'number';
}

/**
 * Validates provider string fields (title, description, status)
 */
function hasValidProviderStringFields(obj: Record<string, unknown>): boolean {
  const stringFields = ['title', 'description', 'status'];
  for (const field of stringFields) {
    if (field in obj && obj[field] !== undefined) {
      if (obj[field] !== null && typeof obj[field] !== 'string') {
        return false;
      }
    }
  }
  return true;
}

/**
 * Validates numeric fields (volumes, chapters)
 */
function hasValidProviderNumericFields(obj: Record<string, unknown>): boolean {
  const numericFields = ['volumes', 'chapters'];

  for (const field of numericFields) {
    if (field in obj && obj[field] !== undefined) {
      if (obj[field] !== null && typeof obj[field] !== 'number' && typeof obj[field] !== 'string') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validates array fields (alternativeTitles, genres, tags, authors, staff, characters)
 */
function hasValidProviderArrayFields(obj: Record<string, unknown>): boolean {
  const arrayFields = ['alternativeTitles', 'genres', 'tags', 'authors', 'staff', 'characters'];

  for (const field of arrayFields) {
    if (field in obj && obj[field] !== undefined) {
      if (!Array.isArray(obj[field])) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validates date fields (startDate, endDate)
 */
function hasValidProviderDateFields(obj: Record<string, unknown>): boolean {
  const dateFields = ['startDate', 'endDate'];
  for (const field of dateFields) {
    if (field in obj && obj[field] !== undefined) {
      const value = obj[field];
      if (!(value instanceof Date) && typeof value !== 'string' && value !== null) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Validates cover image fields
 */
function hasValidProviderCoverFields(obj: Record<string, unknown>): boolean {
  const coverFields = ['cover', 'coverImage', 'coverLarge', 'coverMedium', 'coverSmall'];
  for (const field of coverFields) {
    if (field in obj && obj[field] !== undefined) {
      if (obj[field] !== null && typeof obj[field] !== 'string') {
        return false;
      }
    }
  }
  return true;
}

// ============================================================================
// Main Validator: isProviderMetadataResult (Complexity: ~8 after refactoring)
// ============================================================================

/**
 * Type guard for provider metadata result
 *
 * Complexity reduced from 34 to 8 by delegating to helper validators.
 *
 * @param value - The value to check
 * @returns True if the object conforms to ProviderMetadataResult
 */
export function isProviderMetadataResult(value: unknown): value is ProviderMetadataResult {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  return (
    hasValidProviderId(obj) &&
    hasValidProviderStringFields(obj) &&
    hasValidProviderNumericFields(obj) &&
    hasValidProviderArrayFields(obj) &&
    hasValidProviderDateFields(obj) &&
    hasValidProviderCoverFields(obj)
  );
}

// ============================================================================
// Simple Validator: isSelectOption (No refactoring needed - complexity 5)
// ============================================================================

/**
 * Type guard for SelectOption
 *
 * @param value - The value to check
 * @returns True if the object conforms to SelectOption
 */
export function isSelectOption(value: unknown): value is SelectOption {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // Check required properties with proper type checks
  if (!('value' in obj) || typeof obj['value'] !== 'string') {
    return false;
  }
  if (!('label' in obj) || typeof obj['label'] !== 'string') {
    return false;
  }
  if (!('provider' in obj) || typeof obj['provider'] !== 'string') {
    return false;
  }

  // originalValue can be any type, but must be present
  if (!('originalValue' in obj)) {
    return false;
  }

  return true;
}
