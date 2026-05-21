/**
 * HTTP Client Auth Module
 *
 * Authentication management for HTTP clients.
 * Supports Basic, Bearer, and API Key authentication.
 *
 * Extracted from: httpClient.ts
 */

import type { AuthConfig, AuthManager } from './types';

/**
 * Creates an authentication manager for HTTP requests
 *
 * @param config - Authentication configuration
 * @returns AuthManager with methods to get auth headers and params
 *
 * @example
 * ```typescript
 * const auth = createAuthManager({ type: 'bearer', token: 'my-token' });
 * const headers = auth.getAuthHeaders();
 * // { Authorization: 'Bearer my-token' }
 * ```
 */
export function createAuthManager(config: AuthConfig): AuthManager {
  return {
    getAuthHeaders(): Record<string, string> {
      if (config.type === 'basic' && config.credentials) {
        const encoded = Buffer.from(
          `${config.credentials.username}:${config.credentials.password}`
        ).toString('base64');
        return { Authorization: `Basic ${encoded}` };
      }
      if (config.type === 'bearer' && config.token) {
        return { Authorization: `Bearer ${config.token}` };
      }
      if (config.type === 'apiKey' && config.apiKey && config.apiKeyHeader) {
        return { [config.apiKeyHeader]: config.apiKey };
      }
      return {};
    },
    getAuthQueryParams(): Record<string, string> {
      if (config.type === 'apiKey' && config.apiKey && !config.apiKeyHeader) {
        return { apiKey: config.apiKey };
      }
      return {};
    }
  };
}
