/**
 * Image Selection Module
 *
 * Functions for selecting the best/highest quality image from various sources.
 *
 * Extracted from: index.ts (lines 224-299)
 */

import { cleanImageUrl } from './url-processing';

import type { ImageSet, ImageProcessingOptions } from './types';

// ============================================================================
// Image Selection Functions
// ============================================================================

/**
 * Select the best image from a set of options
 */
export function selectBestImage(
  images: ImageSet,
  preferred?: ImageProcessingOptions['preferredSize']
): string {
  const preference = preferred ?? 'large';

  // Priority order based on preference
  const priorities: Record<string, (keyof ImageSet)[]> = {
    original: ['original', 'large', 'medium', 'small'],
    large: ['large', 'original', 'medium', 'small'],
    medium: ['medium', 'large', 'small', 'original'],
    small: ['small', 'medium', 'large', 'original']
  };

  const order = priorities[preference] ?? priorities["large"];
  if (!order) return '';

  for (const size of order) {
    const imageUrl = images[size];
    if (imageUrl) {
      return imageUrl;
    }
  }

  return '';
}

/**
 * Extract image from AniList format
 */
function extractFromAniListFormat(data: Record<string, unknown>): string | null {
  if (!data["extraLarge"] && !data["large"] && !data["medium"]) return null;

  const imageSet: ImageSet = {};
  const small = data["small"];
  if (small && typeof small === 'string') imageSet.small = small;
  const medium = data["medium"];
  if (medium && typeof medium === 'string') imageSet.medium = medium;
  const large = data["large"];
  if (large && typeof large === 'string') imageSet.large = large;
  const extraLarge = data["extraLarge"];
  if (extraLarge && typeof extraLarge === 'string') imageSet.original = extraLarge;

  return selectBestImage(imageSet);
}

/**
 * Extract image from ComicVine format
 */
function extractFromComicVineFormat(data: Record<string, unknown>): string | null {
  if (!data["original_url"] && !data["super_url"]) return null;

  return (
    (data["original_url"] as string) ||
    (data["super_url"] as string) ||
    (data["medium_url"] as string) ||
    (data["small_url"] as string) ||
    ''
  );
}

/**
 * Extract the highest quality image from various formats
 *
 * Complexity reduced from 24 to 8 by extracting format-specific handlers.
 */
export function extractBestImage(imageData: unknown): string {
  if (!imageData) return '';

  // Direct string URL
  if (typeof imageData === 'string') {
    return cleanImageUrl(imageData);
  }

  // Type guard for object
  if (typeof imageData !== 'object') return '';

  // Array of images
  if (Array.isArray(imageData) && imageData.length > 0) {
    return extractBestImage(imageData[0]);
  }

  const data = imageData as Record<string, unknown>;

  // Try format-specific extractors
  const aniListResult = extractFromAniListFormat(data);
  if (aniListResult) return aniListResult;

  const comicVineResult = extractFromComicVineFormat(data);
  if (comicVineResult) return comicVineResult;

  // Generic object with URL property
  if (data["url"]) {
    return cleanImageUrl(data["url"] as string);
  }

  return '';
}
