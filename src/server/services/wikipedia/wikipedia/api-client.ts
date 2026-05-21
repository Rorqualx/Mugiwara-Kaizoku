/**
 * Wikipedia API Client Module
 *
 * Raw API calls to Wikipedia MediaWiki API.
 * No parsing logic - pure HTTP client functions.
 *
 * Features:
 * - Proper User-Agent header per Wikipedia API etiquette
 * - Request timeouts (30 seconds)
 * - Retry logic with exponential backoff for 429/503 responses
 * - Rate limiting awareness
 *
 * Extracted from: WikipediaService.ts (lines 179-249, 274-275, 603-604)
 */

import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import { logger } from '@/utils/logger';

import { API_BASE } from './utils';

import type { WikipediaApiResponse, WikipediaParseResponse } from './types';

// Wikipedia API requires a proper User-Agent header per their API etiquette
// See: https://www.mediawiki.org/wiki/API:Etiquette
const WIKIPEDIA_HEADERS = {
  'User-Agent': 'MugiwaraKaizoku/1.0 (https://github.com/mugiwara-kaizoku; manga-metadata-fetcher) axios/1.x',
  'Accept': 'application/json',
};

// Request configuration
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Check if an error is retryable (429 Too Many Requests or 503 Service Unavailable)
 */
function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status === 429 || status === 503;
  }
  return false;
}

/**
 * Get retry delay from Retry-After header or calculate exponential backoff
 */
function getRetryDelay(error: AxiosError, attempt: number): number {
  // Check for Retry-After header (Wikipedia may send this on 429)
  const headers = error.response?.headers as Record<string, string | undefined> | undefined;
  if (headers) {
    const retryAfter = headers['retry-after'];
    if (typeof retryAfter === 'string') {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
  }
  // Exponential backoff: 1s, 2s, 4s
  return INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Make an axios request with retry logic and timeout
 *
 * @param url - Request URL
 * @returns Promise with response data
 * @throws Will throw after max retries or on non-retryable errors
 */
async function fetchWithRetry<T>(url: string): Promise<AxiosResponse<T>> {
  const config: AxiosRequestConfig = {
    headers: WIKIPEDIA_HEADERS,
    timeout: REQUEST_TIMEOUT_MS,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Intentional: retry logic requires sequential attempts
      return await axios.get<T>(url, config);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isRetryableError(error) && attempt < MAX_RETRIES - 1) {
        const delay = getRetryDelay(error as AxiosError, attempt);
        logger.warn(`[WIKIPEDIA] Request rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms`, {
          url: url.substring(0, 100),
          status: axios.isAxiosError(error) ? error.response?.status : undefined,
        });
        // eslint-disable-next-line no-await-in-loop -- Intentional: retry delay between attempts
        await sleep(delay);
        continue;
      }

      // Log and throw non-retryable errors or final retry failure.
      // Surface error.code (ENOTFOUND / ECONNREFUSED / ETIMEDOUT) so DNS or
      // connectivity issues are diagnosable from the log line itself.
      if (axios.isAxiosError(error)) {
        logger.error(`[WIKIPEDIA] API request failed`, {
          url: url.substring(0, 100),
          status: error.response?.status,
          code: error.code,
          message: error.message,
          attempt: attempt + 1,
        });
      }
      throw error;
    }
  }

  // Should not reach here, but TypeScript needs this
  throw lastError ?? new Error('Unknown error during Wikipedia API request');
}

// ============================================================================
// Search Operations
// ============================================================================

/**
 * Search Wikipedia for manga pages using OpenSearch
 *
 * Performs two searches:
 * 1. OpenSearch for quick title matches
 * 2. Query for "List of X chapters" pages
 *
 * @param query - Search query (manga title)
 * @returns Raw Wikipedia OpenSearch response array [query, titles[], descriptions[], urls[]]
 * @throws Will throw after max retries or on non-retryable errors
 */
export async function searchMangaOpenSearch(
  query: string
): Promise<unknown> {
  const searchUrl = `${API_BASE}?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json`;
  const response = await fetchWithRetry<unknown>(searchUrl);
  return response.data;
}

/**
 * Get Wikipedia page extract for a specific title
 *
 * Fetches intro text and basic page metadata using extracts API.
 *
 * @param title - Wikipedia page title
 * @returns Wikipedia API response with page extract
 * @throws Will throw after max retries or on non-retryable errors
 */
