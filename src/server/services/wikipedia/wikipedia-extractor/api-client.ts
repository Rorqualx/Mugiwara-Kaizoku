/**
 * Wikipedia API Client
 *
 * HTTP client for Wikipedia REST API operations.
 * Handles page existence checks, link extraction, and HTML retrieval.
 *
 * Features:
 * - Proper User-Agent header per Wikipedia API etiquette
 * - Request timeouts (30 seconds)
 * - Retry logic with exponential backoff for 429/503 responses
 *
 * Extracted from: wikipediaVolumeExtractor.ts
 */

import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import { logger } from '@/utils/logger';

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
        logger.warn(`[WIKIPEDIA-EXTRACTOR] Request rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms`, {
          url: url.substring(0, 100),
          status: axios.isAxiosError(error) ? error.response?.status : undefined,
        });
        // eslint-disable-next-line no-await-in-loop -- Intentional: retry delay between attempts
        await sleep(delay);
        continue;
      }

      // Log and throw non-retryable errors or final retry failure
      if (axios.isAxiosError(error)) {
        logger.error(`[WIKIPEDIA-EXTRACTOR] API request failed`, {
          url: url.substring(0, 100),
          status: error.response?.status,
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
// Type Definitions for Wikipedia API Responses
// ============================================================================

export interface WikipediaApiResponse {
    query?: {
        pages?: Record<string, WikipediaPage>;
    };
}

export interface WikipediaPage {
    missing?: boolean;
    title?: string;
    links?: Array<{ title?: string }>;
}

export interface WikipediaParseResponse {
    parse?: {
        text?: {
            '*'?: string;
        };
    };
}

// ============================================================================
// Type Guards
// ============================================================================

function isWikipediaPage(value: unknown): value is WikipediaPage {
    return (
        typeof value === 'object' &&
        value !== null &&
        ('missing' in value || 'title' in value || 'links' in value)
    );
}

// ============================================================================
// Wikipedia API Client Class
// ============================================================================

export class WikipediaApiClient {
    private readonly apiBase = 'https://en.wikipedia.org/w/api.php';

    /**
     * Check if a Wikipedia page exists
     *
     * @param title - Wikipedia page title
     * @returns Promise<boolean> - True if page exists, false otherwise
     */
    async pageExists(title: string): Promise<boolean> {
        try {
            const url = `${this.apiBase}?action=query&titles=${encodeURIComponent(title)}&format=json&origin=*`;
            const response = await fetchWithRetry<unknown>(url);

            const data = response.data as WikipediaApiResponse;
            if (!data.query?.pages) return false;

            const pagesArray = Object.values(data.query.pages).filter(isWikipediaPage);
            return !pagesArray.some(page => page.missing);
        } catch {
            return false;
        }
    }

    /**
     * Get links from a Wikipedia page
     *
     * @param title - Wikipedia page title
     * @returns Promise<string[]> - Array of linked page titles
     */
    async getPageLinks(title: string): Promise<string[]> {
        try {
            const url = `${this.apiBase}?action=query&titles=${encodeURIComponent(title)}&prop=links&pllimit=max&format=json&origin=*`;
            const response = await fetchWithRetry<unknown>(url);

            const data = response.data as WikipediaApiResponse;
            if (!data.query?.pages) return [];

            const pagesArray = Object.values(data.query.pages).filter(isWikipediaPage);
            const firstPage = pagesArray[0];
            if (!firstPage?.links) return [];

            return firstPage.links
                .map(link => link.title)
                .filter((title): title is string => typeof title === 'string');
        } catch {
            return [];
        }
    }

    /**
     * Get parsed HTML content of a Wikipedia page
     *
     * @param title - Wikipedia page title
     * @returns Promise<string | null> - HTML content or null if not found/error
     */
    async getPageHtml(title: string): Promise<string | null> {
        try {
            const url = `${this.apiBase}?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&origin=*`;
            const response = await fetchWithRetry<unknown>(url);

            const data = response.data as WikipediaParseResponse;
            const htmlContent = data.parse?.text?.['*'];
            return typeof htmlContent === 'string' ? htmlContent : null;
        } catch (error: unknown) {
            // fetchWithRetry already logs errors, just return null for graceful degradation
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.debug(`[WIKIPEDIA-EXTRACTOR] getPageHtml failed for "${title}": ${errorMessage}`);
            return null;
        }
    }
}

// Export singleton instance
export const wikipediaApiClient = new WikipediaApiClient();

// Export helper functions for backward compatibility
export const fetchPageContent = async (title: string): Promise<string | null> => {
    return wikipediaApiClient.getPageHtml(title);
};

export const lookupPageByTitle = async (title: string): Promise<boolean> => {
    return wikipediaApiClient.pageExists(title);
};
