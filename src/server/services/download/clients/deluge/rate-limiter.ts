/**
 * Deluge Rate Limiter
 *
 * Rate limiting implementation for Deluge API requests to prevent
 * overwhelming the server with too many concurrent requests.
 * Extracted from: delugeClient.ts
 */

/**
 * Deluge-specific rate limiter that ensures minimum time between requests
 */
export class DelugeRateLimiter {
    private lastRequest: number = 0;
    private minRequestInterval: number;

    /**
     * Creates a new rate limiter
     *
     * @param requestsPerSecond - Maximum number of requests allowed per second
     */
    constructor(requestsPerSecond: number) {
        this.minRequestInterval = 1000 / requestsPerSecond;
    }

    /**
     * Acquires permission to make a request, waiting if necessary
     *
     * @returns Promise that resolves when the request can proceed
     */
    async acquire(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;

        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            await new Promise<void>((resolve) => {
                setTimeout(resolve, waitTime);
            });
        }

        this.lastRequest = Date.now();
    }
}
