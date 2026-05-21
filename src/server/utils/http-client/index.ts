/**
 * HTTP Client Module - Main Aggregator
 *
 * This module provides a standardized HTTP client system with:
 * - Type-safe request/response handling
 * - Multiple authentication methods (Basic, Bearer, API Key)
 * - Rate limiting support
 * - Retry logic with exponential backoff
 * - AsyncResult pattern for error handling
 *
 * Architecture:
 * - types.ts - Foundation types and interfaces
 * - auth.ts - Authentication manager factory
 * - utils.ts - Response extraction utilities
 * - axios-client.ts - Axios-based implementation
 *
 * Original file: httpClient.ts (807 lines) -> Refactored: 5 modules
 */

// Re-export all types
export type {
  HttpMethod,
  ErrorContext,
  AuthConfig,
  AuthManager,
  HttpClientConfig,
  RequestOptions,
  HttpClientResponse,
  HttpClient,
} from './types';

// Re-export error class
export { ApiError } from './types';

// Re-export auth manager factory
export { createAuthManager } from './auth';

// Re-export utilities
export { HttpClientUtils } from './utils';

// Import for factory function and re-export
import { AxiosHttpClient } from './axios-client';

import type { HttpClientConfig, HttpClient } from './types';

// Re-export axios client implementation
export { AxiosHttpClient };

// Re-export rate limiting types and factory
export type { RateLimiter, RateLimitConfig } from '../rateLimit';
export { createRateLimiter } from '../rateLimit';

/**
 * Creates an HTTP client
 *
 * @param config - HTTP client configuration
 * @returns HTTP client instance
 *
 * @example
 * ```typescript
 * import { createHttpClient } from '@/server/utils/http-client';
 *
 * const client = createHttpClient({
 *   baseURL: 'https://api.example.com',
 *   timeout: 30000,
 *   auth: { type: 'bearer', token: 'my-token' }
 * });
 *
 * const response = await client.get('/users');
 * ```
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  return new AxiosHttpClient(config);
}