export async function fetchPageExtract(title: string): Promise<WikipediaApiResponse> {
  const extractUrl = `${API_BASE}?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=true&explaintext=true&exsentences=3&format=json`;
  const response = await fetchWithRetry<WikipediaApiResponse>(extractUrl);
  return response.data;
}

/**
 * Search for chapter list pages
 *
 * Searches for "List of X chapters" pages using the query API.
 *
 * @param query - Base manga title to search for chapters
 * @returns Wikipedia API response with search results
 * @throws Will throw after max retries or on non-retryable errors
 */
export async function searchChapterListPage(query: string): Promise<WikipediaApiResponse> {
  const chapterListQuery = `List of ${query} chapters`;
  const chapterSearchUrl = `${API_BASE}?action=query&list=search&srsearch=${encodeURIComponent(chapterListQuery)}&srlimit=1&format=json`;
  const response = await fetchWithRetry<WikipediaApiResponse>(chapterSearchUrl);
  return response.data;
}

/**
 * Search result from Wikipedia search API
 */
export interface WikipediaSearchResult {
  title: string;
  pageid: number;
  size: number;
  snippet: string;
}

/**
 * Normalize a title for comparison (lowercase, remove special chars).
 */
function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Check if a page title is relevant to the manga title.
 * Filters false positives from fuzzy Wikipedia search.
 */
function isRelevantPageTitle(pageTitle: string, mangaTitle: string): boolean {
  const normalizedPage = normalizeForComparison(pageTitle);
  const normalizedManga = normalizeForComparison(mangaTitle);

  // Page title must contain the manga title (not just partial match)
  return normalizedPage.includes(normalizedManga);
}

/**
 * Process search results and filter by size, relevance, and duplicates.
 */
function processSearchResults(
  searchResults: WikipediaSearchResult[],
  mangaTitle: string,
  minSize: number,
  seenTitles: Set<string>,
  results: WikipediaSearchResult[]
): void {
  for (const result of searchResults) {
    const isRelevant = isRelevantPageTitle(result.title, mangaTitle);
    const isLargeEnough = result.size >= minSize;
    const isNew = !seenTitles.has(result.title);

    if (isRelevant && isLargeEnough && isNew) {
      seenTitles.add(result.title);
      results.push(result);
    }
  }
}

/**
 * Execute a single search query and collect results.
 */
