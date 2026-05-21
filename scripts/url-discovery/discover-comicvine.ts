/**
 * ComicVine Discovery Provider Wrapper
 *
 * Wraps the project's ComicVine provider for use in the CSV discovery tool.
 *
 * @module url-discovery/discover-comicvine
 */

import { ComicVineProvider } from '../../src/server/services/search/providers/ComicVineProvider';
import type { ComicVineSearchResult } from '../../src/types/search.types';

/**
 * Result of ComicVine discovery.
 */
export interface ComicVineDiscoveryResult {
  /** The ComicVine volume ID */
  id: string | null;
  /** The ComicVine site URL */
  url: string | null;
  /** Time taken for discovery in milliseconds */
  timing: number;
  /** Error message if discovery failed */
  error?: string;
  /** Match confidence score (0-1) */
  confidence?: number;
}

/**
 * Calculate confidence score based on title matching.
 */
function calculateConfidence(query: string, resultTitle: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedResult = resultTitle.toLowerCase().trim();

  // Exact match
  if (normalizedQuery === normalizedResult) {
    return 1.0;
  }

  // One contains the other
  if (normalizedResult.includes(normalizedQuery) || normalizedQuery.includes(normalizedResult)) {
    return 0.8;
  }

  // Word overlap
  const queryWords = normalizedQuery.split(/\s+/);
  const resultWords = normalizedResult.split(/\s+/);
  const overlap = queryWords.filter(w => resultWords.includes(w)).length;
  const maxWords = Math.max(queryWords.length, resultWords.length);

  return overlap / maxWords;
}

/**
 * Discover ComicVine ID for a manga title.
 *
 * Uses the ComicVineProvider.search() method which:
 * - Searches for volumes matching the title
 * - Applies relevance ranking
 * - Returns structured results with IDs and URLs
 *
 * @param title - The manga title to search for
 * @param limit - Maximum number of results to consider (default: 5)
 * @returns Discovery result with ID, URL, and timing
 */
export async function discoverComicVine(
  title: string,
  limit = 5
): Promise<ComicVineDiscoveryResult> {
  const start = Date.now();

  try {
    const provider = new ComicVineProvider();
    const results = await provider.search(title, { limit });

    if (results.length === 0) {
      return { id: null, url: null, timing: Date.now() - start };
    }

    // Get the best match
    const best = results[0];
    if (!best) {
      return { id: null, url: null, timing: Date.now() - start };
    }

    // Extract ComicVine-specific fields
    const cvResult = best as ComicVineSearchResult;
    const id = cvResult.comicvineId ?? cvResult.volumeId?.toString() ?? best.id;
    const url = cvResult.siteDetailUrl ?? best.url ?? null;

    return {
      id,
      url,
      timing: Date.now() - start,
      confidence: calculateConfidence(title, best.title),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { id: null, url: null, timing: Date.now() - start, error: errorMessage };
  }
}

/**
 * Check if a value is a valid ComicVine ID.
 */
export function isValidComicVineId(id: string): boolean {
  // ComicVine IDs are typically numeric or in format "4050-XXXXX"
  return /^\d+$/.test(id) || /^4050-\d+$/.test(id);
}

/**
 * Normalize a ComicVine ID to just the numeric part.
 */
export function normalizeComicVineId(id: string): string {
  // Remove "4050-" prefix if present
  const match = id.match(/^(?:4050-)?(\d+)$/);
  return match?.[1] ?? id;
}
