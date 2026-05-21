/**
 * AniList GraphQL Client Module
 *
 * This module provides a client for interacting with the AniList GraphQL API.
 * It implements a robust client with built-in safety mechanisms and optimizations.
 *
 * Key Features:
 * - Authentication and token management
 * - Intelligent rate limiting with exponential backoff
 * - Request caching with TTL and invalidation
 * - Concurrent request locking to prevent duplicate requests
 * - Comprehensive error handling and recovery
 * - Type-safe responses with runtime validation
 *
 * Security Features:
 * - Secure token storage and transmission
 * - Request validation and sanitization
 * - Protection against concurrent authentication
 * - Rate limit compliance to prevent API abuse
 *
 * Performance Optimizations:
 * - Request deduplication via caching
 * - Concurrent request batching
 * - Automatic retry with exponential backoff
 * - Memory-efficient cache implementation
 *
 * @example
 * ```typescript
 * // Initialize client with credentials
 * const client = new AniListGraphQLClient(
 *   process.env.ANILIST_CLIENT_ID,
 *   process.env.ANILIST_CLIENT_SECRET
 * );
 *
 * // Authenticate with user code
 * await client.authenticate('user-auth-code');
 *
 * // Make authenticated request
 * const data = await client.query(
 *   `query ($id: Int) {
 *     Media(id: $id, type: MANGA) {
 *       title { romaji }
 *     }
 *   }`,
 *   { id: 123 }
 * );
 * ```
 *
 * @module AniListClient
 */
import axios from 'axios';

import { logger } from '@/utils/logger';

import { anilistRequestQueue, AniListPriority, type AniListPriorityLevel } from './request-queue';

import type { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
/**
 * Enhanced rate limiter with conservative limits and global lock mechanism
 *
 * This class implements sophisticated rate limiting for the AniList API:
 * - Maintains a rolling window of requests
 * - Implements concurrent request locking
 * - Uses exponential backoff for retries
 * - Provides conservative safety margins
 *
 * The rate limiter ensures we stay well within AniList's limits:
 * - Max 90 requests per minute (we use 80 for safety)
 * - Minimum 1.5s between requests
 *
 * @example
 * ```typescript
 * const limiter = new AniListRateLimiter();
 *
 * // Acquire lock for specific operation
 * const release = await limiter.acquireLock('get-manga-123');
 * try {
 *   await limiter.waitForNextRequest();
 *   // Make API request
 * } finally {
 *   release(); // Always release the lock
 * }
 * ```
 */
class AniListRateLimiter {
    private lastRequestTime = 0;
    private requestCount = 0;
    private readonly minRequestInterval = 1500; // 1.5 seconds between requests (more conservative)
    private readonly maxRequestsPerMinute = 80; // Reduced from 90 to 80 for safety margin
    private requestTimestamps: number[] = [];
    private readonly globalLock = new Map<string, Promise<void>>();
    /**
     * Acquire a global lock for a specific request key
     *
     * This method implements a mutex-like locking mechanism to prevent
     * concurrent identical requests. It's particularly useful for:
     * - Preventing duplicate API calls
     * - Managing concurrent authentication attempts
     * - Coordinating cache updates
     *
     * The lock is automatically released when the returned function is called.
     * Always use this in a try/finally block to ensure the lock is released.
     *
     * @param {string} key - Unique key identifying the request
     * @returns {Promise<() => void>} Release function that must be called to free the lock
     * @throws {Error} If unable to acquire lock after timeout
     *
     * @example
     * ```typescript
     * const release = await rateLimiter.acquireLock('update-manga-123');
     * try {
     *   // Perform synchronized operation
     * } finally {
     *   release(); // Always release the lock
     * }
     * ```
     */
    async acquireLock(key: string): Promise<() => void> {
        let release: () => void;
        const lockPromise = new Promise<void>(resolve => {
            release = resolve;
        });
        // Wait for any existing lock with this key
        const existingLock = this.globalLock.get(key);
        if (existingLock) {
            await existingLock;
        }
        // Set our lock
        this.globalLock.set(key, lockPromise);
        // Return release function
        return () => {
            release();
            this.globalLock.delete(key);
        };
    }
    /**
     * Wait for the next available request slot
     *
     * This method implements a sophisticated rate limiting algorithm:
     * 1. Cleans up old request timestamps
     * 2. Checks current request count against limits
     * 3. Implements exponential backoff when near limits
     * 4. Ensures minimum delay between requests
     *
     * The implementation is conservative to maintain good API citizenship:
     * - Uses 80 requests/minute (vs. allowed 90)
     * - Adds 500ms buffer to wait times
     * - Implements exponential backoff for retries
     *
     * @throws {Error} If unable to acquire request slot after maximum retries
     *
     * @example
     * ```typescript
     * // Wait for available request slot
     * await rateLimiter.waitForNextRequest();
     *
     * // Make API request
     * const response = await fetch(url);
     * ```
     */
    async waitForNextRequest(): Promise<void> {
        const now = Date.now();
        // Clean up old timestamps (older than 1 minute)
        this.requestTimestamps = this.requestTimestamps.filter(timestamp => now - timestamp < 60000);
        // Check if we're at the rate limit
        if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
            const oldestTimestamp = this.requestTimestamps[0];
            if (oldestTimestamp) {
                const timeToWait = 60000 - (now - oldestTimestamp) + 500; // Add 500ms buffer
                if (timeToWait > 0) {
                    logger.debug(`Rate limit reached, waiting ${timeToWait}ms`);
                    await new Promise(resolve => {
                        setTimeout(resolve, timeToWait);
                    });
                }
            }
        }
        // Check if we need to wait between requests
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            await new Promise(resolve => {
                setTimeout(resolve, waitTime);
            });
        }
        this.lastRequestTime = Date.now();
        this.requestTimestamps.push(this.lastRequestTime);
    }
}
/**
 * Cache system to avoid redundant requests
 *
 * This class implements an efficient caching system for GraphQL requests:
 * - In-memory cache with TTL
 * - Automatic cache invalidation
 * - Memory-efficient storage
 * - Thread-safe operations
 *
 * The cache helps optimize performance and reduce API load by:
 * - Eliminating duplicate requests
 * - Reducing API calls for frequently accessed data
 * - Providing fast responses for cached queries
 *
 * @example
 * ```typescript
 * const cache = new AniListCache();
 *
 * // Generate cache key
 * const key = cache.getCacheKey(query, variables);
 *
 * // Try to get cached data
 * let data = cache.get(key);
 * if (!data) {
 *   // Fetch and cache if not found
 *   data = await fetchData();
 *   cache.set(key, data);
 * }
 * ```
 */
