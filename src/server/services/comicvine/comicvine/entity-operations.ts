/**
 * ComicVine Entity Operations
 *
 * Methods for retrieving comic entity data (issues, characters, creators).
 *
 * Extracted from: service.ts
 */

import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import * as modularQueries from '../modularQueries';

import type {
  ComicVineIssue,
  ComicVineCharacter,
  ComicVineCreator,
  ComicVineResponse
} from './types';

// ============================================================================
// HTTP Client Interface
// ============================================================================

/**
 * HTTP Client interface for ComicVine API requests
 *
 * @interface ComicVineHttpClient
 * @property {Function} fetchWithRetry - Method to execute API requests with retry logic
 */
export interface ComicVineHttpClient {
  fetchWithRetry<T>(url: string, params: Record<string, unknown>): Promise<T>;
}

// ============================================================================
// Entity Operations
// ============================================================================

/**
 * Get issue information by ID
 * Retrieves detailed information about a specific comic issue
 *
 * @param {ComicVineHttpClient} httpClient - HTTP client instance
 * @param {() => Promise<boolean>} initializeFn - Initialization function
 * @param {number} id - ComicVine issue ID
 * @returns {Promise<ComicVineIssue | null>} Issue information or null
 *
 * @example
 * ```typescript
 * const issue = await getIssueInfo(httpClient, initFn, 12345);
 * if (issue) {
 *   logger.info(`Issue: ${issue.name} #${issue.issue_number}`);
 * }
 * ```
 */
export async function getIssueInfo(
  httpClient: ComicVineHttpClient,
  initializeFn: () => Promise<boolean>,
  id: number
): Promise<ComicVineIssue | null> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, getting issue info may fail');
    }

    // Format the issue ID (ComicVine issue IDs are prefixed with 4000-)
    const issueId = toStringId(id).includes('-') ? toStringId(id) : `4000-${id}`;

    const response = await httpClient.fetchWithRetry<ComicVineResponse<ComicVineIssue>>(
      `/issue/${issueId}`,
      modularQueries.issueInfoQuery(id)
    );

    return response.results;
  } catch (error: unknown) {
    logger.error(`ComicVine get issue info error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get character information by ID
 * Retrieves detailed information about a comic character
 *
 * Features:
 * - Character biography
 * - Appearance history
 * - Related volumes
 * - Publisher info
 * - Origin details
 *
 * @param {ComicVineHttpClient} httpClient - HTTP client instance
 * @param {() => Promise<boolean>} initializeFn - Initialization function
 * @param {number} id - ComicVine character ID
 * @returns {Promise<ComicVineCharacter | null>} Character information or null
 *
 * @example
 * ```typescript
 * const character = await getCharacterInfo(httpClient, initFn, 12345);
 * if (character) {
 *   logger.info(`Character: ${character.name}`);
 *   logger.info(`Real Name: ${character.real_name}`);
 *   logger.info(`Publisher: ${character.publisher?.name}`);
 * }
 * ```
 */
export async function getCharacterInfo(
  httpClient: ComicVineHttpClient,
  initializeFn: () => Promise<boolean>,
  id: number
): Promise<ComicVineCharacter | null> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, getting character info may fail');
    }

    // Format the character ID (ComicVine character IDs are prefixed with 4005-)
    const characterId = toStringId(id).includes('-') ? toStringId(id) : `4005-${id}`;

    const response = await httpClient.fetchWithRetry<ComicVineResponse<ComicVineCharacter>>(
      `/character/${characterId}`,
      modularQueries.characterInfoQuery(id)
    );

    return response.results;
  } catch (error: unknown) {
    logger.error(`ComicVine get character info error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get creator information by ID
 * Retrieves detailed information about a comic creator
 *
 * Features:
 * - Creator biography
 * - Work history
 * - Volume credits
 * - Issue credits
 * - Personal details
 *
 * @param {ComicVineHttpClient} httpClient - HTTP client instance
 * @param {() => Promise<boolean>} initializeFn - Initialization function
 * @param {number} id - ComicVine creator ID
 * @returns {Promise<ComicVineCreator | null>} Creator information or null
 *
 * @example
 * ```typescript
 * const creator = await getCreatorInfo(httpClient, initFn, 12345);
 * if (creator) {
 *   logger.info(`Creator: ${creator.name}`);
 *   logger.info(`Country: ${creator.country}`);
 *   logger.info(`Volumes: ${creator.volume_credits?.length}`);
 * }
 * ```
 */
export async function getCreatorInfo(
  httpClient: ComicVineHttpClient,
  initializeFn: () => Promise<boolean>,
  id: number
): Promise<ComicVineCreator | null> {
  try {
    const isInitialized = await initializeFn();
    if (!isInitialized) {
      logger.warn('ComicVine client not initialized, getting creator info may fail');
    }

    // Format the creator ID (ComicVine person IDs are prefixed with 4040-)
    const creatorId = toStringId(id).includes('-') ? toStringId(id) : `4040-${id}`;

    const response = await httpClient.fetchWithRetry<ComicVineResponse<ComicVineCreator>>(
      `/person/${creatorId}`,
      modularQueries.creatorInfoQuery(id)
    );

    return response.results;
  } catch (error: unknown) {
    logger.error(`ComicVine get creator info error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
