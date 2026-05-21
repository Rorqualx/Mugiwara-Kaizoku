/**
 * Central export for all Zod schemas
 *
 * Import schemas from this file for consistency
 */

// Manga domain schemas
export * from './monitoring-config.schema';
export * from './provider-metadata.schema';
export * from './raw-provider-data.schema';
export * from './selected-source-id.schema';

// API response schemas
export * from './api-response.schema';
export * from './integration-api.schema';
export * from './metadata-provider.schema';
export * from './ml-pattern-learning.schema';

// Client-side schemas
export * from './localstorage.schema';
export * from './search-provider.schema';

/**
 * Usage Examples:
 *
 * 1. Database JSON parsing:
 * ```typescript
 * import { parseMonitoringConfig } from '@/schemas';
 *
 * const rawConfig = JSON.parse(manga.monitoringConfig);
 * const config = parseMonitoringConfig(rawConfig);
 * if (!config) {
 *   // Handle validation error
 *   return defaultConfig;
 * }
 * ```
 *
 * 2. API response validation:
 * ```typescript
 * import { parseApiResponse, UserCrudResponseSchema } from '@/schemas';
 *
 * const response = await fetch('/api/users/create', { ... });
 * const data = await response.json();
 * const result = parseApiResponse(data, UserCrudResponseSchema);
 * ```
 *
 * 3. localStorage parsing:
 * ```typescript
 * import { parseRecentSearches } from '@/schemas';
 *
 * const stored = localStorage.getItem('recent-searches');
 * if (stored) {
 *   const searches = parseRecentSearches(JSON.parse(stored));
 *   if (searches) {
 *     setRecentSearches(searches);
 *   }
 * }
 * ```
 *
 * 4. Integration API responses:
 * ```typescript
 * import { parseKavitaAuthResponse } from '@/schemas';
 *
 * const response = await fetch(`${host}/api/Plugin/authenticate`, { ... });
 * const data = await response.json();
 * const authData = parseKavitaAuthResponse(data);
 * if (authData) {
 *   this.token = authData.token;
 * }
 * ```
 */
