/**
 * ComicVine API Retry Handler
 *
 * Implements exponential backoff and intelligent retry logic for handling
 * transient failures and rate limit errors from the ComicVine API.
 */
import { ApiError } from '@/utils/error-handling';
import { logger } from '@/utils/logger';

import type { ComicVineRateLimiter } from './rateLimiter';
/**
 * Retry strategy configuration
 */
export interface RetryStrategy {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitterMs: number;
    retryableStatusCodes: number[];
    fatalStatusCodes: number[];
}
/**
 * Default retry strategy based on guide recommendations
 */
export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
    maxRetries: 5,
    baseDelayMs: 2000, // Start at 2 seconds
    maxDelayMs: 64000, // Max 64 seconds
    jitterMs: 1000, // Add up to 1 second of jitter
    retryableStatusCodes: [429, 500, 502, 503, 504], // Retry these
    fatalStatusCodes: [401, 403, 404] // Don't retry these
};
/**
 * Retry context for tracking attempts
 */
interface RetryContext {
    attempt: number;
    totalDelay: number;
    errors: Error[];
}
/**
 * Retry statistics
 */
interface RetryStats {
    totalRequests: number;
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    averageRetries: number;
}
/**
 * ComicVine API Retry Handler
 *
 * Handles retries with exponential backoff for ComicVine API requests.
 * Based on guide recommendations:
 * - Exponential backoff starting at 2 seconds, doubling up to 64 seconds
 * - Specific handling for different HTTP status codes
 * - Integration with rate limiter for 429 errors
 */
