/**
 * Patterns indicating unwanted images (logos, badges, UI elements)
 */
export const UNWANTED_IMAGE_PATTERNS = [
  'logo', 'badge', 'apple', 'google', 'amazon', 'play-store', 'app-store',
  'facebook', 'twitter', 'instagram', 'social', 'icon-', 'icon_', 'btn-', 'button-',
  'sprite', 'wiki.png', 'wikia.png', 'fandom-heart', 'community-header',
  'favicon', 'thumbnail-', 'thumb-', 'avatar', 'profile-pic', 'profile_pic',
  'ui-', 'widget-', 'ad-', 'advertisement', 'banner-ad', 'site-logo',
  'wikia-logo', 'wordmark', 'emblem', 'seal', 'sticker',
  'emoji', 'emoticon', 'arrow', 'bullet', 'dot-', 'loading',
  '32x32', '64x64', '16x16', '48x48', 'tiny', 'mini', 'micro', 'small-icon',
  'notification', 'alert-', 'spinner', 'loader', 'placeholder'
];

/**
 * Patterns indicating magazine or promotional images (should be kept)
 */
export const MAGAZINE_PATTERNS = ['issue', 'wsm', 'magazine', 'promotional', 'promo', 'fbof'];

/**
 * Check if URL matches unwanted image patterns (logos, badges, UI elements)
 */
export function isUnwantedImage(url: string): string | null {
  const lowerUrl = url.toLowerCase();
  return UNWANTED_IMAGE_PATTERNS.find(pattern => lowerUrl.includes(pattern)) ?? null;
}

/**
 * Check if image dimensions in URL indicate a too-small image
 */
export function isTooSmallByDimensions(url: string): boolean {
  // Check explicit dimensions in path
  const sizeMatch = url.match(/\/(\d+)x(\d+)\//);
  if (sizeMatch?.[1] && sizeMatch[2]) {
    const width = parseInt(sizeMatch[1], 10);
    const height = parseInt(sizeMatch[2], 10);
    if (width < 100 || height < 100) return true;
  }

  // Check scale-to-width-down parameter
  const scaleMatch = url.match(/scale-to-width-down\/(\d+)/);
  if (scaleMatch?.[1] && parseInt(scaleMatch[1], 10) < 100) return true;

  return false;
}

/**
 * Extract filename from Fandom/wiki URL for pattern matching
 */
export function extractFilenameFromUrl(url: string): string {
  const match = url.match(/\/images\/[a-f0-9]\/[a-f0-9]{2}\/([^/]+)\//i);
  if (match?.[1]) return decodeURIComponent(match[1]).toLowerCase();
  // Fallback: get last segment before query params
  const lastSlash = url.lastIndexOf('/');
  const queryStart = url.indexOf('?', lastSlash);
  const segment = queryStart > 0
    ? url.substring(lastSlash + 1, queryStart)
    : url.substring(lastSlash + 1);
  return segment.toLowerCase();
}

/**
 * Check if image appears to be a magazine cover or promotional image
 */
export function isMagazineImage(filename: string, url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return MAGAZINE_PATTERNS.some(pattern => filename.includes(pattern) || lowerUrl.includes(pattern));
}

/**
 * Check if filename matches volume cover patterns
 */
export function isVolumeLikeFilename(filename: string): boolean {
  const volumeFilenamePattern = /^volume(?:_|\s|%20|-)?\d+\./i;
  const volFilenamePattern = /^vol(?:_|\.|\s|%20|-)?\d+\./i;
  const fireForceFilenamePattern = /^fire(?:_|\s|%20|-)?force(?:_|\s|%20|-)?\d+\./i;

  return volumeFilenamePattern.test(filename) ||
         volFilenamePattern.test(filename) ||
         fireForceFilenamePattern.test(filename);
}