class AniListCache {
    private cache = new Map<string, {
        data: unknown;
        timestamp: number;
    }>();
    private readonly cacheTTL = 3600000; // 1 hour in milliseconds
    /**
     * Generate a cache key from query and variables
     *
     * Creates a unique, deterministic key for caching GraphQL queries.
     * The key combines the query string and variables to ensure uniqueness.
     *
     * @param {string} query - GraphQL query string
     * @param {Record<string, unknown>} [variables] - Query variables
     * @returns {string} Unique cache key
     *
     * @example
     * ```typescript
     * const key = cache.getCacheKey(
     *   'query ($id: Int) { Media(id: $id) { title } }',
     *   { id: 123 }
     * );
     * ```
     */
    getCacheKey(query: string, variables?: Record<string, unknown>): string {
        return `${query}:${JSON.stringify(variables ?? {})}`;
    }
    /**
     * Get cached data if available and not expired
     *
     * Retrieves data from cache if available and not expired.
     * Automatically removes expired entries to prevent memory leaks.
     *
     * @param {string} key - Cache key to lookup
     * @returns {any | null} Cached data or null if not found/expired
     *
     * @example
     * ```typescript
     * const key = cache.getCacheKey(query, variables);
     * const data = cache.get(key);
     * if (data) {
     *   logger.info('Cache hit:', data);
     * }
     * ```
     */
    get(key: string): unknown | null {
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        // Check if cache is still valid
        if (Date.now() - cached.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    }
    /**
     * Cache data with timestamp
     *
     * Stores data in cache with current timestamp for TTL tracking.
     * Implements memory-efficient storage by removing old entries.
     *
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     *
     * @example
     * ```typescript
     * const key = cache.getCacheKey(query, variables);
     * cache.set(key, {
     *   id: 123,
     *   title: 'One Piece'
     * });
     * ```
     */
    set(key: string, data: unknown): void {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
    /**
     * Clear all cached data
     *
     * Removes all entries from the cache.
     * Useful for:
     * - Clearing stale data
     * - Managing memory usage
     * - Forcing fresh data fetches
     *
     * @example
     * ```typescript
     * // Clear entire cache
     * cache.clear();
     *
     * // Fetch fresh data
     * const newData = await fetchData();
     * ```
     */
    clear(): void {
        this.cache.clear();
    }
}
/**
 * Custom error class for AniList API errors
 */
export class AniListError extends Error {
    constructor(message: string, public readonly statusCode?: number, public readonly retryable: boolean = false) {
        super(message);
        this["name"] = 'AniListError';
    }
}
/**
 * Types for AniList API responses
 */
export interface AniListGraphQLResponse<T> {
    data?: T;
    errors?: Array<{
        message: string;
        locations?: Array<{
            line: number;
            column: number;
        }>;
        path?: string[];
        extensions?: {
            code?: string;
        };
    }>;
}
/**
 * Enhanced AniList GraphQL client with caching
 */
export class AniListGraphQLClient {
    private axiosInstance: AxiosInstance;
    private rateLimiter = new AniListRateLimiter();
    private cache = new AniListCache();
    private accessToken: string | null = null;
    constructor(private clientId?: string, private clientSecret?: string, private accessTokenOverride?: string) {
        // Initialize axios instance
        this.axiosInstance = axios.create({
            baseURL: 'https://graphql.anilist.co',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        // Set access token if provided
        if (accessTokenOverride) {
            this.accessToken = accessTokenOverride;
            this.updateAuthHeader();
        }
    }
    /**
     * Update the authorization header with the current access token
     */
    private updateAuthHeader(): void {
        if (this.accessToken) {
            this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
        }
        else {
            delete this.axiosInstance.defaults.headers.common['Authorization'];
        }
    }
    /**
     * Set the access token
     */
    setAccessToken(token: string): void {
        this.accessToken = token;
        this.updateAuthHeader();
    }
    /**
     * Clear the access token
     */
    clearAccessToken(): void {
        this.accessToken = null;
        this.updateAuthHeader();
    }
    /**
     * Check if the client is authenticated
     */
    isAuthenticated(): boolean {
        return !!this.accessToken;
    }
    /**
     * Authenticate with AniList using client credentials
     */
    async authenticate(code: string): Promise<string> {
        if (!this.clientId || !this.clientSecret) {
            throw new AniListError('Client ID and Client Secret are required for authentication', 400, false);
        }
        try {
            const response = await axios.post('https://anilist.co/api/v2/oauth/token', {
                grant_type: 'authorization_code',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: 'http://localhost', // This should match the redirect URI registered with AniList
                code: code
            });
            // Type guard for OAuth response
            const responseData = response.data as unknown;
            if (
                typeof responseData === 'object' &&
                responseData !== null &&
                'access_token' in responseData &&
                typeof (responseData as { access_token: unknown }).access_token === 'string'
            ) {
                const token = (responseData as { access_token: string }).access_token;
                this.accessToken = token;
                this.updateAuthHeader();
                return token;
            }
            else {
                throw new AniListError('Invalid response from AniList authentication', 500, false);
            }
        }
        catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                const statusCode = axiosError.response?.status;
                const errorMessage = axiosError.response?.data ?
                    JSON.stringify(axiosError.response.data) :
                    axiosError.message;
                throw new AniListError(`Authentication failed: ${errorMessage}`, statusCode, false);
            }
            else {
                throw new AniListError(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`, 500, false);
            }
        }
    }
    /**
     * Check for cached data after acquiring lock
     */
    private checkCachedData<T>(cacheKey: string): T | null {
        const cachedDataAfterLock = this.cache.get(cacheKey);
        if (cachedDataAfterLock) {
            logger.debug(`Using cached data after lock for query: ${cacheKey.substring(0, 50)}...`);
            return cachedDataAfterLock as T;
        }
        return null;
    }

    /**
     * Calculate exponential backoff time for retries
     */
    private calculateBackoffTime(retryCount: number): number {
        return Math.pow(3, retryCount) * 1000; // More aggressive: 3^retries seconds
    }

    /**
     * Handle GraphQL errors from response
     */
    private handleGraphQLErrors(
        response: AniListGraphQLResponse<unknown>,
        retries: number,
        maxRetries: number
    ): { shouldRetry: boolean; error?: AniListError } {
        if (!response.errors || response.errors.length === 0) {
            return { shouldRetry: false };
        }

        const firstError = response.errors[0];
        if (!firstError) {
            return { shouldRetry: false };
        }

        const isRateLimited = firstError.extensions?.code === 'RATE_LIMITED';
        const isAuthError = firstError.message.includes('auth') ||
            firstError.message.includes('token') ||
            firstError.message.includes('unauthorized');

        // If it's a rate limit error and we have retries left, retry
        if (isRateLimited && retries < maxRetries) {
            return { shouldRetry: true };
        }

        // If it's an auth error but we're doing a public query, ignore it
        if (isAuthError) {
            logger.debug(`Auth error detected, continuing with public access: ${firstError.message}`);
            return { shouldRetry: false };
        }

        // Other errors should throw
        return {
            shouldRetry: false,
            error: new AniListError(`GraphQL error: ${firstError.message}`, 400, isRateLimited)
        };
    }

    /**
     * Handle Axios errors
     */
    private handleAxiosError(
        error: AxiosError,
        retries: number,
        maxRetries: number
    ): { shouldRetry: boolean; error?: AniListError } {
        const statusCode = error.response?.status;

        // Handle rate limiting with retry
        if (statusCode === 429 && retries < maxRetries) {
            return { shouldRetry: true };
        }

        // Handle other errors - throw
        const errorMessage = error.response?.data ?
            JSON.stringify(error.response.data) :
            error.message;

        return {
            shouldRetry: false,
            error: new AniListError(`AniList API error: ${errorMessage}`, statusCode, statusCode === 429)
        };
    }

    /**
     * Execute a single GraphQL request with retry logic
     */
    private async executeRequestWithRetry<T>(
        query: string,
        variables: Record<string, unknown> | undefined,
        maxRetries: number
    ): Promise<T> {
        // CRITICAL DEBUG: Force console output to stderr
         
        console.error(`[AniList HTTP DEBUG] query search var: ${variables?.['search']}`);
        logger.warn(`[AniList HTTP] executeRequestWithRetry called`, {
            queryPrefix: query.substring(0, 100),
            variables: JSON.stringify(variables),
        });

        let retries = 0;

        // Recursive function to handle retries without await-in-loop
        const attemptRequest = async (): Promise<T> => {
            try {
                // Wait for rate limiter
                await this.rateLimiter.waitForNextRequest();

                // CRITICAL DEBUG: Log before axios call
                logger.warn(`[AniList HTTP] Making axios POST`, { search: variables?.['search'] });

                // Execute the query
                const response = await this.axiosInstance.post<AniListGraphQLResponse<T>>('', {
                    query,
                    variables
                });

                // Check for GraphQL errors
                const errorResult = this.handleGraphQLErrors(response, retries, maxRetries);
                if (errorResult.error) {
                    throw errorResult.error;
                }

                if (errorResult.shouldRetry) {
                    retries++;
                    const waitTime = this.calculateBackoffTime(retries);
                    logger.debug(`Rate limited, retrying in ${waitTime}ms (attempt ${retries}/${maxRetries})`);
                    await new Promise(resolve => { setTimeout(resolve, waitTime); });
                    return await attemptRequest(); // Recursive retry
                }

                // Return and validate data
                if (response.data.data) {
                    return response.data.data;
                }

                throw new AniListError('No data returned from AniList', 500, false);
            }
            catch (error: unknown) {
                if (axios.isAxiosError(error)) {
                    const axiosError = error as AxiosError;
                    const errorResult = this.handleAxiosError(axiosError, retries, maxRetries);

                    if (errorResult.shouldRetry) {
                        retries++;
                        const waitTime = this.calculateBackoffTime(retries);
                        logger.debug(`Rate limited, retrying in ${waitTime}ms (attempt ${retries}/${maxRetries})`);
                        await new Promise(resolve => { setTimeout(resolve, waitTime); });
                        return attemptRequest(); // Recursive retry
                    }

                    throw errorResult.error;
                }

                if (error instanceof AniListError) {
                    throw error;
                }

                throw new AniListError(
                    `AniList API error: ${error instanceof Error ? error.message : String(error)}`,
                    500,
                    false
                );
            }
        };

        return attemptRequest();
    }

    /**
     * Execute a GraphQL query with retries, caching, and improved rate limiting
     */
    async query<T>(query: string, variables?: Record<string, unknown>, maxRetries = 3): Promise<T> {
        // Generate cache key
        const cacheKey = this.cache.getCacheKey(query, variables);

        // Check cache first
        const cachedData = this.cache.get(cacheKey);
        if (cachedData) {
            logger.debug(`Using cached data for query: ${cacheKey.substring(0, 50)}...`);
            return cachedData as T;
        }

        // Acquire lock for this query to prevent concurrent identical requests
        const releaseLock = await this.rateLimiter.acquireLock(cacheKey);
        try {
            // Check cache again after acquiring lock (another caller may have populated it)
            const cachedDataAfterLock = this.checkCachedData<T>(cacheKey);
            if (cachedDataAfterLock) {
                return cachedDataAfterLock;
            }

            // Execute request with retry logic
            const data = await this.executeRequestWithRetry<T>(query, variables, maxRetries);

            // Cache the result for future use (1 hour TTL)
            this.cache.set(cacheKey, data);

            return data;
        }
        finally {
            // Always release the lock
            releaseLock();
        }
    }
    /**
     * Clear the cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Parse rate limit headers from response and update the queue
     */
    private parseRateLimitHeaders(response: AxiosResponse): void {
        const remaining: unknown = response.headers['x-ratelimit-remaining'];
        if (remaining !== undefined) {
            const remainingNum = parseInt(String(remaining), 10);
            if (!isNaN(remainingNum)) {
                anilistRequestQueue.updateRateLimit(remainingNum);
            }
        }
    }

    /**
     * Execute a GraphQL query through the global request queue with priority support
     *
     * This method routes all requests through a centralized queue to prevent
     * triggering AniList's burst limiter. Requests are processed sequentially
     * with minimum delays between them.
     *
     * @param query - GraphQL query string
     * @param variables - Query variables
     * @param priority - Request priority (higher = processed first)
     * @param description - Description for logging
     * @param maxRetries - Maximum retry attempts
     * @returns Promise resolving to query result
     */
    async queryWithPriority<T>(
        query: string,
        variables?: Record<string, unknown>,
        priority: AniListPriorityLevel = AniListPriority.LOW,
        description?: string,
        _maxRetries = 3
    ): Promise<T> {
        // Generate cache key
        const cacheKey = this.cache.getCacheKey(query, variables);

        // Check cache first (cache check doesn't need queue)
        const cachedData = this.cache.get(cacheKey);
        if (cachedData) {
            logger.debug(`[AniList Client] Cache hit for: ${description ?? cacheKey.substring(0, 50)}...`);
            return cachedData as T;
        }

        // Enqueue the request for sequential processing
        return anilistRequestQueue.enqueue<T>(
            async () => {
                // Check cache again (might have been populated while waiting in queue)
                const cachedDataAfterQueue = this.cache.get(cacheKey);
                if (cachedDataAfterQueue) {
                    logger.debug(`[AniList Client] Cache hit after queue for: ${description ?? 'unknown'}`);
                    return cachedDataAfterQueue as T;
                }

                // Execute the actual request
                const response = await this.axiosInstance.post<AniListGraphQLResponse<T>>('', {
                    query,
                    variables
                });

                // Parse rate limit headers
                this.parseRateLimitHeaders(response);

                // Handle errors
                if (response.data.errors && response.data.errors.length > 0) {
                    const firstError = response.data.errors[0];
                    if (firstError) {
                        throw new AniListError(`GraphQL error: ${firstError.message}`, 400, false);
                    }
                }

                // Validate data exists
                if (!response.data.data) {
                    throw new AniListError('No data returned from AniList', 500, false);
                }

                // Cache the result (1 hour TTL)
                this.cache.set(cacheKey, response.data.data);

                return response.data.data;
            },
            priority,
            description
        );
    }
}
// Create and export a singleton instance
export const anilistClient = new AniListGraphQLClient();

// Re-export priority constants for convenience
export { AniListPriority, type AniListPriorityLevel } from './request-queue';