export class ComicVineRetryHandler {
    private strategy: RetryStrategy;
    private rateLimiter: ComicVineRateLimiter | undefined;
    private stats: RetryStats;
    constructor(strategy: Partial<RetryStrategy> = {}, rateLimiter?: ComicVineRateLimiter) {
        this.strategy = { ...DEFAULT_RETRY_STRATEGY, ...strategy };
        this.rateLimiter = rateLimiter;
        // Initialize stats
        this.stats = {
            totalRequests: 0,
            totalRetries: 0,
            successfulRetries: 0,
            failedRetries: 0,
            averageRetries: 0
        };
        logger.debug('ComicVine retry handler initialized', {
            maxRetries: this.strategy.maxRetries,
            baseDelayMs: this.strategy.baseDelayMs,
            maxDelayMs: this.strategy.maxDelayMs
        });
    }
    /**
     * Execute a function with retry logic
     */
    public async executeWithRetry<T>(fn: () => Promise<T>, context: {
        resource?: string;
        operation?: string;
    } = {}): Promise<T> {
        const retryContext: RetryContext = {
            attempt: 0,
            totalDelay: 0,
            errors: []
        };
        // Track request
        this.stats.totalRequests++;
        while (retryContext.attempt <= this.strategy.maxRetries) {
            try {
                // Execute the function (intentional sequential retry - must await each attempt)
                // eslint-disable-next-line no-await-in-loop
                const result = await fn();
                // If successful and we had retried, log recovery
                if (retryContext.attempt > 0) {
                    logger.info('Request succeeded after retry', {
                        attempt: retryContext.attempt,
                        totalDelayMs: retryContext.totalDelay,
                        ...context
                    });
                    // Track successful retry
                    this.stats.successfulRetries++;
                    this.stats.totalRetries += retryContext.attempt;
                    // Reset backoff in rate limiter if available
                    if (this.rateLimiter && context.resource) {
                        this.rateLimiter.resetBackoff(context.resource);
                    }
                }
                // Update average retries
                this.stats.averageRetries = this.stats.totalRetries / this.stats.totalRequests;
                return result;
            }
            catch (error: unknown) {
                retryContext.errors.push(error as unknown as Error);
                // Check if we should retry
                const shouldRetry = this.shouldRetry(error, retryContext);
                if (!shouldRetry || retryContext.attempt >= this.strategy.maxRetries) {
                    // No more retries, throw the error
                    logger.error('Request failed after all retries', {
                        attempts: retryContext.attempt + 1,
                        totalDelayMs: retryContext.totalDelay,
                        lastError: error instanceof Error ? error.message : String(error),
                        ...context
                    });
                    // Track failed retries
                    if (retryContext.attempt > 0) {
                        this.stats.failedRetries++;
                        this.stats.totalRetries += retryContext.attempt;
                    }
                    // Update average retries
                    this.stats.averageRetries = this.stats.totalRetries / this.stats.totalRequests;
                    throw this.createFinalError(retryContext, context);
                }
                // Calculate delay for next retry
                const delay = this.calculateDelay(retryContext.attempt, error);
                // Special handling for rate limit errors
                if (this.isRateLimitError(error)) {
                    this.handleRateLimitError(error, context.resource);
                }
                logger.warn('Request failed, retrying', {
                    attempt: retryContext.attempt + 1,
                    delayMs: delay,
                    error: error instanceof Error ? error.message : String(error),
                    ...context
                });
                // Wait before retrying (intentional sequential delay between retry attempts)
                // eslint-disable-next-line no-await-in-loop
                await this.sleep(delay);
                retryContext.attempt++;
                retryContext.totalDelay += delay;
            }
        }
        // Should never reach here, but TypeScript needs it
        throw this.createFinalError(retryContext, context);
    }
    /**
     * Determine if an error is retryable
     */
    private shouldRetry(error: unknown, context: RetryContext): boolean {
        // Don't retry if we've exceeded max attempts
        if (context.attempt >= this.strategy.maxRetries) {
            return false;
        }
        // Check if it's an API error with a status code
        if (error instanceof ApiError && error.statusCode) {
            const statusCode = error.statusCode;
            // Never retry fatal status codes
            if (this.strategy.fatalStatusCodes.includes(statusCode)) {
                logger.debug('Not retrying due to fatal status code', {
                    statusCode,
                    fatalCodes: this.strategy.fatalStatusCodes
                });
                return false;
            }
            // Always retry retryable status codes
            if (this.strategy.retryableStatusCodes.includes(statusCode)) {
                return true;
            }
            // Don't retry other HTTP errors
            return false;
        }
        // Retry network errors
        if (this.isNetworkError(error)) {
            return true;
        }
        // Retry timeout errors
        if (this.isTimeoutError(error)) {
            return true;
        }
        // Don't retry other errors
        return false;
    }
    /**
     * Calculate delay for next retry with exponential backoff
     */
    private calculateDelay(attempt: number, error: unknown): number {
        // Base exponential backoff: 2^attempt * baseDelay
        let delay = Math.pow(2, attempt) * this.strategy.baseDelayMs;
        // Cap at maximum delay
        delay = Math.min(delay, this.strategy.maxDelayMs);
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * this.strategy.jitterMs;
        delay += jitter;
        // Check for Retry-After header in rate limit errors
        if (error instanceof ApiError && error.statusCode === 429) {
            const retryAfter = this.extractRetryAfter(error);
            if (retryAfter) {
                // Use the larger of our calculated delay or the server's suggestion
                delay = Math.max(delay, retryAfter * 1000);
            }
        }
        return Math.round(delay);
    }
    /**
     * Check if an error is a rate limit error
     */
    private isRateLimitError(error: unknown): boolean {
        return error instanceof ApiError && error.statusCode === 429;
    }
    /**
     * Check if an error is a network error
     */
    private isNetworkError(error: unknown): boolean {
        if (!(error instanceof Error))
            return false;
        const networkErrorPatterns = [
            'ECONNREFUSED',
            'ENOTFOUND',
            'ETIMEDOUT',
            'ECONNRESET',
            'ENETUNREACH',
            'EHOSTUNREACH',
            'EPIPE',
            'EAI_AGAIN'
        ];
        return networkErrorPatterns.some(pattern => (error instanceof Error ? error.message : String(error)).includes(pattern) || (error instanceof Error ? error["name"] : String(error)).includes(pattern));
    }
    /**
     * Check if an error is a timeout error
     */
    private isTimeoutError(error: unknown): boolean {
        if (!(error instanceof Error))
            return false;
        const timeoutPatterns = [
            'timeout',
            'Timeout',
            'ETIMEDOUT',
            'Request timeout'
        ];
        return timeoutPatterns.some(pattern => (error instanceof Error ? error.message : String(error)).includes(pattern) || (error instanceof Error ? error["name"] : String(error)).includes(pattern));
    }
    /**
     * Handle rate limit error
     */
    private handleRateLimitError(error: unknown, resource?: string): void {
        if (!this.rateLimiter || !resource)
            return;
        const retryAfter = this.extractRetryAfter(error);
        this.rateLimiter.handleRateLimitError(resource, retryAfter);
    }
    /**
     * Extract Retry-After header value from error
     */
    private extractRetryAfter(error: unknown): number | undefined {
        if (!(error instanceof ApiError))
            return undefined;
        // Check if error has headers or response object
        const response = (error as Error & { response?: { headers?: Record<string, string> } }).response;
        if (!response?.headers)
            return undefined;
        const retryAfter = response.headers['retry-after'];
        if (!retryAfter)
            return undefined;
        // Parse as seconds (API typically returns seconds)
        const seconds = parseInt(retryAfter, 10);
        return isNaN(seconds) ? undefined : seconds;
    }
    /**
     * Create final error after all retries exhausted
     */
    private createFinalError(context: RetryContext, requestContext: unknown): Error {
        const lastError = context.errors[context.errors.length - 1];
        if (lastError instanceof ApiError) {
            // Enhance existing API error with retry context
            // Note: lastError.context is always defined (ErrorContext property with default {})
            return new ApiError(`${lastError.message} (after ${context.attempt + 1} attempts)`, lastError.statusCode, {
                ...lastError.context,
                ...(typeof requestContext === 'object' && requestContext !== null ? requestContext : {}),
                retryAttempts: context.attempt + 1,
                totalDelayMs: context.totalDelay,
                errors: context.errors.map(e => e.message)
            });
        }
        // Create new error for non-API errors
        return new Error(`Request failed after ${context.attempt + 1} attempts: ${lastError?.message ?? 'Unknown error'}`);
    }
    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }
    /**
     * Get retry statistics
     *
     * @returns Statistics about retry operations
     */
    public getStats(): RetryStats {
        return { ...this.stats };
    }
    /**
     * Reset retry statistics
     */
    public reset(): void {
        this.stats = {
            totalRequests: 0,
            totalRetries: 0,
            successfulRetries: 0,
            failedRetries: 0,
            averageRetries: 0
        };
        logger.info('Retry handler statistics reset');
    }
}
