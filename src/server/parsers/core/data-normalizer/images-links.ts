/**
 * Image and Link Normalization Module
 *
 * Processes and normalizes image and link data from extracted content.
 * Maps image and link types to standardized categories.
 *
 * Extracted from: DataNormalizer.ts (lines 514-583)
 */

import type {
  NormalizedImage,
  ExternalLink,
  ExtractedImage,
  ExtractedLink,
} from './types';

// ============================================================================
// Image Normalization
// ============================================================================

/**
 * Normalize image data array
 *
 * Transforms extracted images into normalized format with standardized types
 * and consolidated description fields.
 */
export function normalizeImages(images: ExtractedImage[] | undefined): NormalizedImage[] {
  // Handle undefined images gracefully
  if (!images || !Array.isArray(images)) {
    return [];
  }

  return images.map(img => {
    const normalized: NormalizedImage = {
      url: img.url,
      type: normalizeImageType(img.type)
    };

    // Add description only if it has a value
    const description = img.caption ?? img.alt ?? img.title;
    if (description) {
      normalized.description = description;
    }

    return normalized;
  });
}

/**
 * Map extracted image type to normalized type
 *
 * Converts various extracted image type values to standard normalized categories.
 */
export function normalizeImageType(type: ExtractedImage['type']): NormalizedImage['type'] {
  switch (type) {
    case 'cover': return 'cover';
    case 'gallery': return 'gallery';
    case 'character': return 'character';
    default: return 'other';
  }
}

// ============================================================================
// Link Normalization
// ============================================================================

/**
 * Normalize link data array
 *
 * Filters and transforms extracted links into external link format.
 * Only processes links marked as 'external' or 'related'.
 *
 * Note: Removed unnecessary null check (line 550 ESLint fix) since
 * parameter is typed as ExtractedLink[] and cannot be null/undefined.
 */
export function normalizeLinks(links: ExtractedLink[]): ExternalLink[] {
  return links
    .filter(link => link.type === 'external' || link.type === 'related')
    .map(link => {
      const linkType = normalizeLinkType(link);
      if (link.text) {
        return {
          url: link.url,
          type: linkType,
          label: link.text
        };
      }
      return {
        url: link.url,
        type: linkType,
        label: 'External Link'
      };
    });
}

/**
 * Determine link type from URL patterns
 *
 * Analyzes URL to categorize link type based on common patterns:
 * - official: URLs containing 'official' or '.jp' domains
 * - wiki: URLs containing 'wiki'
 * - database: URLs for manga databases (mangadex, anilist, myanimelist)
 * - store: URLs for stores (amazon, etc.)
 * - other: Default for unrecognized patterns
 */
export function normalizeLinkType(link: ExtractedLink): ExternalLink['type'] {
  const url = link.url.toLowerCase();

  if (url.includes('official') || url.includes('.jp')) return 'official';
  if (url.includes('wiki')) return 'wiki';
  if (url.includes('mangadex') || url.includes('anilist') || url.includes('myanimelist')) return 'database';
  if (url.includes('amazon') || url.includes('store')) return 'store';

  return 'other';
}
