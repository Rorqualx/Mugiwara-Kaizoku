'use client';
/**
 * Client-side wrapper for search functionality
 *
 * This module provides a client-side abstraction for search functionality,
 * preventing server/client boundary issues by ensuring search operations
 * only happen on the client side.
 */
import type { SearchResult } from '@/server/services/search/types';
import { ValidationError } from '@/utils/errors';

import { logger } from '../logging';

import { processSearchResults } from './searchResultGuards';

// Helper interfaces for API responses
interface DebugEndpointResponse {
  results?: unknown[];
  resultCount?: number;
  provider?: string;
  query?: string;
}

// tRPC batch response structure interfaces
interface TrpcResultData {
  json?: unknown[];
  [key: string]: unknown;
}

interface TrpcResult {
  data?: TrpcResultData | unknown[];
}

interface TrpcBatchItem {
  result?: TrpcResult;
}

// Helper functions for safe property access
function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

function safeGetString(obj: unknown, key: string): string | undefined {
  const value = safeGet(obj, key);
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Type guard for tRPC batch response
function isTrpcBatchResponse(data: unknown): data is TrpcBatchItem[] {
  return Array.isArray(data) && data.length > 0 &&
    typeof data[0] === 'object' && data[0] !== null;
}

// Helper function to build tRPC URL
function buildTrpcUrl(providerId: string, query: string, limit?: number): string {
  const normalizedProviderId = providerId.toUpperCase();
  const json: Record<string, unknown> = {
    "provider": normalizedProviderId,
    "query": query,
    // Default limit to 10 to prevent flooding the UI with irrelevant results
    "limit": limit ?? 10
  };
  const input = encodeURIComponent(JSON.stringify({
    "0": { "json": json }
  }));
  return `/api/trpc/search.withProvider?batch=1&input=${input}`;
}

// Helper function to extract results from tRPC response
function parseTrpcResponse(data: unknown): unknown[] {
  if (!isTrpcBatchResponse(data)) {
    return [];
  }

  const firstItem = data[0];
  if (!firstItem?.result?.data) {
    return [];
  }

  const resultData = firstItem.result.data;

  // Check if data has a json property (tRPC v10 structure)
  if (isRecord(resultData) && 'json' in resultData) {
    const json = resultData.json;
    return Array.isArray(json) ? json : [];
  }

  // Otherwise treat data as the results directly
  if (Array.isArray(resultData)) {
    return resultData;
  }

  return [];
}

// Helper function to log first result for debugging
function logFirstTrpcResult(results: unknown[], providerId: string): void {
  if (results.length === 0) {
    return;
  }

  const firstResult = results[0];
  if (!isRecord(firstResult)) {
    return;
  }

  logger.debug(`First tRPC result for ${providerId}:`, {
    id: safeGet(firstResult, 'id'),
    title: safeGetString(firstResult, 'title'),
    hasUrl: 'url' in firstResult,
    hasWikiUrl: 'wikiUrl' in firstResult,
    url: safeGetString(firstResult, 'url'),
    wikiUrl: safeGetString(firstResult, 'wikiUrl'),
    allKeys: Object.keys(firstResult)
  });
}

// Helper function to log tRPC response structure
function logTrpcResponseStructure(data: unknown): void {
  if (!Array.isArray(data)) {
    logger.info(`tRPC response structure:`, {
      isArray: false,
      dataLength: 'not an array',
      firstItemKeys: 'no first item',
      hasResult: 'no',
      hasData: 'no',
      rawData: JSON.stringify(data).substring(0, 200)
    });
    return;
  }

  const firstItem: unknown = data[0];
  const hasFirstItem = firstItem !== null && firstItem !== undefined;
  const firstItemRecord = isRecord(firstItem) ? firstItem : null;
  const result = firstItemRecord ? safeGet(firstItemRecord, 'result') : null;
  const resultRecord = isRecord(result) ? result : null;
  const resultData = resultRecord ? safeGet(resultRecord, 'data') : null;

  logger.info(`tRPC response structure:`, {
    isArray: true,
    dataLength: data.length,
    firstItemKeys: hasFirstItem && isRecord(firstItem) ? Object.keys(firstItem) : 'no first item',
    hasResult: result ? 'yes' : 'no',
    hasData: resultData ? 'yes' : 'no',
    rawData: JSON.stringify(data).substring(0, 200)
  });
}

/**
 * Client-side provider for manga searches
 *
 * This class handles the client-side aspects of searching manga
 * from various providers, preventing server/client mismatches.
 */
export class ClientSearchProvider {
    /**
     * Search for manga using a specific provider
     *
     * @param providerId - ID of the provider to search with
     * @param query - Search query string
     * @returns Promise with search results or empty array on error
     */
    static async search(providerId: string, query: string): Promise<SearchResult[]> {
        try {
            logger.info(`Executing search for "${query}" with provider "${providerId}"`);
            // Use only the tRPC endpoint (debug endpoint doesn't exist)
            const startTime = Date.now();
            const results = await this.searchWithTrpcEndpoint(providerId, query);
            const endTime = Date.now();
            logger.info(`tRPC search took ${endTime - startTime}ms`);
            // Process and return the results
            logger.info(`Search for "${query}" with provider "${providerId}" returned ${results.length} results`);

            // Debug log to check if URLs are in the raw results before processing
            if (providerId === 'FANDOM' && results.length > 0) {
                const firstResult = results[0];
                if (isRecord(firstResult)) {
                    logger.info('[ClientSearchProvider] Raw FANDOM results before processing:', {
                        firstResult: {
                            id: safeGet(firstResult, 'id'),
                            title: safeGetString(firstResult, 'title'),
                            hasWikiUrl: 'wikiUrl' in firstResult,
                            wikiUrl: safeGetString(firstResult, 'wikiUrl') ?? 'NO WIKIURL',
                            hasUrl: 'url' in firstResult,
                            url: safeGetString(firstResult, 'url') ?? 'NO URL',
                            allKeys: Object.keys(firstResult)
                        }
                    });
                }
            }

            // processSearchResults returns the server SearchResult type, cast it to client type
            return processSearchResults(results, providerId) as unknown as SearchResult[];
        }
        catch (error: unknown) {
            // Enhanced error logging with categorization
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
                logger.error(`Search timeout (${providerId}):`, errorMessage);
            }
            else if (errorMessage.includes('Network Error') || errorMessage.includes('fetch failed')) {
                logger.error(`Network error during search (${providerId}):`, errorMessage);
            }
            else if (errorMessage.includes('client-only function')) {
                logger.error(`Client/server boundary error (${providerId}):`, errorMessage);
            }
            else {
                logger.error(`Unexpected search error (${providerId}):`, errorMessage);
            }
            throw error; // Re-throw to allow the calling code to handle the error
        }
    }
    /**
     * Search with both debug and tRPC endpoints
     *
     * This method attempts to use both the debug and tRPC endpoints,
     * falling back from one to the other if needed.
     *
     * @param providerId - Provider ID to search with
     * @param query - Search query string
     * @returns Array of search results
     */
    private static async searchWithBothEndpoints(providerId: string, query: string): Promise<unknown[]> {
        // First try with the debug endpoint
        try {
            logger.debug(`Trying debug endpoint for "${query}" with provider "${providerId}"`);
            const debugResults = await this.searchWithDebugEndpoint(providerId, query);
            if (debugResults.length > 0) {
                logger.debug(`Debug endpoint returned ${debugResults.length} results`);
                return debugResults;
            }
            logger.debug(`Debug endpoint returned no results, falling back to tRPC endpoint`);
        }
        catch (debugError: unknown) {
            logger.warn(`Debug endpoint search failed: ${debugError instanceof Error ? debugError.message : String(debugError)}`);
            logger.debug(`Falling back to tRPC endpoint for search`);
        }
        // If debug endpoint failed or returned no results, try tRPC endpoint
        try {
            logger.debug(`Trying tRPC endpoint for "${query}" with provider "${providerId}"`);
            const trpcResults = await this.searchWithTrpcEndpoint(providerId, query);
            logger.debug(`tRPC endpoint returned ${trpcResults.length} results`);
            return trpcResults;
        }
        catch (trpcError: unknown) {
            logger.error(`tRPC endpoint search failed: ${trpcError instanceof Error ? trpcError.message : String(trpcError)}`);
            // If both endpoints failed, throw an error
            throw new Error(`Search failed with both endpoints: ${trpcError instanceof Error ? trpcError.message : String(trpcError)}`);
        }
    }
    /**
     * Search using the debug endpoint
     *
     * @param providerId - Provider ID to search with
     * @param query - Search query string
     * @returns Array of search results
     */
    private static async searchWithDebugEndpoint(providerId: string, query: string): Promise<unknown[]> {
        // Build the URL for the debug endpoint
        const apiUrl = `/api/debug/search-test?provider=${encodeURIComponent(providerId)}&query=${encodeURIComponent(query)}`;
        logger.info(`Sending search request to debug endpoint: ${apiUrl}`);
        // Execute the search with timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        try {
            // Make the fetch request
            const response = await fetch(apiUrl, {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
            });
            // Clear the timeout
            clearTimeout(timeoutId);
            // Check if the response is OK
            if (!response.ok) {
                throw new ValidationError(`Debug endpoint request failed with status ${response.status}`);
            }
            // Parse the JSON response
            const data = await response.json() as DebugEndpointResponse;
            // Extract the results from the debug endpoint format
            if (data.results && Array.isArray(data.results)) {
                return data.results;
            }
            else if (data.resultCount !== undefined && Array.isArray(data.results)) {
                return data.results;
            }
            else if (isRecord(data) && 'provider' in data && 'query' in data && 'results' in data) {
                const results = safeGet(data, 'results');
                return Array.isArray(results) ? (results as unknown[]) : [];
            }
            // If we couldn't extract results, return empty array
            return [];
        }
        catch (error: unknown) {
            // Handle abort error specifically
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Debug endpoint search timed out');
            }
            throw error;
        }
    }
    /**
     * Search using the tRPC endpoint
     *
     * @param providerId - Provider ID to search with
     * @param query - Search query string
     * @returns Array of search results
     */
    private static async searchWithTrpcEndpoint(providerId: string, query: string): Promise<unknown[]> {
        // Ensure provider ID is uppercase for Prisma enum compatibility
        const normalizedProviderId = providerId.toUpperCase();

        // Build the URL for the tRPC endpoint
        const trpcUrl = buildTrpcUrl(providerId, query);
        logger.info(`Sending search request to tRPC endpoint: search.withProvider for provider ${normalizedProviderId} (original: ${providerId})`);

        // Execute the search with timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

        try {
            // Make the fetch request
            const response = await fetch(trpcUrl, {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
            });
            // Clear the timeout
            clearTimeout(timeoutId);
            // Check if the response is OK
            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`tRPC endpoint failed with status ${response.status}:`, errorText.substring(0, 500));
                throw new ValidationError(`tRPC endpoint request failed with status ${response.status}`);
            }

            // Parse the JSON response with proper typing
            const data: unknown = await response.json();

            // Log the raw response for debugging
            logTrpcResponseStructure(data);

            // Extract the results from the tRPC response format
            const results = parseTrpcResponse(data);

            if (results.length > 0) {
                logger.info(`Extracted ${results.length} results from tRPC response`);
                logFirstTrpcResult(results, providerId);
                return results;
            }

            // Try alternative response structure (non-batched)
            if (data && !Array.isArray(data)) {
                logger.info(`Non-batched response detected, returning data directly`);
                return [data];
            }

            // Log if we couldn't extract results
            logger.warn(`Could not extract results from tRPC response:`, JSON.stringify(data).substring(0, 500));

            // If we couldn't extract results, return empty array
            return [];
        }
        catch (error: unknown) {
            // Handle abort error specifically
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('tRPC endpoint search timed out');
            }
            throw error;
        }
    }
    /**
     * Search across multiple providers
     *
     * @param providers - Array of provider IDs to search
     * @param query - Search query string
     * @returns Promise with combined search results
     */
    static async searchMultiple(providers: string[], query: string): Promise<SearchResult[]> {
        if (!providers.length) {
            return [];
        }
        try {
            // Search all providers in parallel
            const searchPromises = providers.map(providerId => this.search(providerId, query));
            // Wait for all searches to complete
            const resultsArrays = await Promise.allSettled(searchPromises);
            // Combine results, handling any rejected promises
            return resultsArrays
                .flatMap((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                }
                else {
                    logger.error(`Search failed for provider ${providers[index]}:`, result.reason);
                    return [];
                }
            });
        }
        catch (error: unknown) {
            logger.error('Multi-provider search error:', error instanceof Error ? error.message : String(error));
            return [];
        }
    }
}
/**
 * Get available search providers
 *
 * @returns Array of default provider IDs
 */
export function getDefaultProviders(): string[] {
    // These are the default providers that should be available
    return ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'];
}
/**
 * Check if a provider is a valid search provider
 *
 * @param providerId - Provider ID to check
 * @returns Boolean indicating if the provider is valid
 */
export function isValidProvider(providerId: string): boolean {
    return getDefaultProviders().includes(providerId);
}
/**
 * Get available provider names for display
 *
 * @returns Array of provider objects with ID and name
 */
export function getProviderOptions(): {
    id: string;
    name: string;
    status: string;
}[] {
    return [
        { id: 'anilist', name: 'AniList', status: 'active' },
        { id: 'comicvine', name: 'ComicVine', status: 'active' },
        { id: 'fandom', name: 'Fandom', status: 'active' },
        { id: 'wikipedia', name: 'Wikipedia', status: 'active' }
    ];
}
