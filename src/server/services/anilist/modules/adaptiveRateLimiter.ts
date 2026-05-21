/**
 * AniList Adaptive Rate Limiter
 *
 * This module provides an adaptive rate limiter specifically designed for the AniList API.
 * It monitors actual rate limit headers from API responses and adjusts its behavior accordingly.
 *
 * Features:
 * - Parses X-RateLimit headers from AniList responses
 * - Automatically waits when rate limits are reached
 * - Provides real-time rate limit status
 * - Handles both standard and degraded rate limits
 */
import type { RateLimitInfo } from '@/server/utils/rateLimit';
import { logger } from '@/utils/logger';
/**
 * Configuration for the adaptive rate limiter
 */
export interface AdaptiveRateLimiterConfig {
    /**
     * Default rate limit (requests per minute)
     * AniList standard is 90, but currently degraded to 30
     */
    defaultLimit?: number;
    /**
     * Enable debug logging
     */
    debug?: boolean;
}
/**
 * Adaptive rate limiter for AniList API
 *
 * This limiter adapts to the actual rate limits provided by the API
 * through response headers, providing more accurate rate limiting
 * than fixed or sliding window approaches.
 */
export class AniListAdaptiveRateLimiter {
    private remaining: number;
    private limit: number;
    private resetTime: number;
    private debug: boolean;
    private waitPromise: Promise<void> | null = null;
    constructor(config: AdaptiveRateLimiterConfig = {}) {
        // AniList's current degraded limit is 30 requests per minute
        this.limit = config.defaultLimit ?? 30;
        this.remaining = this.limit;
        this.resetTime = Date.now() + 60000; // 1 minute from now
        this.debug = config.debug ?? false;
    }
    /**
     * Updates rate limit information from response headers
     *
     * @param headers - Response headers from AniList API
     */
    public updateFromHeaders(headers: Record<string, string | string[] | undefined>): void {
        // AniList uses standard rate limit headers
        const remaining = this.extractHeader(headers, 'x-ratelimit-remaining');
        const limit = this.extractHeader(headers, 'x-ratelimit-limit');
        const reset = this.extractHeader(headers, 'x-ratelimit-reset');
        if (remaining !== null) {
            this.remaining = remaining;
        }
        if (limit !== null) {
            this.limit = limit;
        }
        if (reset !== null) {
            // Reset is provided as Unix timestamp (seconds)
            this.resetTime = reset * 1000; // Convert to milliseconds
        }
        if (this.debug && (remaining !== null || limit !== null || reset !== null)) {
            logger.info('[AniList Rate Limiter] Updated from headers:', {
                remaining: this.remaining,
                limit: this.limit,
                resetTime: new Date(this.resetTime).toISOString(),
                resetIn: Math.max(0, this.resetTime - Date.now()) / 1000 + 's'
            });
        }
    }
    /**
     * Extracts a header value as a number
     *
     * @param headers - Response headers
     * @param key - Header key (case-insensitive)
     * @returns Parsed number or null if not found
     */
    private extractHeader(headers: Record<string, string | string[] | undefined>, key: string): number | null {
        // Try exact match first
        let value = headers[key];
        // Try case-insensitive match
        if (!value) {
            const lowerKey = key.toLowerCase();
            for (const [headerKey, headerValue] of Object.entries(headers)) {
                if (headerKey.toLowerCase() === lowerKey) {
                    value = headerValue;
                    break;
                }
            }
        }
        if (value === undefined) {
            return null;
        }
        // Handle array values (some HTTP clients return headers as arrays)
        if (Array.isArray(value)) {
            value = value[0];
        }
        const parsed = parseInt(value as string, 10);
        return isNaN(parsed) ? null : parsed;
    }
    /**
     * Acquires permission to make a request
     * Waits if rate limit is reached
     *
     * @param cost - Number of requests to consume (default: 1)
     */
    public async acquire(cost: number = 1): Promise<void> {
        // If there's already a wait in progress, wait for it
        if (this.waitPromise) {
            await this.waitPromise;
        }
        // Check if we need to wait for reset
        const now = Date.now();
        // If we're past the reset time, reset the counter
        if (now >= this.resetTime) {
            this.remaining = this.limit;
            this.resetTime = now + 60000; // Next minute
            if (this.debug) {
                logger.info('[AniList Rate Limiter] Reset window, remaining:', this.remaining);
            }
        }
        // Check if we have enough remaining requests
        if (this.remaining < cost) {
            const waitTime = Math.max(0, this.resetTime - now);
            if (waitTime > 0) {
                if (this.debug) {
                    logger.info(`[AniList Rate Limiter] Rate limit reached (${this.remaining}/${this.limit}), waiting ${(waitTime / 1000).toFixed(1)}s`);
                }
                // Create a shared wait promise so multiple acquire calls wait together
                this.waitPromise = new Promise(resolve => {
                    setTimeout(resolve, waitTime);
                });
                await this.waitPromise;
                this.waitPromise = null;
                // After waiting, reset the counter
                this.remaining = this.limit;
                this.resetTime = Date.now() + 60000;
            }
        }
        // Consume the cost
        this.remaining = Math.max(0, this.remaining - cost);
        if (this.debug) {
            logger.info(`[AniList Rate Limiter] Request acquired, remaining: ${this.remaining}/${this.limit}`);
        }
    }
    /**
     * Releases a request back to the pool
     * Used when a request fails before reaching the API
     */
    public release(): void {
        this.remaining = Math.min(this.limit, this.remaining + 1);
        if (this.debug) {
            logger.info(`[AniList Rate Limiter] Request released, remaining: ${this.remaining}/${this.limit}`);
        }
    }
    /**
     * Gets current rate limit information
     */
    public getInfo(): RateLimitInfo {
        return {
            remaining: this.remaining,
            limit: this.limit,
            reset: new Date(this.resetTime),
            retryAfter: Math.max(0, Math.ceil((this.resetTime - Date.now()) / 1000))
        };
    }
    /**
     * Resets the rate limiter to default state
     */
    public reset(): void {
        this.remaining = this.limit;
        this.resetTime = Date.now() + 60000;
        this.waitPromise = null;
        if (this.debug) {
            logger.info('[AniList Rate Limiter] Reset to default state');
        }
    }
    /**
     * Handles rate limit error from API
     *
     * @param error - Error object from API
     * @returns Wait time in milliseconds
     */
    public handleRateLimitError(error: unknown): number {
        // Check for Retry-After header in error response
        // Type guard to safely access error properties
        const isErrorWithResponse = (err: unknown): err is { response: { headers: Record<string, unknown> } } => {
            return typeof err === 'object' && err !== null && 'response' in err &&
                typeof (err as { response: unknown }).response === 'object' &&
                (err as { response: unknown }).response !== null &&
                'headers' in ((err as { response: unknown }).response as Record<string, unknown>);
        };

        const isErrorWithHeaders = (err: unknown): err is { headers: Record<string, unknown> } => {
            return typeof err === 'object' && err !== null && 'headers' in err;
        };

        const retryAfter = (isErrorWithResponse(error) ? error.response.headers['retry-after'] : undefined) ||
            (isErrorWithHeaders(error) ? error.headers['retry-after'] : undefined) ||
            60; // Default to 60 seconds
        let waitTime: number;
        if (typeof retryAfter === 'number') {
            waitTime = retryAfter * 1000;
        }
        else if (typeof retryAfter === 'string' && /^\d+$/.test(retryAfter)) {
            waitTime = parseInt(retryAfter, 10) * 1000;
        }
        else if (typeof retryAfter === 'string') {
            // It might be an HTTP date
            const retryDate = new Date(retryAfter);
            if (!isNaN(retryDate.getTime())) {
                waitTime = Math.max(0, retryDate.getTime() - Date.now());
            }
            else {
                waitTime = 60000; // Default to 60 seconds
            }
        }
        else {
            waitTime = 60000; // Default to 60 seconds
        }
        // Update internal state
        this.remaining = 0;
        this.resetTime = Date.now() + waitTime;
        if (this.debug) {
            logger.info(`[AniList Rate Limiter] Rate limit error, waiting ${(waitTime / 1000).toFixed(1)}s`);
        }
        return waitTime;
    }
}
