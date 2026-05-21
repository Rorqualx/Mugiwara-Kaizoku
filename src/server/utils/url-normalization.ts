/**
 * URL Normalization Utilities
 *
 * Centralized URL normalization to prevent duplicates and ensure consistent
 * URL handling across the codebase.
 *
 * @module url-normalization
 */

/**
 * Normalize a URL for deduplication/comparison.
 * Removes query params, fragments, trailing slashes, normalizes protocol.
 *
 * @param url - The URL to normalize
 * @returns Normalized URL string for comparison
 *
 * @example
 * normalizeUrlForComparison('http://example.com/path/?q=1#anchor')
 * // Returns: 'https://example.com/path'
 */
export function normalizeUrlForComparison(url: string): string {
  try {
    const parsed = new URL(url);
    // Clear fragments and query params
    parsed.hash = '';
    parsed.search = '';
    // Normalize to https
    parsed.protocol = 'https:';
    // Remove trailing slash except for root
    let href = parsed.href;
    if (href.endsWith('/') && parsed.pathname !== '/') {
      href = href.slice(0, -1);
    }
    return href.toLowerCase();
  } catch {
    // Fallback for malformed URLs
    return url.toLowerCase().trim();
  }
}

/**
 * Check if a URL is valid.
 *
 * @param url - The URL string to validate
 * @returns true if the URL is valid, false otherwise
 *
 * @example
 * isValidUrl('https://example.com') // true
 * isValidUrl('not-a-url') // false
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a relative href to an absolute URL using the URL API.
 * Properly handles complex relative paths like `../../path`.
 *
 * @param href - The href to resolve (relative or absolute)
 * @param baseUrl - The base URL origin (e.g., https://example.com)
 * @param pageUrl - The current page URL (for resolving relative paths)
 * @returns Absolute URL string, or null for anchor links
 *
 * @example
 * resolveHrefSafe('../../other', 'https://wiki.com', 'https://wiki.com/a/b/c')
 * // Returns: 'https://wiki.com/a/other'
 */
export function resolveHrefSafe(
  href: string,
  baseUrl: string,
  pageUrl: string
): string | null {
  // Skip anchor-only links
  if (href.startsWith('#')) {
    return null;
  }

  try {
    // The URL constructor handles all relative path resolution correctly
    // including ../../ paths when given a proper base URL
    return new URL(href, pageUrl).href;
  } catch {
    // Fallback for malformed URLs
    if (href.startsWith('/')) {
      return baseUrl + href;
    }
    if (href.startsWith('http')) {
      return href;
    }
    return null;
  }
}

/**
 * Resolve a URL from various formats (absolute, protocol-relative, root-relative, relative).
 * Uses the URL API for proper resolution.
 *
 * @param url - The URL to resolve (may be undefined)
 * @param baseUrl - The base URL to resolve against
 * @returns Resolved absolute URL string, or undefined if invalid
 *
 * @example
 * resolveUrlSafe('//cdn.example.com/img.jpg', 'https://wiki.com/page')
 * // Returns: 'https://cdn.example.com/img.jpg'
 */
export function resolveUrlSafe(
  url: string | undefined,
  baseUrl: string
): string | undefined {
  if (!url) return undefined;

  try {
    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      const base = new URL(baseUrl);
      return base.protocol + url;
    }

    // Use URL constructor for proper resolution
    return new URL(url, baseUrl).href;
  } catch {
    // Return as-is if we can't resolve
    return url;
  }
}
