/**
 * Unified Provider Registry Types
 *
 * Shared types and interfaces for the registry system.
 * Foundation module - all registry modules depend on this.
 *
 * Extracted from: UnifiedProviderRegistry.ts
 */

import type { SearchProvider } from '../types';

/**
 * Provider configuration state
 *
 * Tracks the runtime state of a provider including availability,
 * priority, and error/success timestamps.
 *
 * @property enabled - Whether the provider is currently enabled
 * @property priority - Numerical priority for provider ordering (lower = higher priority)
 * @property lastError - Most recent error encountered by this provider
 * @property lastSuccess - Timestamp of the last successful operation
 */
export interface ProviderState {
  enabled: boolean;
  priority: number;
  lastError?: Error;
  lastSuccess?: Date;
}

/**
 * Search provider with optional type field
 *
 * Extended SearchProvider interface that includes an optional type field
 * for providers that expose their type identifier.
 *
 * @example
 * ```typescript
 * const provider: SearchProviderWithType = {
 *   name: 'AniList',
 *   type: 'anilist',
 *   search: async (query) => { ... },
 *   getMetadata: async (id) => { ... }
 * };
 * ```
 */
export type SearchProviderWithType = SearchProvider & { type?: string };

/**
 * Provider error classification types
 *
 * Categorizes different types of provider errors for intelligent
 * error handling and fallback strategies.
 *
 * - `api_down` - Provider API is unavailable (503, 502)
 * - `rate_limit` - Rate limit exceeded (429)
 * - `network` - Network connectivity issues
 * - `auth` - Authentication/authorization failures (401)
 * - `unknown` - Unclassified error
 */
export type ProviderErrorType = 'api_down' | 'rate_limit' | 'network' | 'auth' | 'unknown';

/**
 * Options for provider lookup operations
 *
 * Configures how providers should be retrieved from the registry,
 * including fallback behavior and filtering options.
 *
 * @property type - Specific provider type to retrieve
 * @property fallbackToDefault - Whether to fallback to default provider if requested provider unavailable
 * @property skipDisabled - Whether to exclude disabled providers from results
 *
 * @example
 * ```typescript
 * const options: ProviderLookupOptions = {
 *   type: 'anilist',
 *   fallbackToDefault: true,
 *   skipDisabled: true
 * };
 * ```
 */
export interface ProviderLookupOptions {
  type?: string;
  fallbackToDefault?: boolean;
  skipDisabled?: boolean;
}