async function executeSearchQuery(
  searchQuery: string,
  mangaTitle: string,
  minSize: number,
  seenTitles: Set<string>,
  results: WikipediaSearchResult[]
): Promise<void> {
  try {
    const url = `${API_BASE}?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&srnamespace=0&srlimit=10&srprop=size|snippet&format=json`;
    const response = await fetchWithRetry<WikipediaApiResponse>(url);

    const queryData = response.data.query as Record<string, unknown> | undefined;
    const searchResults = queryData?.['search'] as WikipediaSearchResult[] | undefined;

    if (searchResults) {
      processSearchResults(searchResults, mangaTitle, minSize, seenTitles, results);
    }
  } catch (error) {
    logger.warn('[WIKIPEDIA] Search failed', {
      query: searchQuery,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Search for all chapter/volume list pages for a manga title.
 *
 * Uses Wikipedia search API to find pages matching "List of {title} chapters"
 * or "List of {title} volumes". This catches variations like:
 * - List of Naruto chapters (Part I)
 * - List of Bleach chapters (424–686)
 * - List of One Piece chapters (187–388)
 *
 * @param title - Manga title to search for
 * @param minSize - Minimum page size to include (filters stubs/redirects)
 * @returns Array of matching page titles with their sizes
 */
export async function searchChapterListPages(
  title: string,
  minSize: number = 10000
): Promise<WikipediaSearchResult[]> {
  const results: WikipediaSearchResult[] = [];
  const seenTitles = new Set<string>();

  const searchQueries = [
    `intitle:"List of" intitle:"${title}" intitle:chapters`,
    `intitle:"List of" intitle:"${title}" intitle:volumes`,
  ];

  for (const searchQuery of searchQueries) {
    // eslint-disable-next-line no-await-in-loop -- Sequential search queries to avoid rate limiting
    await executeSearchQuery(searchQuery, title, minSize, seenTitles, results);
  }

  logger.debug('[WIKIPEDIA] Chapter list search complete', {
    title,
    minSize,
    found: results.length,
    results: results.map(r => ({ title: r.title, size: r.size })),
  });

  return results;
}

// ============================================================================
// Page Content Operations
// ============================================================================

/**
 * Fetch parsed page content (HTML)
 *
 * Gets the rendered HTML and section metadata for a page.
 * Used by getMangaInfo to extract details from the page.
 *
 * @param pageTitle - Wikipedia page title
 * @returns Wikipedia parse API response with HTML content
 * @throws Will throw after max retries or on non-retryable errors
 */
export async function fetchPageContent(pageTitle: string): Promise<WikipediaParseResponse> {
  const contentUrl = `${API_BASE}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text|sections&redirects&format=json`;
  const response = await fetchWithRetry<WikipediaParseResponse>(contentUrl);
  return response.data;
}

/**
 * Fetch parsed page content by page ID
 *
 * Gets the rendered HTML and section metadata using pageid.
 * Used by getChapterList and parseDisambiguationPage.
 *
 * @param pageId - Wikipedia page ID
 * @returns Wikipedia parse API response with HTML content
 * @throws Will throw after max retries or on non-retryable errors
 */
export async function fetchPageContentById(pageId: number): Promise<WikipediaParseResponse> {
  const contentUrl = `${API_BASE}?action=parse&pageid=${pageId}&prop=text&format=json`;
  const response = await fetchWithRetry<WikipediaParseResponse>(contentUrl);
  return response.data;
}

// ============================================================================
// Page Lookup Operations
// ============================================================================

/**
 * Look up a page by title to get its page ID
 *
 * Simple query to get page ID and basic metadata.
 * Used to check if a page exists before fetching its content.
 *
 * @param title - Wikipedia page title
 * @returns Wikipedia API response with page metadata
 * @throws Will throw after max retries or on non-retryable errors
 */
export async function lookupPageByTitle(title: string): Promise<WikipediaApiResponse> {
  const searchUrl = `${API_BASE}?action=query&titles=${encodeURIComponent(title)}&format=json`;
  const response = await fetchWithRetry<WikipediaApiResponse>(searchUrl);
  return response.data;
}

/**
 * Look up a page by pageid to get basic metadata
 *
 * Simple query to get page metadata by ID.
 * Used during redirect handling and pagination.
 *
 * @param pageId - Wikipedia page ID
 * @returns Wikipedia API response with page metadata
 * @throws Will throw after max retries or on non-retryable errors
 */
export async function lookupPageById(pageId: number): Promise<WikipediaApiResponse> {
  const searchUrl = `${API_BASE}?action=query&pageids=${pageId}&format=json`;
  const response = await fetchWithRetry<WikipediaApiResponse>(searchUrl);
  return response.data;
}

// ============================================================================
// Batch Operations (Optimized)
// ============================================================================

/**
 * Page info from batch lookup
 */
export interface BatchPageInfo {
  exists: boolean;
  pageId: number | null;
  title: string;
  size: number;
  missing?: boolean;
}

/**
 * Build redirect/normalization map from Wikipedia API response
 */
function buildTitleMappings(
  queryData: Record<string, unknown>
): { redirectMap: Map<string, string>; normalizedMap: Map<string, string> } {
  const redirectMap = new Map<string, string>();
  const normalizedMap = new Map<string, string>();

  const redirects = queryData['redirects'] as Array<{ from: string; to: string }> | undefined;
  for (const r of redirects ?? []) {
    redirectMap.set(r.from.replace(/ /g, '_'), r.to.replace(/ /g, '_'));
  }

  const normalized = queryData['normalized'] as Array<{ from: string; to: string }> | undefined;
  for (const n of normalized ?? []) {
    normalizedMap.set(n.from.replace(/ /g, '_'), n.to.replace(/ /g, '_'));
  }

  return { redirectMap, normalizedMap };
}

/**
 * Process page data from Wikipedia API response
 */
function processPageData(pageIdStr: string, pageData: Record<string, unknown>): BatchPageInfo {
  const pageId = parseInt(pageIdStr, 10);
  const title = String(pageData['title'] ?? '');
  const missing = pageData['missing'] === true;
  const revisions = pageData['revisions'] as Array<{ size?: number }> | undefined;
  const size = revisions?.[0]?.size ?? 0;
  const normalizedTitle = title.replace(/ /g, '_');

  return {
    exists: !missing && pageId !== -1,
    pageId: missing ? null : pageId,
    title: normalizedTitle,
    size,
    missing,
  };
}

/**
 * Resolve original title through normalization and redirect chains
 */
function resolveTitle(
  title: string,
  normalizedMap: Map<string, string>,
  redirectMap: Map<string, string>
): string {
  let resolved = title.replace(/ /g, '_');
  resolved = normalizedMap.get(resolved) ?? resolved;
  resolved = redirectMap.get(resolved) ?? resolved;
  return resolved;
}

/**
 * Map redirect results back to original requested titles
 */
function mapRedirectResults(
  batch: string[],
  result: Map<string, BatchPageInfo>,
  normalizedMap: Map<string, string>,
  redirectMap: Map<string, string>
): void {
  for (const requestedTitle of batch) {
    const normalizedRequested = requestedTitle.replace(/ /g, '_');
    const finalTitle = resolveTitle(requestedTitle, normalizedMap, redirectMap);

    if (finalTitle === normalizedRequested) continue;
    const targetInfo = result.get(finalTitle);
    if (!targetInfo) continue;

    result.set(normalizedRequested, { ...targetInfo, title: normalizedRequested });
  }
}

export async function batchLookupPages(
  titles: string[]
): Promise<Map<string, BatchPageInfo>> {
  const result = new Map<string, BatchPageInfo>();

  if (titles.length === 0) {
    return result;
  }

  const MAX_TITLES_PER_REQUEST = 50;
  const batches = chunkArray(titles, MAX_TITLES_PER_REQUEST);

  for (const batch of batches) {
    const titlesParam = batch.map(t => encodeURIComponent(t)).join('|');
    // Add redirects=1 to follow redirects and get actual page size
    const url = `${API_BASE}?action=query&titles=${titlesParam}&prop=revisions&rvprop=size&redirects=1&format=json`;

    // eslint-disable-next-line no-await-in-loop -- Intentional: batch requests must be sequential
    const response = await fetchWithRetry<WikipediaApiResponse>(url);
    const queryData = response.data.query as Record<string, unknown> | undefined;
    const pages = queryData?.['pages'] as Record<string, Record<string, unknown>> | undefined;

    if (!pages || !queryData) continue;

    const { redirectMap, normalizedMap } = buildTitleMappings(queryData);

    for (const [pageIdStr, pageData] of Object.entries(pages)) {
      const info = processPageData(pageIdStr, pageData);
      result.set(info.title, info);
    }

    mapRedirectResults(batch, result, normalizedMap, redirectMap);
  }

  // Set entries for titles not found in response
  for (const requestedTitle of titles) {
    const normalized = requestedTitle.replace(/ /g, '_');
    if (!result.has(normalized) && !result.has(requestedTitle)) {
      result.set(normalized, { exists: false, pageId: null, title: normalized, size: 0, missing: true });
    }
  }

  logger.debug('[WIKIPEDIA] Batch lookup complete', {
    requested: titles.length,
    found: [...result.values()].filter(p => p.exists).length,
  });

  return result;
}

/**
 * Check if pages exist and have sufficient content in a single API call.
 *
 * Combines existence check + content size verification to eliminate
 * the double-fetch pattern (lookupPageByTitle + checkPageHasContent).
 *
 * @param titles - Array of page titles to check
 * @param minSize - Minimum page size in bytes to consider "has content" (default 10000)
 * @returns Map of title → { exists, hasContent, size }
 */
export async function batchCheckPagesWithSize(
  titles: string[],
  minSize: number = 10000
): Promise<Map<string, { exists: boolean; hasContent: boolean; size: number }>> {
  const batchResult = await batchLookupPages(titles);
  const result = new Map<string, { exists: boolean; hasContent: boolean; size: number }>();

  for (const [title, info] of batchResult) {
    result.set(title, {
      exists: info.exists,
      hasContent: info.exists && info.size >= minSize,
      size: info.size,
    });
  }

  return result;
}

/**
 * Split an array into chunks of specified size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
