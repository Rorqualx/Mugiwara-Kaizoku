/**
 * API Client Utilities
 * 
 * This module exports all shared utilities for API clients, providing a
 * consistent foundation for all API integrations in the application.
 */

// HTTP Client
export {
  createHttpClient,
  type HttpClient,
  type HttpClientConfig,
  type RequestOptions,
  type HttpClientResponse
} from './httpClient';

// Authentication (only password hashing utilities available)
export {
  hashPassword,
  verifyPassword,
  generateToken
} from './auth';

// Error Handling - imported from httpClient which defines ApiError
export {
  ApiError,
  type ErrorContext
} from './httpClient';

// Rate Limiting
export {
  createRateLimiter,
  RateLimiter,
  type RateLimitConfig,
  type RateLimitInfo,
  type RateLimitStrategy
} from './rateLimit';

// Caching
export {
  createCache,
  Cache,
  memoize,
  type CacheConfig
} from './caching';