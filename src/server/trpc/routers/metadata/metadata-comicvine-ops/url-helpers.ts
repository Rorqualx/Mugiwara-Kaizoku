/**
 * ComicVine URL Parsing Helpers
 *
 * Functions for extracting IDs from ComicVine URLs.
 */

/**
 * Extract volume ID from a ComicVine URL
 * ComicVine uses different prefixes:
 * - /4050-XXXXX/ for volume/series pages
 * - /4000-XXXXX/ for individual issue pages
 *
 * @param url - ComicVine URL
 * @returns Volume ID number or null if not found
 */
export function extractVolumeIdFromUrl(url: string): number | null {
  // Match /4050-XXXXX/ pattern (volume/series pages)
  const volumeMatch = url.match(/\/4050-(\d+)/);
  if (volumeMatch?.[1]) {
    return parseInt(volumeMatch[1], 10);
  }
  // /4000-XXXXX/ pattern is for individual issues, not volumes
  // We can't directly get volume data from issue URLs via API
  return null;
}
