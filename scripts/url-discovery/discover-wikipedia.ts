/**
 * Wikipedia Discovery Provider Wrapper
 *
 * Wraps the project's Wikipedia URL discoverer for use in the CSV discovery tool.
 *
 * @module url-discovery/discover-wikipedia
 */

import { discoverWikipediaUrls } from '../../src/server/services/wikipedia/adaptive/url-discoverer';

/**
 * Result of Wikipedia URL discovery.
 */
export interface WikipediaDiscoveryResult {
  /** The discovered URL (list page preferred) */
  url: string | null;
  /** Time taken for discovery in milliseconds */
  timing: number;
  /** Error message if discovery failed */
  error?: string;
  /** The type of page found */
  pageType?: 'list-page' | 'main-article' | 'section-anchor' | 'unknown';
}

/**
 * Discover Wikipedia URL for a manga title.
 *
 * Uses the project's Wikipedia URL discoverer which:
 * - Tries multiple URL patterns (List_of_{title}_volumes, etc.)
 * - Generates title variations for better matching
 * - Prefers list pages over main articles
 *
 * @param title - The manga title to search for
 * @param timeoutMs - Optional timeout in milliseconds (default: 10000)
 * @returns Discovery result with URL and timing
 */
export async function discoverWikipedia(
  title: string,
  timeoutMs = 10000
): Promise<WikipediaDiscoveryResult> {
  const start = Date.now();

  try {
    const result = await discoverWikipediaUrls(title, {
      preferListPage: true,
      timeoutMs,
    });

    // Prefer list page, fall back to main article
    const url = result.primaryUrl ?? result.listPageUrl ?? result.mainArticleUrl;

    return {
      url,
      timing: Date.now() - start,
      pageType: result.pageType,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      url: null,
      timing: Date.now() - start,
      error: errorMessage,
    };
  }
}

/**
 * Check if a URL is a valid Wikipedia URL.
 */
export function isValidWikipediaUrl(url: string): boolean {
  return url.includes('wikipedia.org/wiki/');
}

/**
 * Extract the page title from a Wikipedia URL.
 */
export function extractWikipediaPageTitle(url: string): string | null {
  const match = url.match(/\/wiki\/([^#?]+)/);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1].replace(/_/g, ' '));
}
