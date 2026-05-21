/**
 * ComicVine HTTP Client
 *
 * HTTP client with retry logic, caching, and error handling.
 * Refactored from fetchWithRetry for improved maintainability.
 *
 * Extracted from: service.ts (lines 838-958)
 *
 * ESLint fixes applied:
 * - no-non-null-assertion: Using guard clauses instead of !
 * - no-promise-executor-return: Using separate delay function
 * - max-statements: Extracted helper functions
 * - complexity: Reduced from 28 to <20 per function
 * - max-depth: Flattened conditionals to max depth 4
 */

import axios from 'axios';

import { logger } from '@/utils/logger';

import { MultiTierCache } from '../modules/multiTierCache';
import { ComicVineRateLimiter } from '../modules/rateLimiter';

import { ComicVineError, isComicVineResponse } from './types';

import type { ComicVineApiResponse } from './types';
import type { AxiosInstance, AxiosError } from 'axios';


// ============================================================================
// Types
// ============================================================================

/**
 * Result of HTTP error handling
 */
interface ErrorHandlingResult {
  shouldRetry: boolean;
  waitTime: number;
  newError?: ComicVineError;
}

/**
 * Result of API response validation
 */
interface ValidationResult {
  shouldRetry: boolean;
  waitTime: number;
  error?: ComicVineError;
}

// ============================================================================
// Singleton Cache Instance
// ============================================================================

/**
 * Create singleton cache instance for ComicVine HTTP client
 */
const httpClientCache = new MultiTierCache({
  l1MaxSize: 100,
  l1TtlMs: 300000, // 5 minutes
  l2Enabled: true,
  l2TtlMs: 3600000, // 1 hour
  l2Namespace: 'comicvine_http',
  l3Enabled: true,
  l3TtlMs: 86400000 // 24 hours
});

// ============================================================================
// Helper Functions (to reduce complexity)
// ============================================================================

/**
 * Generate cache key from URL and params
 *
 * @param url - API endpoint URL
 * @param params - Request parameters
 * @returns Cache key string
 */
export function generateCacheKey(url: string, params: Record<string, unknown>): string {
  return `comicvine:${url}:${JSON.stringify(params)}`;
}

/**
 * Parse and validate ComicVine response JSON
 *
 * @param responseText - Raw response text
 * @returns Parsed response data
 * @throws ComicVineError if parsing fails
 */
