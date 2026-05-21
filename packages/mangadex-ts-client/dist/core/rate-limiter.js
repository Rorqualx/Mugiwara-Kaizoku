"use strict";
/**
 * Rate limiter extracted from the original client.ts
 * Reusable across all providers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    maxRequests;
    perMilliseconds;
    requestTimestamps = [];
    constructor(maxRequests, perMilliseconds) {
        this.maxRequests = maxRequests;
        this.perMilliseconds = perMilliseconds;
    }
    /**
     * Wait if rate limit would be exceeded
     */
    async waitIfNeeded() {
        const now = Date.now();
        // Remove old timestamps
        this.requestTimestamps = this.requestTimestamps.filter((timestamp) => now - timestamp < this.perMilliseconds);
        // Check if we've reached the limit
        if (this.requestTimestamps.length >= this.maxRequests) {
            const oldestTimestamp = this.requestTimestamps[0];
            const waitTime = this.perMilliseconds - (now - oldestTimestamp);
            if (waitTime > 0) {
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
            // Clean up again after waiting
            this.requestTimestamps = this.requestTimestamps.filter((timestamp) => Date.now() - timestamp < this.perMilliseconds);
        }
        // Add current timestamp
        this.requestTimestamps.push(Date.now());
    }
    /**
     * Get time until next request is allowed (0 if immediate)
     */
    getWaitTime() {
        const now = Date.now();
        this.requestTimestamps = this.requestTimestamps.filter((timestamp) => now - timestamp < this.perMilliseconds);
        if (this.requestTimestamps.length < this.maxRequests) {
            return 0;
        }
        const oldestTimestamp = this.requestTimestamps[0];
        return Math.max(0, this.perMilliseconds - (now - oldestTimestamp));
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rate-limiter.js.map