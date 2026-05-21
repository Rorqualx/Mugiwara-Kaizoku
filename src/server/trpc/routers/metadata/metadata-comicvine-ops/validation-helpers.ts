/**
 * ComicVine Validation Helpers
 *
 * Functions for validating ComicVine API responses.
 */

import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/**
 * Validates the ComicVine API response error field
 */
export function validateComicVineError(resultObj: Record<string, unknown>): AsyncResult<boolean, Error> | null {
  if (resultObj['error'] && resultObj['error'] !== 'OK') {
    logger.warn(`ComicVine API error: ${resultObj['error']}`);
    if (resultObj['error'] === 'Invalid API Key' || String(resultObj['error']).includes('Invalid')) {
      return createErrorResult(new Error('Invalid API key. Please check your ComicVine API key.'));
    }
    return createErrorResult(new Error(`ComicVine API error: ${resultObj['error']}`));
  }
  return null;
}

/**
 * Validates the ComicVine API response status code
 */
export function validateComicVineStatusCode(resultObj: Record<string, unknown>): AsyncResult<boolean, Error> | null {
  if (resultObj['status_code'] !== undefined && resultObj['status_code'] !== 1) {
    logger.warn(`ComicVine API status code: ${resultObj['status_code']}`);
    if (resultObj['status_code'] === 100) {
      return createErrorResult(new Error('Invalid API key. Please verify your ComicVine API key is correct.'));
    }
    if (resultObj['status_code'] === 101) {
      return createErrorResult(new Error('ComicVine API test failed: Resource not found.'));
    }
    return createErrorResult(new Error(`ComicVine API error (status ${resultObj['status_code']})`));
  }
  return null;
}

/**
 * Validates the ComicVine API response results array
 */
export function validateComicVineResults(resultObj: Record<string, unknown>): AsyncResult<boolean, Error> | null {
  if (resultObj['results'] && Array.isArray(resultObj['results'])) {
    if (resultObj['results'].length > 0) {
      logger.info(`ComicVine API test successful, found ${resultObj['results'].length} results`);
      return createSuccessResult(true);
    }
    logger.warn('ComicVine API returned empty results for Spider-Man search');
    return createErrorResult(new Error('API key may be invalid. Test search returned no results.'));
  }
  return null;
}

/**
 * Handles caught errors from the ComicVine API test
 */
export function handleComicVineTestError(error: unknown): AsyncResult<boolean, Error> {
  logger.error('ComicVine API test error:', error);
  const errorMsg = error instanceof Error ? error.message : String(error);

  if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
    return createErrorResult(new Error('Invalid API key (Unauthorized). Please check your ComicVine API key.'));
  }
  if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
    return createErrorResult(new Error('API key is forbidden from accessing this resource. Please verify your API key permissions.'));
  }
  if (errorMsg.includes('rate limit')) {
    return createErrorResult(new Error('Rate limit exceeded. Please try again later.'));
  }
  return createErrorResult(new Error(`Failed to test ComicVine API: ${errorMsg}`));
}
