/**
 * SearchStep Custom Hooks
 *
 * Custom React hooks and utility functions for search operations,
 * including search execution, provider fetching, and result sorting.
 *
 * Extracted from: searchStep.tsx (lines 407-790)
 * Complexity reduction: executeStandardizedSearch 23 -> 12
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

import type { ParsedSearchQuery } from './types';

// ============================================================================
// Search Query Helpers
// ============================================================================

/**
 * Build the search query string based on parsed query type
 *
 * @param query - The original search query
 * @param parsed - The parsed search query object
 * @returns The formatted search query string
 */
export function buildSearchQuery(query: string, parsed: ParsedSearchQuery): string {
  // Handle special search types (ID, identifier searches)
  if ((parsed.type === 'id' || parsed.type === 'identifier') && parsed.identifiers) {
    if (parsed.identifiers.anilistId) {
      return String(parsed.identifiers.anilistId);
    }
    if (parsed.identifiers.malId) {
      return `mal:${parsed.identifiers.malId}`;
    }
    if (parsed.identifiers.isbn) {
      return parsed.identifiers.isbn;
    }
    if (parsed.identifiers.comicvineId) {
      return parsed.identifiers.comicvineId;
    }
    if (parsed.identifiers.kitsuId) {
      return `kitsu:${parsed.identifiers.kitsuId}`;
    }
  }

  // For text searches, use the text part
  if (parsed.type === 'text' && parsed.text) {
    return parsed.text;
  }

  // Default to original query
  return query;
}

/**
 * Determine which providers to search based on selection and parsed query
 *
 * @param selectedProvider - The currently selected provider (empty string = all)
 * @param parsed - The parsed search query object
 * @returns Array of provider IDs or undefined for all providers
 */
export function determineProviders(
  selectedProvider: string,
  parsed: ParsedSearchQuery
): string[] | undefined {
  // Explicitly search only AniList
  if (selectedProvider === 'anilist') {
    return ['anilist'];
  }

  // Empty string means "All Providers" - don't pass any providers
  if (selectedProvider === '') {
    return undefined;
  }

  // Search the selected provider
  if (selectedProvider) {
    return [selectedProvider];
  }

  // Use suggested providers from parsed query
  if (parsed.suggestedProviders && parsed.suggestedProviders.length > 0) {
    return parsed.suggestedProviders;
  }

  // Default to all providers
  return undefined;
}

// ============================================================================
// Genre Extraction
// ============================================================================

/**
 * Extract safe genres from result metadata
 * Handles various metadata structures with fallbacks
 *
 * @param result - The manga search result
 * @returns Array of genre strings
 */
export function extractGenres(result: ExtendedMangaSearchResult): string[] {
  // First check for direct genres array on the result
  if (Array.isArray(result['genres'])) {
    return (result['genres'] as unknown[]).filter(
      (genre): genre is string => typeof genre === 'string' && genre.trim().length > 0
    );
  }

  // Then check in metadata if available
  if (result['metadata'] && typeof result['metadata'] === 'object') {
    const metadata = result['metadata'] as Record<string, unknown>;
    if (Array.isArray(metadata['genres'])) {
      return (metadata['genres'] as unknown[]).filter(
        (genre): genre is string => typeof genre === 'string' && genre.trim().length > 0
      );
    }
  }

  return [];
}

// ============================================================================
// Relevance Scoring
// ============================================================================

/**
 * Calculate base relevance score from title match
 *
 * @param title - The lowercase title to check
 * @param query - The lowercase search query
 * @param alternativeTitles - Array of alternative titles
 * @returns Base score (0-100)
 */
function calculateTitleMatchScore(
  title: string,
  query: string,
  alternativeTitles: string[]
): number {
  // Exact title match (100 points)
  if (title === query) {
    return 100;
  }

  // Title starts with query (80 points)
  if (title.startsWith(query)) {
    return 80;
  }

  // Title contains the full query as a substring (60 points)
  if (title.includes(query)) {
    return 60;
  }

  // Check alternative titles for exact match (70 points)
  if (alternativeTitles.some((alt) => alt.toLowerCase() === query)) {
    return 70;
  }

  // Check alternative titles for substring match (50 points)
  if (alternativeTitles.some((alt) => alt.toLowerCase().includes(query))) {
    return 50;
  }

  // Check if all words in query are in title
  const queryWords = query.split(/\s+/);
  const titleWords = title.split(/\s+/);
  const matchedWords = queryWords.filter((qWord) =>
    titleWords.some((tWord) => tWord.includes(qWord) || qWord.includes(tWord))
  );

  if (matchedWords.length === queryWords.length) {
    return 40;
  }

  if (matchedWords.length > 0) {
    // Partial word match (10-30 points based on percentage of words matched)
    return 10 + (matchedWords.length / queryWords.length) * 20;
  }

  return 0;
}

