/**
 * ComicVine Volume Operations
 *
 * Methods for retrieving and searching comic volume data.
 *
 * Extracted from: service.ts
 */

import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import * as modularQueries from '../modularQueries';

import type {
  ComicVineVolume,
  ComicVineIssue,
  ComicVineCharacter,
  ComicVineCreator,
  ComicVineResponse,
  ComicVineListResponse,
} from './types';

// ============================================================================
// HTTP Client Interface
// ============================================================================

/**
 * HTTP client interface for ComicVine API requests
 * Passed as dependency to enable testing and decoupling
 */
export interface ComicVineHttpClient {
  fetchWithRetry<T>(endpoint: string, params: Record<string, unknown>): Promise<T>;
}

/**
 * Initialize function type for ensuring client readiness
 */
export type InitializeFunction = () => Promise<boolean>;

// ============================================================================
// Volume Operations
// ============================================================================

/**
 * Get basic volume information by ID
 * This is a lightweight query for essential information
 *
 * @param httpClient - HTTP client for making API requests
 * @param initializeFn - Function to initialize the client
 * @param id - ComicVine volume ID
 * @returns Basic volume information or null
 */
export async function getBasicVolumeInfo(
  httpClient: ComicVineHttpClient,
  initializeFn: InitializeFunction,
  id: number
): Promise<ComicVineVolume | null> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, getting basic volume info may fail');
    }

    // Format the volume ID (ComicVine volume IDs are prefixed with 4050-)
    const volumeId = toStringId(id).includes('-') ? toStringId(id) : `4050-${id}`;

    // Execute the basic volume info query
    const response = await httpClient.fetchWithRetry<ComicVineResponse<ComicVineVolume>>(
      `/volume/${volumeId}`,
      modularQueries.basicVolumeInfoQuery(id)
    );

    return response.results;
  } catch (error: unknown) {
    logger.error(
      `ComicVine get basic volume info error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Get detailed volume information by ID
 * This includes comprehensive metadata but excludes relations and characters
 *
 * @param httpClient - HTTP client for making API requests
 * @param initializeFn - Function to initialize the client
 * @param id - ComicVine volume ID
 * @returns Detailed volume information or null
 */
export async function getDetailedVolumeInfo(
  httpClient: ComicVineHttpClient,
  initializeFn: InitializeFunction,
  id: number
): Promise<ComicVineVolume | null> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, getting detailed volume info may fail');
    }

    // Format the volume ID (ComicVine volume IDs are prefixed with 4050-)
    const volumeId = toStringId(id).includes('-') ? toStringId(id) : `4050-${id}`;

    // Execute the detailed volume info query
    const response = await httpClient.fetchWithRetry<ComicVineResponse<ComicVineVolume>>(
      `/volume/${volumeId}`,
      modularQueries.detailedVolumeInfoQuery(id)
    );

    return response.results;
  } catch (error: unknown) {
    logger.error(
      `ComicVine get detailed volume info error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Get complete volume information by ID
 * Retrieves all available information about a comic volume
 *
 * Features:
 * - Full metadata
 * - Character lists
 * - Creator credits
 * - Story arcs
 * - Related volumes
 * - Publication details
 *
 * @param httpClient - HTTP client for making API requests
 * @param initializeFn - Function to initialize the client
 * @param id - ComicVine volume ID
 * @returns Complete volume information or null
 */
export async function getCompleteVolumeInfo(
  httpClient: ComicVineHttpClient,
  initializeFn: InitializeFunction,
  id: number
): Promise<ComicVineVolume | null> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, getting complete volume info may fail');
    }

    // Format the volume ID (ComicVine volume IDs are prefixed with 4050-)
    const volumeId = toStringId(id).includes('-') ? toStringId(id) : `4050-${id}`;

    // Execute the complete volume info query
    const response = await httpClient.fetchWithRetry<ComicVineResponse<ComicVineVolume>>(
      `/volume/${volumeId}`,
      modularQueries.completeVolumeInfoQuery(id)
    );

    return response.results;
  } catch (error: unknown) {
    logger.error(
      `ComicVine get complete volume info error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Search for volumes with basic information
 * Performs a search query for comic volumes with essential metadata
 *
 * Features:
 * - Text search
 * - Pagination
 * - Result limiting
 * - Basic metadata
 *
 * @param httpClient - HTTP client for making API requests
 * @param initializeFn - Function to initialize the client
 * @param query - Search query text
 * @param page - Page number for pagination (default: 0)
 * @param limit - Results per page (default: 50)
 * @returns Array of matching volumes
 */
export async function searchBasicVolumes(
  httpClient: ComicVineHttpClient,
  initializeFn: InitializeFunction,
  query: string,
  page = 0,
  limit = 50
): Promise<ComicVineVolume[]> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, searching volumes may fail');
    }

    // Execute the search query
    const response = await httpClient.fetchWithRetry<ComicVineListResponse<ComicVineVolume>>(
      '/search',
      modularQueries.searchBasicVolumesQuery(query, page, limit)
    );

    return response.results;
  } catch (error: unknown) {
    logger.error(`ComicVine search error: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Get issues for a volume
 * Retrieves a list of issues belonging to a specific volume
 *
 * Features:
 * - Issue listing
 * - Pagination
 * - Result limiting
 * - Basic issue metadata
 *
 * @param httpClient - HTTP client for making API requests
 * @param initializeFn - Function to initialize the client
 * @param volumeId - ComicVine volume ID
 * @param page - Page number for pagination (default: 0)
 * @param limit - Results per page (default: 100)
 * @returns Array of volume issues
 */
export async function getVolumeIssues(
  httpClient: ComicVineHttpClient,
  initializeFn: InitializeFunction,
  volumeId: number,
  page = 0,
  limit = 100
): Promise<ComicVineIssue[]> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, getting volume issues may fail');
    }

    // Execute the volume issues query
    const response = await httpClient.fetchWithRetry<ComicVineListResponse<ComicVineIssue>>(
      '/issues',
      modularQueries.volumeIssuesQuery(volumeId, page, limit)
    );

    return response.results;
  } catch (error: unknown) {
    logger.error(
      `ComicVine get volume issues error: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/**
 * Get ALL issues for a volume (handles pagination automatically)
 * Fetches all issues for a volume, handling pagination transparently
 *
 * Note: Uses sequential await in loop for pagination to respect rate limits.
 * This is intentional - parallel requests would overwhelm the API.
 *
 * @param httpClient - HTTP client for making API requests
 * @param initializeFn - Function to initialize the client
 * @param volumeId - ComicVine volume ID
 * @returns Array of all volume issues
 */
export async function getAllVolumeIssues(
  httpClient: ComicVineHttpClient,
  initializeFn: InitializeFunction,
  volumeId: number
): Promise<ComicVineIssue[]> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, getting volume issues may fail');
    }

    const allIssues: ComicVineIssue[] = [];
    let page = 0;
    const limit = 100;
    let hasMore = true;

    // Sequential pagination - await in loop is intentional for rate limiting
    while (hasMore) {
      // eslint-disable-next-line no-await-in-loop -- Required for sequential pagination to respect rate limits
      const response = await httpClient.fetchWithRetry<ComicVineListResponse<ComicVineIssue>>(
        '/issues',
        modularQueries.volumeIssuesQuery(volumeId, page, limit)
      );

      if (response.results.length > 0) {
        allIssues.push(...response.results);
      }

      // Check if there are more pages
      const totalResults = response.number_of_total_results;
      const currentResults = page * limit + response.results.length;
      hasMore = currentResults < totalResults && response.results.length === limit;
      page++;

      // Safety check to prevent infinite loops (max 10 pages = 1000 issues)
      if (page >= 10) {
        logger.warn(`Stopping pagination at page ${page} for volume ${volumeId}`);
        break;
      }
    }

    logger.info(`Fetched ${allIssues.length} total issues for volume ${volumeId}`);
    return allIssues;
  } catch (error: unknown) {
    logger.error(
      `ComicVine get all volume issues error: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/**
 * Get characters for a volume
 * Retrieves a list of characters appearing in a specific volume
 *
 * Features:
 * - Character listing
 * - Pagination
 * - Result limiting
 * - Basic character info
 *
 * @param httpClient - HTTP client for making API requests
 * @param initializeFn - Function to initialize the client
 * @param volumeId - ComicVine volume ID
 * @param page - Page number for pagination (default: 0)
 * @param limit - Results per page (default: 100)
 * @returns Array of volume characters
 */
export async function getVolumeCharacters(
  httpClient: ComicVineHttpClient,
  initializeFn: InitializeFunction,
  volumeId: number,
  page = 0,
  limit = 100
): Promise<ComicVineCharacter[]> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, getting volume characters may fail');
    }

    // Execute the volume characters query
    const response = await httpClient.fetchWithRetry<ComicVineListResponse<ComicVineCharacter>>(
      '/characters',
      modularQueries.volumeCharactersQuery(volumeId, page, limit)
    );

    return response.results;
  } catch (error: unknown) {
    logger.error(
      `ComicVine get volume characters error: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/**
 * Get creators for a volume
 * Retrieves a list of creators who worked on a specific volume
 *
 * Features:
 * - Creator listing
 * - Pagination
 * - Result limiting
 * - Role information
 *
 * @param httpClient - HTTP client for making API requests
 * @param initializeFn - Function to initialize the client
 * @param volumeId - ComicVine volume ID
 * @param page - Page number for pagination (default: 0)
 * @param limit - Results per page (default: 100)
 * @returns Array of volume creators
 */
export async function getVolumeCreators(
  httpClient: ComicVineHttpClient,
  initializeFn: InitializeFunction,
  volumeId: number,
  page = 0,
  limit = 100
): Promise<ComicVineCreator[]> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, getting volume creators may fail');
    }

    // Execute the volume creators query
    const response = await httpClient.fetchWithRetry<ComicVineListResponse<ComicVineCreator>>(
      '/people',
      modularQueries.volumeCreatorsQuery(volumeId, page, limit)
    );

    return response.results;
  } catch (error: unknown) {
    logger.error(
      `ComicVine get volume creators error: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}
