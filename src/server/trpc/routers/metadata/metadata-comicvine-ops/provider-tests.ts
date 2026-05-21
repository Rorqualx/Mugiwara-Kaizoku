/**
 * Provider Connection Tests
 *
 * Functions for testing metadata provider connections.
 */

import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  validateComicVineError,
  validateComicVineStatusCode,
  validateComicVineResults,
  handleComicVineTestError
} from './validation-helpers';

/**
 * Test ComicVine provider connection with API key validation
 *
 * @param apiKey - ComicVine API key to test
 * @returns AsyncResult with boolean success or error
 */
export async function testComicVineProvider(apiKey: string): Promise<AsyncResult<boolean, Error>> {
  const { comicvineService } = await import('../../../../services/comicvine/service');

  try {
    const timestamp = Date.now();
    const testQuery = `Spider-Man test ${timestamp}`;
    logger.info(`Testing ComicVine API with query: ${testQuery}`);

    const result = await comicvineService.searchVolumes({
      query: testQuery,
      apiKey: apiKey,
      limit: 1
    });

    if (!result) {
      logger.warn('ComicVine API returned null response');
      return createErrorResult(new Error('Invalid response from ComicVine API. Please check your API key.'));
    }

    const resultObj = result as Record<string, unknown>;

    // Validate error field
    const errorValidation = validateComicVineError(resultObj);
    if (errorValidation) return errorValidation;

    logger.info(`ComicVine API response status_code: ${resultObj['status_code']}, error: ${resultObj['error']}`);

    // Validate status code
    const statusValidation = validateComicVineStatusCode(resultObj);
    if (statusValidation) return statusValidation;

    // Validate results
    const resultsValidation = validateComicVineResults(resultObj);
    if (resultsValidation) return resultsValidation;

    logger.warn('ComicVine API returned unexpected response structure');
    return createErrorResult(new Error('Unexpected response from ComicVine API. Please verify your API key.'));
  } catch (error: unknown) {
    return handleComicVineTestError(error);
  }
}

/**
 * Test AniList provider connection
 *
 * @returns AsyncResult with boolean success or error
 */
export async function testAniListProvider(): Promise<AsyncResult<boolean, Error>> {
  const { anilistService } = await import('../../../../services/anilist/service');

  try {
    const result = await anilistService.searchManga('Naruto', { limit: 1 });
    if (Array.isArray(result) && result.length > 0) {
      logger.info('AniList API test successful');
      return createSuccessResult(true);
    }
    return createErrorResult(new Error('AniList API returned no results'));
  } catch (error: unknown) {
    logger.error('AniList API test failed:', error);
    return createErrorResult(new Error('Failed to connect to AniList'));
  }
}
