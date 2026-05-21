/**
 * Rate Limiting Utilities
 *
 * This module provides standardized rate limiting implementations for API clients.
 * It supports various rate limiting strategies and adapts to API-specific requirements.
 *
 * Features:
 * - Multiple rate limiting strategies (fixed window, sliding window, token bucket)
 * - Adaptive rate limiting based on API responses
 * - Support for parsing rate limit headers
 * - Concurrency limiting
 * - Request prioritization
 * - Backoff strategies
 * - Metrics and monitoring
 *
 * @module rateLimit
 * @see {@link ./rate-limit} for implementation details
 */

// Re-export everything from the decomposed rate-limit module
export * from './rate-limit';
