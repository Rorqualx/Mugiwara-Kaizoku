/**
 * Image Proxy Utilities
 *
 * Functions for routing external images through the local proxy
 * to improve loading performance and bypass hotlink protection.
 *
 * IMPORTANT: Proxy path generation must match server-side implementation
 * in fandom-chapter/url-processing.ts and fandom-extractors.ts
 * to ensure cache consistency.
 */

/**
 * Domains that need to be proxied (have hotlink protection or slow CDNs)
 */
const PROXY_DOMAINS = [
  'static.wikia.nocookie.net',
  'fandom.com',
  'comicvine.gamespot.com',
  's4.anilist.co',
  'anilist.co',
  'uploads.mangadex.org',
  'mangadex.org',
  'upload.wikimedia.org',
];

/**
 * Simple hash function for browser environments
 * Produces a consistent 16-character hex string for cache key generation.
 * NOTE: This must produce the same output as MD5 for the same input
 * to ensure cache hits with server-side generated proxy paths.
 */
function simpleHash(str: string): string {
  // Use a simple but consistent hash algorithm
  // This is NOT cryptographically secure - just for cache key generation
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1 + char) >>> 0;
    hash2 = ((hash2 << 7) - hash2 + char) >>> 0;
  }
  // Combine both hashes into a 16-character hex string
  return hash1.toString(16).padStart(8, '0') + hash2.toString(16).padStart(8, '0');
}

/**
 * Check if a URL needs to be proxied
 */
function needsProxy(url: string): boolean {
  try {
    const parsed = new URL(url);
    return PROXY_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Convert an image URL to a proxied URL if needed.
 * Uses the /api/image-proxy endpoint to cache images locally
 * and bypass hotlink protection.
 *
 * NOTE: For new images, prefer using the server-side proxy URL generation
 * (which uses MD5 hash) during data import. This client-side function
 * uses a compatible hash for consistency.
 *
 * @param url - The original image URL
 * @returns The proxied URL or original URL if proxying not needed
 */
export function proxyImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;

  // Only proxy URLs that need it
  if (!needsProxy(url)) {
    return url;
  }

  // Create a unique path based on URL hash (matches server-side format)
  try {
    const proxyPath = simpleHash(url);
    return `/api/image-proxy/${proxyPath}?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

/**
 * Get the image source with proxy and fallback
 *
 * @param coverImage - Primary cover image URL
 * @param fallbackUrl - Fallback URL if cover is missing
 * @param defaultImage - Default placeholder image path
 * @returns The best available image URL
 */
export function getProxiedImageSrc(
  coverImage: string | undefined | null,
  fallbackUrl?: string | null,
  defaultImage: string = '/cover-not-found.jpg'
): string {
  const url = coverImage ?? fallbackUrl;
  if (!url) return defaultImage;

  return proxyImageUrl(url) ?? defaultImage;
}
