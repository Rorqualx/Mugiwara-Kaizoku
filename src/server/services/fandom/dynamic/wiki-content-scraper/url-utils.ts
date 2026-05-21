/**
 * URL Utilities Module
 *
 * Purpose: URL resolution and normalization utilities for wiki content scraping.
 *
 * Extracted from: WikiContentScraper.ts (lines 250-263, 648-669)
 *
 * Functions:
 * - resolveHref: Resolves relative/absolute hrefs to full URLs
 * - resolveUrl: Normalizes and resolves various URL formats (http, //, /, relative)
 *
 * Used for: Converting wiki page links to absolute URLs for fetching and processing
 */

/**
 * Resolve href attribute to full URL
 *
 * Handles:
 * - Absolute paths starting with /
 * - Anchors starting with # (returns null, same-page navigation)
 * - Full URLs starting with http
 * - Relative paths including ../../ (resolved against page URL using URL API)
 *
 * @param href - The href attribute value from a link element
 * @param baseUrl - The base URL origin (e.g., https://example.com)
 * @param pageUrl - The current page URL (for resolving relative paths)
 * @returns Full URL string, or null if it's an anchor link
 */
export function resolveHref(href: string, baseUrl: string, pageUrl: string): string | null {
  // Skip anchor-only links (same-page navigation)
  if (href.startsWith('#')) {
    return null;
  }

  try {
    // Use URL API for proper resolution - handles ../../ paths correctly
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
 * Resolve and normalize URL from various formats
 *
 * Handles:
 * - Full URLs (http/https)
 * - Protocol-relative URLs (//)
 * - Absolute paths (/)
 * - Relative paths including ../../ (resolved against base URL using URL API)
 *
 * @param url - The URL to resolve (may be undefined)
 * @param baseUrl - The base URL to resolve against
 * @returns Resolved URL string, or undefined if url is undefined or invalid
 */
export function resolveUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined;

  try {
    // Handle protocol-relative URLs specially
    if (url.startsWith('//')) {
      const base = new URL(baseUrl);
      return base.protocol + url;
    }

    // Use URL API for proper resolution - handles all relative paths correctly
    return new URL(url, baseUrl).href;
  } catch {
    // Return as-is if we can't resolve
    return url;
  }
}