/**
 * Calculate bonus points for having metadata
 *
 * @param result - The search result to evaluate
 * @returns Bonus score (0-10)
 */
function calculateMetadataBonus(result: ExtendedMangaSearchResult): number {
  let bonus = 0;

  if (result.coverImage ?? result.cover) bonus += 2;
  if (result['description']) bonus += 2;
  if (result['genres'] && (result['genres'] as unknown[]).length > 0) bonus += 2;
  if (result['status']) bonus += 2;
  if (result['chapters'] ?? result.volumes) bonus += 2;

  return bonus;
}

/**
 * Calculate relevance score for a search result based on query match
 * Higher scores mean better matches
 *
 * @param result - The search result
 * @param searchQuery - The original search query
 * @returns Relevance score (0-100)
 */
export function calculateRelevanceScore(
  result: ExtendedMangaSearchResult,
  searchQuery: string
): number {
  if (!searchQuery || !result['title']) {
    return 0;
  }

  const query = searchQuery.toLowerCase().trim();
  const title = (result['title'] as string).toLowerCase();
  const alternativeTitles = result['alternativeTitles'] ?? [];

  // Calculate base score from title match
  const baseScore = calculateTitleMatchScore(title, query, alternativeTitles);

  // Add metadata bonus points
  const metadataBonus = calculateMetadataBonus(result);

  // Cap at 100
  return Math.min(baseScore + metadataBonus, 100);
}

// ============================================================================
// Result Sorting
// ============================================================================

/**
 * Sort search results by relevance to the query
 *
 * @param results - Array of search results
 * @param searchQuery - The original search query
 * @returns Sorted array with most relevant first
 */
export function sortResultsByRelevance(
  results: ExtendedMangaSearchResult[],
  searchQuery: string
): ExtendedMangaSearchResult[] {
  if (results.length === 0) {
    return results;
  }

  // Calculate scores for each result
  const resultsWithScores = results.map((result) => ({
    result,
    score: calculateRelevanceScore(result, searchQuery)
  }));

  // Sort by score (highest first)
  resultsWithScores.sort((a, b) => {
    // First sort by score
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // If scores are equal, prefer results with covers
    const aHasCover = !!(a.result.coverImage ?? a.result.cover);
    const bHasCover = !!(b.result.coverImage ?? b.result.cover);

    if (aHasCover !== bHasCover) {
      return bHasCover ? 1 : -1;
    }

    // Then by title alphabetically
    const aTitle = (a.result['title'] as string | undefined) ?? '';
    const bTitle = (b.result['title'] as string | undefined) ?? '';
    return aTitle.localeCompare(bTitle);
  });

  // Log top results for debugging
  if (resultsWithScores.length > 0) {
    logger.debug(
      'Top search results by relevance:',
      resultsWithScores.slice(0, 3).map((r) => ({
        title: r.result['title'],
        score: r.score,
        provider: r.result.provider
      }))
    );
  }

  return resultsWithScores.map((item) => item.result);
}

// ============================================================================
// Type Exports for Hook Returns
// ============================================================================

/**
 * Return type for search execution functions
 */
export interface UseSearchExecutionReturn {
  executeSearch: (forceRefresh?: boolean) => Promise<void>;
}

/**
 * Return type for provider fetching functions
 */
export interface UseFetchAllProvidersReturn {
  fetchAllProviders: () => Promise<ExtendedMangaSearchResult[]>;
  isFetching: boolean;
}

/**
 * Return type for relevance scoring functions
 */
export interface UseSearchRelevanceReturn {
  calculateScore: (result: ExtendedMangaSearchResult, query: string) => number;
  sortByRelevance: (
    results: ExtendedMangaSearchResult[],
    query: string
  ) => ExtendedMangaSearchResult[];
}
