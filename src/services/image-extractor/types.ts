/**
 * Image Extractor - Type Definitions and Guards
 *
 * Foundation module providing:
 * - Type re-exports for convenience
 * - Type guards for safe type narrowing
 * - Helper functions for parsing and validation
 *
 * This module fixes the unsafe assignment errors in the original file:
 * - Lines 146, 150: Gallery array type safety
 * - Line 489: Safe JSON parsing
 *
 * Extracted from: src/services/imageExtractor.ts
 * Created: 2025-11-20
 */

import type { ProviderMetadata } from '@/types/provider-metadata.types';
import { getProviderNameFromKey } from '@/types/provider-metadata.types';

// ============================================================================
// Type Re-Exports
// ============================================================================

/**
 * Re-export types from provider-metadata.types for convenience
 * This allows consumers to import all image-related types from a single location
 */
export type {
  ImageOption,
  ImageCategory,
  ProviderMetadata,
  WizardSelectedImages,
  FandomMetadata,
  FandomVolume,
  FandomChapter,
  ComicVineMetadata,
  ComicVineIssue,
  AniListMetadata,
  WikipediaMetadata,
  SelectedProviderMetadata,
  FandomGallery,
  AniListCoverImage,
  RawProviderData
} from '@/types/provider-metadata.types';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for gallery array
 *
 * Validates that a value is an array of strings or image objects
 * Fixes unsafe assignments at lines 146, 150 in original file
 *
 * @param value - Unknown value to validate
 * @returns True if value is a valid gallery array
 *
 * @example
 * ```typescript
 * const gallery: unknown = fandomData.gallery;
 * if (isGalleryArray(gallery)) {
 *   // gallery is now typed as Array<string | { url: string; caption?: string }>
 *   gallery.forEach(item => processGalleryItem(item));
 * }
 * ```
 */
export function isGalleryArray(
  value: unknown
): value is Array<string | { url: string; caption?: string }> {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every(item => {
    // Allow string items
    if (typeof item === 'string') {
      return true;
    }

    // Allow object items with url property
    if (item && typeof item === 'object' && 'url' in item) {
      return typeof (item as { url: unknown }).url === 'string';
    }

    return false;
  });
}

/**
 * Type guard for string array
 *
 * Validates that a value is an array containing only strings
 *
 * @param value - Unknown value to validate
 * @returns True if value is a string array
 *
 * @example
 * ```typescript
 * const images: unknown = data.selectedGalleryImages;
 * if (isStringArray(images)) {
 *   // images is now typed as string[]
 *   images.forEach(url => processImageUrl(url));
 * }
 * ```
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Type guard for provider metadata
 *
 * Validates that a value is a valid provider metadata object
 * Provider metadata has a flexible structure, so we only check that it's an object
 *
 * @param value - Unknown value to validate
 * @returns True if value is a provider metadata object
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(jsonString);
 * if (isProviderMetadata(data)) {
 *   // data is now typed as ProviderMetadata
 *   if (data.fandom) extractFandomImages(data.fandom);
 * }
 * ```
 */
export function isProviderMetadata(value: unknown): value is ProviderMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }
  // Provider metadata has flexible structure with [key: string]: unknown
  // We trust the structure if it's an object
  return true;
}

/**
 * Type guard for image object
 *
 * Validates that a value is an object with a url property
 *
 * @param value - Unknown value to validate
 * @returns True if value is an image object
 *
 * @example
 * ```typescript
 * const item: unknown = galleryArray[0];
 * if (isImageObject(item)) {
 *   // item is now typed as { url: string; caption?: string }
 *   console.log(item.url, item.caption);
 * }
 * ```
 */
export function isImageObject(
  value: unknown
): value is { url: string; caption?: string } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return 'url' in obj && typeof obj['url'] === 'string';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely parse provider metadata from string or object
 *
 * Handles both string (JSON) and object inputs
 * Fixes unsafe JSON parsing at line 489 in original file
 *
 * @param data - Provider metadata as string or object
 * @returns Parsed provider metadata or null if parsing fails
 *
 * @example
 * ```typescript
 * const metadata = parseProviderMetadata(manga.providerMetadata);
 * if (metadata?.fandom) {
 *   extractFandomImages(metadata.fandom);
 * }
 * ```
 */
export function parseProviderMetadata(
  data: ProviderMetadata | string | null
): ProviderMetadata | null {
  if (!data) {
    return null;
  }

  try {
    if (typeof data === 'string') {
      const parsed: unknown = JSON.parse(data);
      // Use type guard to validate parsed data
      return isProviderMetadata(parsed) ? parsed : null;
    }
    return data;
  } catch (e) {
    // Don't use logger here to avoid circular dependency
    // Logger will be used in the consuming code
    console.error(
      'Failed to parse provider metadata:',
      e instanceof Error ? e.message : String(e)
    );
    return null;
  }
}

/**
 * Get provider name safely from provider key
 *
 * Wrapper around getProviderNameFromKey from provider-metadata.types
 * Provides a centralized location for provider name resolution
 *
 * @param key - Provider key (e.g., 'anilist_selected', 'fandom')
 * @returns Human-readable provider name
 *
 * @example
 * ```typescript
 * const name = getProviderNameSafe('anilist_selected');
 * // Returns: "Anilist Selected"
 * ```
 */
export function getProviderNameSafe(key: string): string {
  return getProviderNameFromKey(key);
}
