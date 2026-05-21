/**
 * Image Validation Module
 *
 * Validation functions for image URLs, formats, and dimensions.
 *
 * Extracted from: index.ts (lines 182-222, 419-479)
 */

// ============================================================================
// URL Validation Functions
// ============================================================================

/**
 * Validate if a URL is a valid image URL
 */
export function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // Check for common image extensions
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
  if (imageExtensions.test(url)) {
    return true;
  }

  // Check for known image hosting services
  const imageHosts = [
    'imgur.com',
    'imgbb.com',
    'cloudinary.com',
    'amazonaws.com',
    'googleusercontent.com',
    'discordapp.com',
    'vignette.wikia.nocookie.net',
    'static.wikia.nocookie.net',
    'mangadex.org',
    'anilist.co',
    'comicvine.gamespot.com'
  ];

  return imageHosts.some(host => url.includes(host));
}

/**
 * Extract image format from URL
 */
export function getImageFormat(url: string): string | undefined {
  const match = url.match(/\.([a-z]+)(?:\?|$)/i);
  return match?.[1] ? match[1].toLowerCase() : undefined;
}

// ============================================================================
// Dimension Validation Functions
// ============================================================================

/**
 * Validate image dimensions
 */
export function validateImageDimensions(
  width: number | undefined,
  height: number | undefined,
  options: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    aspectRatio?: { min: number; max: number };
  } = {}
): boolean {
  if (!width || !height) return false;

  // Check minimum dimensions
  if (options.minWidth && width < options.minWidth) return false;
  if (options.minHeight && height < options.minHeight) return false;

  // Check maximum dimensions
  if (options.maxWidth && width > options.maxWidth) return false;
  if (options.maxHeight && height > options.maxHeight) return false;

  // Check aspect ratio
  if (options.aspectRatio) {
    const ratio = width / height;
    if (ratio < options.aspectRatio.min || ratio > options.aspectRatio.max) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Special URL Type Checks
// ============================================================================

/**
 * Check if URL is a data URI
 */
export function isDataUri(url: string): boolean {
  return url.startsWith('data:');
}

/**
 * Check if URL is a placeholder image
 */
export function isPlaceholderImage(url: string): boolean {
  const placeholderPatterns = [
    /placeholder/i,
    /no-image/i,
    /default-image/i,
    /blank\.(jpg|png|gif)/i,
    /1x1\.(jpg|png|gif)/i,
    /transparent\.(jpg|png|gif)/i
  ];

  return placeholderPatterns.some(pattern => pattern.test(url));
}
