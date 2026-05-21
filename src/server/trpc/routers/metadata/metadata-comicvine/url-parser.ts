/**
 * URL Parser Module
 *
 * Parses ComicVine URLs to extract IDs and determine resource types.
 */

/**
 * Parse ComicVine URL to extract ID and type
 * @param url - ComicVine URL to parse
 * @returns Object with id and type, or null if invalid
 */
export function parseComicvineUrl(url: string): { id: string; type: 'volume' | 'issue' } | null {
  if (!url.includes('comicvine.gamespot.com')) {
    return null;
  }

  // Extract ID from URL patterns:
  // Volume: https://comicvine.gamespot.com/fire-force/4050-104877/
  // Issue: https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/
  const issueMatch = url.match(/4000-(\d+)/);
  const volumeMatch = url.match(/4050-(\d+)/);

  if (issueMatch?.[1]) {
    return { id: issueMatch[1], type: 'issue' };
  }

  if (volumeMatch?.[1]) {
    return { id: volumeMatch[1], type: 'volume' };
  }

  return null;
}
