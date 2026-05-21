/**
 * Rate Limit Module - Main Aggregator
 *
 * Provides standardized rate limiting implementations for API clients.
 * Supports multiple strategies (fixed window, sliding window, token bucket, adaptive).
 *
 * Architecture:
 * - types.ts - Type definitions, enums, interfaces (~96 lines)
 * - base-limiter.ts - Abstract base class (~239 lines)
 * - strategies/fixed-window.ts - Fixed window strategy (~88 lines)
 * - strategies/sliding-window.ts - Sliding window strategy (~99 lines)
 * - strategies/token-bucket.ts - Token bucket strategy (~104 lines)
 * - strategies/adaptive.ts - Adaptive strategy (~122 lines)
 * - rate-limiter.ts - Main facade class (~162 lines)
 * - factory.ts - Factory with provider presets (~75 lines)
 *
 * Original: 851 lines → Refactored: 8 modules (~985 lines total, but each <250)
 *
 * @example
 * ```typescript
 * import { createRateLimiter, RateLimiter } from '@/server/utils/rate-limit';
 *
 * // Using preset
 * const limiter = createRateLimiter('anilist');
 *
 * // Custom config
 * const customLimiter = new RateLimiter({
 *   strategy: 'sliding',
 *   requestsPerMinute: 60
 * });
 *
 * // Usage
 * await limiter.acquire();
 * const result = await fetch(...);
 * limiter.updateFromResponse(result);
 * ```
 */

// Types and enums
export type { RateLimitStrategy } from './types';
export { BackoffStrategy, RequestPriority } from './types';
export type {
  RateLimitConfig,
  RateLimitInfo,
  RateLimitRequestOptions,
} from './types';

// Base limiter
export { BaseRateLimiter } from './base-limiter';

// Strategy implementations
export { FixedWindowRateLimiter } from './strategies/fixed-window';
export { SlidingWindowRateLimiter } from './strategies/sliding-window';
export { TokenBucketRateLimiter } from './strategies/token-bucket';
export { AdaptiveRateLimiter } from './strategies/adaptive';

// Main facade and metrics
export { RateLimiter } from './rate-limiter';
export type { RateLimiterMetrics } from './rate-limiter';

// Factory
export { createRateLimiter } from './factory';

// Backward compatibility aliases
export { RateLimiter as UnifiedRateLimiter } from './rate-limiter';
export type { RateLimitConfig as UnifiedRateLimiterConfig } from './types';
