/**
 * Rate Limiter Factory
 *
 * Factory function to create rate limiters with provider presets.
 * Supports AniList, ComicVine, Fandom, and custom configurations.
 *
 * Extracted from: rateLimit.ts (lines 789-847)
 */

import { RateLimiter } from './rate-limiter';
import { BackoffStrategy } from './types';

import type { RateLimitConfig } from './types';

/**
 * Factory function to create rate limiter with provider presets
 */
export function createRateLimiter(
  providerOrConfig: string | RateLimitConfig,
  customConfig?: Partial<RateLimitConfig>
): RateLimiter {
  let config: RateLimitConfig;

  if (typeof providerOrConfig === 'string') {
    // Provider presets
    switch (providerOrConfig) {
      case 'anilist':
        config = {
          name: 'AniList',
          strategy: 'adaptive',
          requestsPerMinute: 30, // Current degraded limit
          windowMs: 60000,
          adaptiveHeaders: {
            limit: 'x-ratelimit-limit',
            remaining: 'x-ratelimit-remaining',
            reset: 'x-ratelimit-reset'
          },
          minDelayMs: 100,
          backoffStrategy: BackoffStrategy.EXPONENTIAL,
          ...customConfig
        };
        break;
      case 'comicvine':
        config = {
          name: 'ComicVine',
          strategy: 'sliding',
          requestsPerHour: 200,
          windowMs: 3600000,
          minDelayMs: 2000,
          maxDelayMs: 10000,
          backoffStrategy: BackoffStrategy.EXPONENTIAL,
          warningThreshold: 0.7,
          errorThreshold: 0.9,
          ...customConfig
        };
        break;
      case 'fandom':
        config = {
          name: 'Fandom',
          strategy: 'token',
          bucketSize: 100,
          refillRate: 2,
          maxConcurrent: 5,
          minDelayMs: 500,
          ...customConfig
        };
        break;
      case 'mangadex':
        config = {
          name: 'MangaDex',
          strategy: 'sliding',
          requestsPerMinute: 40, // MangaDex allows ~5 req/s but we stay conservative
          windowMs: 60000,
          minDelayMs: 200,
          maxDelayMs: 5000,
          backoffStrategy: BackoffStrategy.EXPONENTIAL,
          ...customConfig
        };
        break;
      case 'wikipedia':
        config = {
          name: 'Wikipedia',
          strategy: 'sliding',
          requestsPerMinute: 100, // Wikipedia is quite generous
          windowMs: 60000,
          minDelayMs: 100,
          ...customConfig
        };
        break;
      default:
        throw new Error(`Unknown provider preset: ${providerOrConfig}`);
    }
  } else {
    config = providerOrConfig;
  }

  return new RateLimiter(config);
}
