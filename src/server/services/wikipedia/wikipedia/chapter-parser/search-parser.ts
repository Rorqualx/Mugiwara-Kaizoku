/**
 * Search Parser Module
 *
 * Searches for chapter list pages when direct lookup fails.
 * Provides fallback strategy for finding chapter data.
 */

import { fetchPageContentById, searchChapterListPages } from '@/server/services/wikipedia/wikipedia/api-client';
import type { WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';
import { logger } from '@/utils/logger';
import { hasProperty, isObject, isString } from '@/utils/type-guards';

/**
 * Search result from Wikipedia API
 */
interface SearchResult {
  title?: unknown;
  pageid?: unknown;
}

/**
 * Validates if a search result is relevant for chapter extraction
 */
function isRelevantSearchResult(result: unknown): result is SearchResult {
  if (!isObject(result)) return false;
  if (!hasProperty(result, 'title') || !isString(result['title'])) return false;
  if (!result['title'].toLowerCase().includes('chapter')) return false;
  if (!hasProperty(result, 'pageid')) return false;
  return true;
}

/**
 * Extracts HTML content from page data
 */
function extractHtmlContent(pageData: unknown): string | null {
  if (!isObject(pageData) || !hasProperty(pageData, 'parse')) return null;

  const parsedData = pageData['parse'];
  if (!isObject(parsedData) || !hasProperty(parsedData, 'text')) return null;

  const textData = parsedData['text'];
  if (!isObject(textData) || !hasProperty(textData, '*')) return null;

  const htmlContent = textData['*'];
  return isString(htmlContent) ? htmlContent : null;
}

/**
 * Processes a single search result to extract chapters
 */
async function processSearchResult(
  result: SearchResult,
  parseChapterTables: (html: string) => WikipediaChapter[]
): Promise<WikipediaChapter[]> {
  const pageData = await fetchPageContentById(result.pageid as number);
  const htmlContent = extractHtmlContent(pageData);

  if (!htmlContent) return [];

  const chapters = parseChapterTables(htmlContent);
  return chapters;
}

/**
 * Fetches search results from Wikipedia API using the protected api-client.
 * Uses searchChapterListPages which has proper User-Agent headers and retry logic.
 */
async function fetchSearchResults(mangaTitle: string): Promise<unknown[]> {
  const results = await searchChapterListPages(mangaTitle, 0);
  return results;
}

/**
 * Search for chapter list pages
 *
 * Performs a Wikipedia search for pages containing "chapters" and the manga title.
 * Tries each result until a page with valid chapter data is found.
 * Uses the generic chapter table parser to extract chapters.
 *
 * @param mangaTitle - Manga title to search for
 * @param parseChapterTables - Function to parse chapter tables
 * @returns Array of chapters from the best matching page
 */
export async function searchChapterList(
  mangaTitle: string,
  parseChapterTables: (html: string) => WikipediaChapter[]
): Promise<WikipediaChapter[]> {
  try {
    const searchResults = await fetchSearchResults(mangaTitle);
    if (searchResults.length === 0) return [];

    // Filter to relevant results
    const relevantResults = searchResults.filter(isRelevantSearchResult);
    if (relevantResults.length === 0) return [];

    // Process all relevant results in parallel
    const processingPromises = relevantResults.map((result) =>
      processSearchResult(result, parseChapterTables)
    );
    const results = await Promise.allSettled(processingPromises);

    // Return the first successful result with chapters
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        return result.value;
      }
    }

    return [];
  } catch (error: unknown) {
    logger.error(
      `Wikipedia searchChapterList error: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}
