/**
 * Rate limiter extracted from the original client.ts
 * Reusable across all providers
 */
export interface RateLimitConfig {
    maxRequests: number;
    perMilliseconds: number;
}
export declare class RateLimiter {
    private readonly maxRequests;
    private readonly perMilliseconds;
    private requestTimestamps;
    constructor(maxRequests: number, perMilliseconds: number);
    /**
     * Wait if rate limit would be exceeded
     */
    waitIfNeeded(): Promise<void>;
    /**
     * Get time until next request is allowed (0 if immediate)
     */
    getWaitTime(): number;
}
//# sourceMappingURL=rate-limiter.d.ts.map