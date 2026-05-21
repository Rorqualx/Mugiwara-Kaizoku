/**
 * Image Optimization Module
 *
 * Functions for image optimization, CDN handling, and responsive image generation.
 *
 * Extracted from: index.ts (lines 481-571)
 */

// ============================================================================
// Image Optimization Functions
// ============================================================================

/**
 * Generate optimized image URL with size parameters
 */
export function generateOptimizedUrl(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
  } = {}
): string {
  if (!url) return '';

  // Handle Fandom/Wikia URLs
  if (url.includes('vignette.wikia.nocookie.net') || url.includes('static.wikia.nocookie.net')) {
    // Add scale-to-width parameter
    if (options.width) {
      let optimizedUrl = url.replace(/\/scale-to-width-down\/\d+/, '');
      optimizedUrl += `/scale-to-width-down/${options.width}`;
      return optimizedUrl;
    }
    return url;
  }

  // Handle Wikimedia URLs
  if (url.includes('upload.wikimedia.org')) {
    // Extract filename and path
    const match = url.match(/^(.*\/)(\d+px-)?([^/]+)$/);
    if (match && options.width) {
      return `${match[1]}${options.width}px-${match[3]}`;
    }
  }

  return url;
}

/**
 * Get image CDN URL if available
 */
export function getCdnUrl(url: string, cdnBase?: string): string {
  if (!url || !cdnBase) return url;

  // If already a CDN URL, return as is
  if (url.includes('cdn.') || url.includes('cloudinary') || url.includes('imgix')) {
    return url;
  }

  // Convert to CDN URL
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    return cdnBase + path;
  } catch {
    return url;
  }
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(
  baseUrl: string,
  sizes: number[] = [320, 640, 960, 1280, 1920]
): string {
  if (!baseUrl) return '';

  return sizes
    .map(size => {
      const optimizedUrl = generateOptimizedUrl(baseUrl, { width: size });
      return `${optimizedUrl} ${size}w`;
    })
    .join(', ');
}
