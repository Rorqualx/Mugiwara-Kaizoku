/**
 * Metadata Normalization Utilities
 *
 * Ensures consistent metadata structure across all providers
 * - Converts undefined arrays to empty arrays
 * - Filters out undefined/null values from arrays
 * - Ensures proper typing for ProviderMetadata
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';

/**
 * Sanitize an array field to ensure it contains no undefined values
 * @param arr - Array to sanitize (may be undefined)
 * @returns Empty array if undefined, or filtered array with no undefined values
 */
function sanitizeArray<T>(arr: T[] | undefined): T[] {
  if (!Array.isArray(arr)) {
    return [];
  }

  return arr.filter((item): item is T =>
    item !== null &&
    item !== undefined &&
    item !== '' &&
    (typeof item !== 'string' || (item !== 'UNKNOWN' && item !== 'undefined' && item !== 'null'))
  );
}

/**
 * Normalize ProviderMetadata to ensure consistent structure
 *
 * This function:
 * - Converts undefined arrays (genres, tags, themes) to empty arrays
 * - Filters out undefined/null values from existing arrays
 * - Ensures all string arrays contain only valid strings
 *
 * @param metadata - Raw provider metadata
 * @returns Normalized provider metadata with consistent array structure
 *
 * @example
 * ```ts
 * const raw = {
 *   title: 'Fire Force',
 *   genres: ['Action', undefined, 'Drama'],
 *   tags: undefined,
 *   themes: [null, 'Firefighters']
 * };
 *
 * const normalized = normalizeProviderMetadata(raw);
 * // Result:
 * // {
 * //   title: 'Fire Force',
 * //   genres: ['Action', 'Drama'],
 * //   tags: [],
 * //   themes: ['Firefighters']
 * // }
 * ```
 */
export function normalizeProviderMetadata(metadata: ProviderMetadata): ProviderMetadata {
  return {
    ...metadata,
    // Normalize array fields to ensure no undefined values
    genres: sanitizeArray(metadata.genres),
    tags: sanitizeArray(metadata.tags),
    themes: sanitizeArray(metadata.themes),
    authors: sanitizeArray(metadata.authors),
    artists: sanitizeArray(metadata.artists),
    alternativeTitles: sanitizeArray(metadata.alternativeTitles),
    externalLinks: sanitizeArray(metadata.externalLinks),
    images: sanitizeArray(metadata.images),
    gallery: sanitizeArray(metadata.gallery),
    volumeData: sanitizeArray(metadata.volumeData),
    chapterData: sanitizeArray(metadata.chapterData),
  };
}

/**
 * Normalize all metadata from multiple providers
 *
 * @param sourcesMetadata - Record of provider name to metadata
 * @returns Normalized metadata for all providers
 *
 * @example
 * ```ts
 * const sources = {
 *   anilist: { title: 'Fire Force', tags: [undefined, 'Action'] },
 *   fandom: { title: 'Fire Force', genres: ['Manga'] },
 *   wikipedia: { title: 'Fire Force', tags: undefined }
 * };
 *
 * const normalized = normalizeAllProviderMetadata(sources);
 * // All providers will have properly sanitized arrays
 * ```
 */
export function normalizeAllProviderMetadata(
  sourcesMetadata: Record<string, ProviderMetadata>
): Record<string, ProviderMetadata> {
  const normalized: Record<string, ProviderMetadata> = {};

  for (const [provider, metadata] of Object.entries(sourcesMetadata)) {
    normalized[provider] = normalizeProviderMetadata(metadata);
  }

  return normalized;
}
