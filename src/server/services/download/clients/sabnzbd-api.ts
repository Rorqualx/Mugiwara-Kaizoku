/**
 * SABnzbd API Request Handling Module
 *
 * Handles HTTP communication with SABnzbd API.
 * Supports both direct API calls and proxied requests.
 *
 * Extracted from: sabnzbdClient.ts (lines 411-492)
 */

import { ValidationError } from '@/utils/errors';

// Configuration interface for API requests
export interface SabnzbdApiConfig {
  apiKey: string;
  proxyMode: boolean;
  proxyPath: string;
  buildUrl: (path: string) => string;
  buildAuthHeaders: () => Record<string, string>;
}

// ============================================================================
// API Request Handling
// ============================================================================

/**
 * Makes an API request to SABnzbd
 *
 * @param config - API configuration
 * @param mode - API mode
 * @param params - Additional parameters
 * @returns Promise that resolves to the response data
 */
export async function apiRequest<T>(
  config: SabnzbdApiConfig,
  mode: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  if (config.proxyMode) {
    // Use proxy endpoint
    return proxyRequest<T>(config, mode, params);
  } else {
    // Use direct API
    return directRequest<T>(config, mode, params);
  }
}

/**
 * Makes a direct API request to SABnzbd
 *
 * @param config - API configuration
 * @param mode - API mode
 * @param params - Additional parameters
 * @returns Promise that resolves to the response data
 */
export async function directRequest<T>(
  config: SabnzbdApiConfig,
  mode: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  // Prepare query parameters
  const queryParams: Record<string, string> = {
    apikey: config.apiKey,
    output: 'json',
    ...params
  };

  // Set mode if not already set in params
  if (!params['mode']) {
    queryParams['mode'] = mode;
  }

  try {
    // Make GET request to API
    const url = config.buildUrl('/api');
    const response = await fetch(`${url}?${new URLSearchParams(queryParams).toString()}`, {
      headers: config.buildAuthHeaders()
    });

    if (!response.ok) {
      throw new ValidationError(`HTTP error! status: ${response.status}`);
    }

    const result = (await response.json()) as T;
    return result;
  } catch (error: unknown) {
    // Transform error
    throw new Error(`SABnzbd API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Makes a proxied API request to SABnzbd
 *
 * @param config - API configuration
 * @param mode - API mode
 * @param params - Additional parameters
 * @returns Promise that resolves to the response data
 */
export async function proxyRequest<T>(
  config: SabnzbdApiConfig,
  mode: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  try {
    // Make POST request to proxy
    const url = config.buildUrl(config.proxyPath);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...config.buildAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode,
        params: {
          ...params,
          apikey: config.apiKey,
          output: 'json'
        }
      })
    });

    if (!response.ok) {
      throw new ValidationError(`HTTP error! status: ${response.status}`);
    }

    const result = (await response.json()) as T;
    return result;
  } catch (error: unknown) {
    // Transform error
    throw new Error(`SABnzbd API proxy error: ${error instanceof Error ? error.message : String(error)}`);
  }
}