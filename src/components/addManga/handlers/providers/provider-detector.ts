/**
 * Provider Detection Utility
 *
 * Detects metadata provider from URL patterns.
 *
 * @module providers/provider-detector
 */

/**
 * Detects the provider from a URL
 * @param url - URL to analyze
 * @returns Provider name or null if not recognized
 */
export function detectProviderFromUrl(url: string): 'fandom' | 'comicvine' | 'wikipedia' | 'mangadex' | null {
  if (url.includes('fandom.com')) return 'fandom';
  if (url.includes('comicvine.gamespot.com')) return 'comicvine';
  if (url.includes('wikipedia.org')) return 'wikipedia';
  if (url.includes('mangadex.org')) return 'mangadex';
  return null;
}