export function parseComicVineResponse(responseText: string): unknown {
  try {
    logger.debug(`ComicVine response (first 100 chars): ${responseText.substring(0, 100)}...`);
    return JSON.parse(responseText);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to parse ComicVine response: ${errorMessage}`);
    throw new ComicVineError(`JSON parsing error: ${errorMessage}`, 500, false);
  }
}

/**
 * Calculate wait time for rate limit retry
 *
 * @returns Wait time in milliseconds (1 minute)
 */
export function calculateRateLimitWaitTime(): number {
  return 60000; // 1 minute for rate limits
}

/**
 * Calculate wait time for server error retry with exponential backoff
 *
 * @param retries - Current retry count
 * @returns Wait time in milliseconds
 */
export function calculateServerErrorWaitTime(retries: number): number {
  // Exponential backoff: 10s, 20s, 40s, 80s, max 5 minutes
  return Math.min(Math.pow(2, retries) * 10000, 5 * 60 * 1000);
}

/**
 * Calculate wait time for HTTP 429 retry with exponential backoff
 *
 * @param retries - Current retry count
 * @returns Wait time in milliseconds
 */
export function calculateHttp429WaitTime(retries: number): number {
  // Exponential backoff with max 30s
  return Math.min(1000 * Math.pow(2, retries), 30000);
}

/**
 * Create a delay promise
 * FIX: no-promise-executor-return - using setTimeout without return
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Check if error is a rate limit error from API response
 *
 * @param cvResponse - ComicVine API response
 * @returns True if rate limit error
 */
function isRateLimitResponse(cvResponse: ComicVineApiResponse): boolean {
  if (cvResponse.status_code === 429) {
    return true;
  }
  if (typeof cvResponse.error === 'string') {
    return cvResponse.error.toLowerCase().includes('rate limit');
  }
  return false;
}

/**
 * Validate ComicVine API response status
 *
 * @param parsedData - Parsed response data
 * @param rateLimiter - Rate limiter instance
 * @param retries - Current retry count
 * @param maxRetries - Maximum retries allowed
 * @returns Validation result with retry info
 */
export function validateApiResponse(
  parsedData: unknown,
  rateLimiter: ComicVineRateLimiter,
  retries: number,
  maxRetries: number
): ValidationResult {
  if (!isComicVineResponse(parsedData)) {
    return { shouldRetry: false, waitTime: 0 };
  }

  const cvResponse = parsedData;

  // Success case
  if (cvResponse.status_code === 1) {
    return { shouldRetry: false, waitTime: 0 };
  }

  // Rate limit case
  if (isRateLimitResponse(cvResponse)) {
    rateLimiter.handleRateLimitError('global');

    if (retries < maxRetries - 1) {
      const waitTime = calculateRateLimitWaitTime();
      logger.warn(`Rate limit exceeded, waiting ${Math.round(waitTime / 1000)} seconds before retry ${retries + 1}/${maxRetries}`);
      return { shouldRetry: true, waitTime };
    }
  }

  // Error case - create error
  const errorMessage = typeof cvResponse.error === 'string' ? cvResponse.error : 'Unknown ComicVine API error';
  return {
    shouldRetry: false,
    waitTime: 0,
    error: new ComicVineError(errorMessage, cvResponse.status_code, cvResponse.status_code === 429)
  };
}

/**
 * Handle authentication errors (401, 403)
 *
 * @param status - HTTP status code
 * @returns Error handling result
 */
function handleAuthError(status: number): ErrorHandlingResult {
  return {
    shouldRetry: false,
    waitTime: 0,
    newError: new ComicVineError('Invalid or expired API key', status, false)
  };
}

/**
 * Handle rate limit HTTP errors (429)
 *
 * @param rateLimiter - Rate limiter instance
 * @param retries - Current retry count
 * @param maxRetries - Maximum retries allowed
 * @returns Error handling result
 */
function handleRateLimitHttpError(
  rateLimiter: ComicVineRateLimiter,
  retries: number,
  maxRetries: number
): ErrorHandlingResult {
  rateLimiter.handleRateLimitError('global');

  if (retries < maxRetries - 1) {
    const waitTime = calculateHttp429WaitTime(retries);
    logger.warn(`Rate limit exceeded (HTTP 429), waiting ${Math.round(waitTime / 1000)} seconds before retry ${retries + 1}/${maxRetries}`);
    return { shouldRetry: true, waitTime };
  }

  return { shouldRetry: false, waitTime: 0 };
}

/**
 * Handle not found errors (404)
 *
 * @returns Error handling result
 */
function handleNotFoundError(): ErrorHandlingResult {
  return {
    shouldRetry: false,
    waitTime: 0,
    newError: new ComicVineError('Resource not found', 404, false)
  };
}

/**
 * Handle server errors (5xx)
 *
 * @param status - HTTP status code
 * @param retries - Current retry count
 * @param maxRetries - Maximum retries allowed
 * @returns Error handling result
 */
function handleServerError(status: number, retries: number, maxRetries: number): ErrorHandlingResult {
  if (retries < maxRetries - 1) {
    const waitTime = calculateServerErrorWaitTime(retries);
    logger.warn(`Server error (HTTP ${status}), waiting ${Math.round(waitTime / 1000)} seconds before retry ${retries + 1}/${maxRetries}`);
    return { shouldRetry: true, waitTime };
  }

  return {
    shouldRetry: false,
    waitTime: 0,
    newError: new ComicVineError('ComicVine server error', status, false)
  };
}

/**
 * Handle HTTP error responses
 * FIX: max-depth - flattened with early returns and helper functions
 *
 * @param error - The error that occurred
 * @param retries - Current retry count
 * @param maxRetries - Maximum retries allowed
 * @param rateLimiter - Rate limiter instance
 * @returns Error handling result with retry info
 */
export function handleHttpError(
  error: unknown,
  retries: number,
  maxRetries: number,
  rateLimiter: ComicVineRateLimiter
): ErrorHandlingResult {
  // Check if it's an Axios error
  if (!axios.isAxiosError(error)) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      shouldRetry: false,
      waitTime: 0,
      newError: new ComicVineError(`ComicVine API error: ${errorMessage}`, 500, false)
    };
  }

  const axiosError = error as AxiosError;

  // No response received - surface the underlying axios error code (ENOTFOUND,
  // ECONNREFUSED, ETIMEDOUT) so DNS / connectivity issues are diagnosable from
  // the log without re-running with DEBUG_HTTP. See docs/development/debugging-guide.md.
  if (!axiosError.response) {
    const code = axiosError.code ?? 'NO_RESPONSE';
    const errorMessage = `${code}: ${axiosError.message}`;
    return {
      shouldRetry: false,
      waitTime: 0,
      newError: new ComicVineError(`ComicVine API error: ${errorMessage}`, 500, false)
    };
  }

  const status = axiosError.response.status;

  // Handle specific status codes using helper functions
  if (status === 401 || status === 403) {
    return handleAuthError(status);
  }

  if (status === 429) {
    return handleRateLimitHttpError(rateLimiter, retries, maxRetries);
  }

  if (status === 404) {
    return handleNotFoundError();
  }

  if (status >= 500) {
    return handleServerError(status, retries, maxRetries);
  }

  // Unknown error
  const errorMessage = axiosError.message;
  return {
    shouldRetry: false,
    waitTime: 0,
    newError: new ComicVineError(`ComicVine API error: ${errorMessage}`, 500, false)
  };
}

// ============================================================================
// Main HTTP Client Class
// ============================================================================

/**
 * ComicVine HTTP Client
 *
 * Provides HTTP request functionality with:
 * - Automatic retries with exponential backoff
 * - Multi-tier caching
 * - Rate limiting
 * - Error handling
 */
export class ComicVineHttpClient {
  private axiosInstance: AxiosInstance | null = null;
  private rateLimiter: ComicVineRateLimiter;
  private cache: MultiTierCache;

  constructor(rateLimiter: ComicVineRateLimiter) {
    this.rateLimiter = rateLimiter;
    this.cache = httpClientCache;
  }

  /**
   * Set axios instance (called after initialization)
   *
   * @param instance - Configured Axios instance
   */
  setAxiosInstance(instance: AxiosInstance): void {
    this.axiosInstance = instance;
  }

  /**
   * Check if client is initialized
   *
   * @returns True if axios instance is set
   */
  isInitialized(): boolean {
    return this.axiosInstance !== null;
  }

  /**
   * Get the underlying cache instance
   *
   * @returns MultiTierCache instance
   */
  getCache(): MultiTierCache {
    return this.cache;
  }

  /**
   * Fetch with retry - REFACTORED
   *
   * Uses helper functions to reduce complexity and fix ESLint violations.
   * FIX: no-non-null-assertion - using guard clause
   * FIX: max-statements - extracted to helper functions
   * FIX: complexity - delegated to helper functions
   *
   * @template T - Expected response type
   * @param url - API endpoint URL
   * @param params - Request parameters
   * @param maxRetries - Maximum retry attempts
   * @returns Promise resolving to response data
   * @throws ComicVineError on failure
   */
  async fetchWithRetry<T>(
    url: string,
    params: Record<string, unknown> = {},
    maxRetries: number = 5
  ): Promise<T> {
    // Guard clause instead of non-null assertion
    if (!this.axiosInstance) {
      throw new ComicVineError('ComicVine API not initialized', 500, false);
    }

    const cacheKey = generateCacheKey(url, params);

    // TEMPORARY: BYPASS CACHE TO DEBUG ISSUE
    // Check cache first
    // const cachedResponse = await this.cache.get(cacheKey);
    // if (cachedResponse) {
    //   logger.debug(`Using cached response for ${url}`);
    //   return cachedResponse as T;
    // }

    logger.warn(`[ComicVine HTTP] CACHE DISABLED - direct API call`, { url, cacheKey });

    // Execute with retries
    return this.executeWithRetry<T>(url, params, maxRetries, cacheKey);
  }

  /**
   * Execute request with retry loop
   * Extracted to reduce complexity of main fetchWithRetry
   *
   * @template T - Expected response type
   * @param url - API endpoint URL
   * @param params - Request parameters
   * @param maxRetries - Maximum retry attempts
   * @param cacheKey - Cache key for response
   * @returns Promise resolving to response data
   */
  private async executeWithRetry<T>(
    url: string,
    params: Record<string, unknown>,
    maxRetries: number,
    cacheKey: string
  ): Promise<T> {
    // Use recursive approach to avoid no-await-in-loop ESLint warning
    const attemptWithRetry = async (retries: number): Promise<T> => {
      if (retries >= maxRetries) {
        throw new ComicVineError(`Maximum retry attempts (${maxRetries}) reached`, 429, false);
      }

      try {
        const result = await this.attemptRequest<T>(url, params, retries, maxRetries);

        // Success - CACHE DISABLED for debugging
        this.rateLimiter.resetBackoff('global');
        // await this.cache.set(cacheKey, result);  // DISABLED for debugging
        logger.warn(`[ComicVine HTTP] Skipping cache set`, { cacheKey });
        return result;
      } catch (error: unknown) {
        // Check if we should retry
        const errorHandling = handleHttpError(error, retries, maxRetries, this.rateLimiter);

        if (errorHandling.shouldRetry) {
          await delay(errorHandling.waitTime);
          return attemptWithRetry(retries + 1);
        }

        if (errorHandling.newError) {
          throw errorHandling.newError;
        }

        throw error;
      }
    };

    return attemptWithRetry(0);
  }

  /**
   * Attempt a single request
   * Extracted to reduce complexity
   *
   * @template T - Expected response type
   * @param url - API endpoint URL
   * @param params - Request parameters
   * @param retries - Current retry count
   * @param maxRetries - Maximum retry attempts
   * @returns Promise resolving to response data
   */
  private async attemptRequest<T>(
    url: string,
    params: Record<string, unknown>,
    retries: number,
    maxRetries: number
  ): Promise<T> {
    // Guard clause - this should never happen since fetchWithRetry checks first
    if (!this.axiosInstance) {
      throw new ComicVineError('ComicVine API not initialized', 500, false);
    }

    // Acquire rate limit slot before making request
    await this.rateLimiter.acquireSlot('global');

    // axiosInstance is guaranteed non-null at this point (checked above)
    const response = await this.axiosInstance.get(url, {
      params,
      responseType: 'text' // Get response as text to handle JSON parsing manually
    });

    // Parse and validate response
    const parsedData = parseComicVineResponse(response.data as string);

    // Validate API response
    const validation = validateApiResponse(parsedData, this.rateLimiter, retries, maxRetries);

    if (validation.shouldRetry) {
      await delay(validation.waitTime);
      throw new ComicVineError('Rate limit retry', 429, true);
    }

    if (validation.error) {
      throw validation.error;
    }

    return parsedData as T;
  }
}
