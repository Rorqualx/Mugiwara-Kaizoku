/**
 * Image URL Processing Module
 *
 * URL cleaning and resolution functions for various image providers.
 * Handles provider-specific URL patterns and converts relative URLs to absolute.
 *
 * Extracted from: index.ts (lines 40-180)
 */

import { logger } from '@/utils/logger';

// ============================================================================
// URL Cleaning Functions
// ============================================================================

/**
 * Clean and normalize image URLs from various providers
 * Unified version of cleanWikiaImageUrl and similar functions
 */
export function cleanImageUrl(url: string | undefined, baseUrl?: string): string {
  if (!url) return '';

  // Remove common URL parameters that affect image quality
  let cleanedUrl = url
    .replace(/\/revision\/.*$/, '')           // Wikia/Fandom revision parameters
    .replace(/\/scale-to-width-down\/\d+/, '') // Wikia/Fandom scaling
    .replace(/\?.*$/, '')                      // Remove all query parameters
    .replace(/\/thumb\//, '/');                // Remove thumbnail indicator

  // Handle provider-specific URL patterns
  cleanedUrl = cleanWikiaUrl(cleanedUrl);
  cleanedUrl = cleanAniListUrl(cleanedUrl);
  cleanedUrl = cleanComicVineUrl(cleanedUrl);

  // Resolve relative URLs
  if (baseUrl && !cleanedUrl.startsWith('http')) {
    cleanedUrl = resolveUrl(cleanedUrl, baseUrl);
  }

  return cleanedUrl;
}

/**
 * Clean Wikia/Fandom specific image URLs
 */
function cleanWikiaUrl(url: string): string {
  if (url.includes('vignette.wikia.nocookie.net') ||
      url.includes('static.wikia.nocookie.net') ||
      url.includes('fandom.com')) {
    // Remove scaling parameters
    let cleanedUrl = url.replace(/\/scale-to-width-down\/\d+/, '');
    cleanedUrl = cleanedUrl.replace(/\/scale-to-height-down\/\d+/, '');

    // Remove revision info
    const cleanUrl = cleanedUrl.split('?')[0];
    if (!cleanUrl) return cleanedUrl;

    // Remove thumbnail path if present
    return cleanUrl.replace('/thumb/', '/').replace(/\/\d+px-[^/]+$/, '');
  }
  return url;
}

/**
 * Clean AniList image URLs
 */
function cleanAniListUrl(url: string): string {
  if (url.includes('anilist.co') || url.includes('s4.anilist.co')) {
    // AniList provides different sizes, extract the largest
    let cleanedUrl = url;
    if (cleanedUrl.includes('/medium/')) {
      cleanedUrl = cleanedUrl.replace('/medium/', '/large/');
    }
    if (cleanedUrl.includes('/small/')) {
      cleanedUrl = cleanedUrl.replace('/small/', '/large/');
    }
    return cleanedUrl;
  }
  return url;
}

/**
 * Clean ComicVine image URLs
 */
function cleanComicVineUrl(url: string): string {
  if (url.includes('comicvine.gamespot.com')) {
    // ComicVine has different image sizes
    // Replace scale parameters to get original
    let cleanedUrl = url.replace('scale_small', 'original');
    cleanedUrl = cleanedUrl.replace('scale_medium', 'original');
    cleanedUrl = cleanedUrl.replace('scale_large', 'original');
    cleanedUrl = cleanedUrl.replace('scale_avatar', 'original');
    return cleanedUrl;
  }
  return url;
}

// ============================================================================
// URL Resolution Functions
// ============================================================================

/**
 * Resolve relative URLs to absolute URLs
 */
export function resolveUrl(url: string | undefined, baseUrl?: string): string {
  if (!url) return '';

  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Protocol-relative
  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  // No base URL provided
  if (!baseUrl) {
    return url;
  }

  // Parse base URL
  try {
    const base = new URL(baseUrl);

    // Absolute path
    if (url.startsWith('/')) {
      return base.origin + url;
    }

    // Relative path
    const basePath = base.pathname.endsWith('/')
      ? base.pathname
      : base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);

    return base.origin + basePath + url;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error resolving URL:', errorMessage);
    return url;
  }
}
