/**
 * Prowlarr API Utilities
 *
 * This module provides a standardized approach for communicating with Prowlarr
 * through a Next.js API endpoint, with robust error handling, retries, and
 * consistent logging.
 */
import { getErrorMessage } from '@/utils/errors/helpers';

import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
/**
 * Configuration options for Prowlarr API requests
 *
 * @typedef {Object} ProwlarrRequestOptions
 * @property {string} path - The API endpoint path
 * @property {string} [method='GET'] - HTTP method to use
 * @property {Object} [body] - Request body for POST/PUT requests
 * @property {Object} [params] - Query parameters
 * @property {number} [timeout=10000] - Request timeout in milliseconds
 */
export interface ProwlarrRequestOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  timeout?: number;
}
/**
 * Interface for error details from Prowlarr
 */
interface ProwlarrErrorDetail {
  errorMessage?: string;
  [key: string]: unknown;
}

/**
 * Interface for parsed error data from Prowlarr API
 */
interface ProwlarrErrorData {
  message?: string;
  error?: string;
  details?: ProwlarrErrorDetail[];
}

/**
 * Type guard to check if value is ProwlarrErrorData
 */
function isProwlarrErrorData(value: unknown): value is ProwlarrErrorData {
  return typeof value === 'object' && value !== null;
}
/**
 * Extended Error interface for Prowlarr errors
 */
interface ProwlarrError extends Error {
  details?: unknown;
  originalError?: unknown;
  statusCode?: number;
  requestInfo?: {
    method: string;
    path: string;
    baseURL?: string;
  };
}
/**
 * Normalize the API path to include /api/v1 prefix
 */
function normalizeApiPath(path: string): string {
  if (path.startsWith('/api/v1')) {
    return path;
  }
  return `/api/v1${path.startsWith('/') ? path : '/' + path}`;
}

/**
 * Create request body for the proxy endpoint
 */
function createProxyBody(
  config: { baseURL?: string; apiKey?: string; username?: string; password?: string },
  normalizedPath: string,
  method: string,
  params: Record<string, string>,
  body?: unknown
): Record<string, unknown> {
  return {
    data: JSON.stringify({
      endpoint: normalizedPath,
      method,
      params,
      body
    }),
    prowlarrUrl: config.baseURL,
    prowlarrApiKey: config.apiKey,
    prowlarrUsername: config.username,
    prowlarrPassword: config.password
  };
}

/**
 * Get user-friendly error message for common indexer connection errors
 */
function getIndexerErrorMessage(detailMessage: string): string {
  if (detailMessage.includes('Forbidden')) {
    return 'Cannot access this indexer - it may be blocking access or requires authentication';
  }
  if (detailMessage.includes('CloudFlare')) {
    return 'This indexer is protected by CloudFlare and cannot be accessed automatically';
  }
  if (detailMessage.includes('timed out')) {
    return 'Connection to indexer timed out - the site may be slow or unavailable';
  }
  return 'Unable to connect to indexer - the site may be down or inaccessible';
}

/**
 * Get user-friendly error message based on error details
 */
function getUserFriendlyErrorMessage(errorData: ProwlarrErrorData): string {
  const baseMessage = errorData.message ?? errorData.error ?? 'Unknown error';

  if (!errorData.details || !Array.isArray(errorData.details)) {
    return `Prowlarr API error: ${baseMessage}`;
  }

  const detailMessages = errorData.details
    .filter((detail: ProwlarrErrorDetail) => detail.errorMessage)
    .map((detail: ProwlarrErrorDetail) => detail.errorMessage);

  if (detailMessages.length === 0) {
    return `Prowlarr API error: ${baseMessage}`;
  }

  const detailMessage = detailMessages.join('. ');

  if (detailMessage.includes('Unable to connect to indexer')) {
    return getIndexerErrorMessage(detailMessage);
  }
  if (detailMessage.includes('Invalid API key')) {
    return 'Invalid API key - please check your credentials';
  }
  if (detailMessage.includes('rate limit') || detailMessage.includes('too many requests')) {
    return 'Rate limit reached - please try again later';
  }

  return detailMessage;
}

/**
 * Create a Prowlarr error from response data
 */
function createProwlarrError(responseText: string, status: number): ProwlarrError {
  try {
    const parsed = JSON.parse(responseText) as unknown;
    if (!isProwlarrErrorData(parsed)) {
      throw new SyntaxError('Not a valid Prowlarr error response');
    }

    const userFriendlyMessage = getUserFriendlyErrorMessage(parsed);
    const prowlarrError = new Error(userFriendlyMessage) as ProwlarrError;
    prowlarrError.details = parsed.details;
    prowlarrError.originalError = parsed;
    prowlarrError.statusCode = status;

    logger.error('Parsed error data:', parsed);
    return prowlarrError;
  } catch (e: unknown) {
    // If it's our custom error, rethrow it
    if (e instanceof Error && (e as ProwlarrError).details) {
      throw e;
    }
    // Not valid JSON (likely HTML error page)
    if (e instanceof SyntaxError) {
      logger.error('Non-JSON error response', { responseText: responseText.substring(0, 200) });
      throw new Error(`Server returned an invalid response (status ${status}): ${responseText.substring(0, 100)}`);
    }
    throw e;
  }
}

/**
 * Handle HTTP error responses
 */
async function handleErrorResponse(response: Response): Promise<never> {
  const responseText = await response.text();
  logger.error(`Prowlarr API error (${response.status}):`, responseText);
  throw createProwlarrError(responseText, response.status);
}

/**
 * Handle successful HTTP responses
 */
async function handleSuccessResponse(response: Response): Promise<unknown> {
  const responseText = await response.text();
  try {
    return responseText ? JSON.parse(responseText) : null;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    logger.error('Failed to parse successful response as JSON:', errorMessage);
    throw new Error('Server returned an invalid JSON response');
  }
}

/**
 * Handle fetch errors (timeout, network errors)
 */
function handleFetchError(error: unknown, timeout: number, baseURL?: string): never {
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw new Error(`Prowlarr API request timed out after ${timeout}ms. Check if Prowlarr is running and accessible at ${baseURL}`);
  }

  const errorMessage = getErrorMessage(error);
  if (error instanceof TypeError && errorMessage.includes('fetch')) {
    throw new Error(`Cannot connect to Prowlarr at ${baseURL}. Please check if the URL is correct and Prowlarr is running.`);
  }

  throw error;
}

/**
 * Client-side function to send a request to Prowlarr through our API endpoint
 *
 * @param {Object} config - Prowlarr configuration (baseURL, apiKey)
 * @param {ProwlarrRequestOptions} options - Request configuration options
 * @returns {Promise<unknown>} - Response data from Prowlarr
 */
export async function prowlarrClientRequest(
  config: { baseURL?: string; apiKey?: string; username?: string; password?: string },
  { path, method = 'GET', body, params = {}, timeout = 10000 }: ProwlarrRequestOptions
): Promise<unknown> {
  try {
    logger.debug('[prowlarrApi] Request config:', {
      hasBaseURL: !!config.baseURL,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length ?? 0,
      baseURL: config.baseURL,
      path
    });

    if (!config.baseURL || !config.apiKey) {
      throw new ValidationError("Missing Prowlarr configuration: baseURL and apiKey are required");
    }

    const normalizedPath = normalizeApiPath(path);
    logger.info(`Sending request to Prowlarr: ${method} ${normalizedPath}`);

    const proxyBody = createProxyBody(config, normalizedPath, method, params, body);
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(proxyBody),
      credentials: 'include' // Include cookies for session authentication
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch('/api/prowlarr', {
        ...requestOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return await handleErrorResponse(response);
      }

      return await handleSuccessResponse(response);
    } catch (error: unknown) {
      handleFetchError(error, timeout, config.baseURL);
    }
  } catch (outerError: unknown) {
    logger.error('Prowlarr API request failed:', outerError);

    const errorToThrow = outerError instanceof Error ? outerError : new Error(String(outerError));

    const prowlarrError = errorToThrow as ProwlarrError;
    prowlarrError.requestInfo = {
      method,
      path,
      ...(config.baseURL && { baseURL: config.baseURL })
    };

    throw errorToThrow;
  }
}
/**
 * Create a client object for interacting with Prowlarr API
 *
 * @param {Object} config - Configuration for the client
 * @returns {Object} - Client object with methods for API interaction
 */
export function createProwlarrClient(config: {
  baseURL?: string;
  apiKey?: string;
  username?: string;
  password?: string;
}): {
  get: (path: string, params?: Record<string, string>) => Promise<unknown>;
  post: (path: string, data: unknown) => Promise<unknown>;
  put: (path: string, data: unknown) => Promise<unknown>;
  delete: (path: string) => Promise<unknown>;
  search: (query: string, options?: Record<string, unknown>) => Promise<unknown>;
  getIndexers: () => Promise<unknown>;
  getIndexer: (id: number) => Promise<unknown>;
  updateIndexer: (indexer: unknown) => Promise<unknown>;
  deleteIndexer: (id: number) => Promise<void>;
  testIndexer: (indexer: unknown) => Promise<unknown>;
  getSystemStatus: () => Promise<unknown>;
  testConnection: () => Promise<boolean>;
} {
  return {
    /**
     * Make a GET request to the Prowlarr API
     *
     * @param {string} path - API endpoint path
     * @param {Object} params - Query parameters
     * @returns {Promise<unknown>} Response data
     */
    get: (path: string, params?: Record<string, string>): Promise<unknown> => {
      return prowlarrClientRequest(config, {
        path,
        method: 'GET',
        ...(params !== undefined ? { params } : {})
      });
    },
    /**
     * Make a POST request to the Prowlarr API
     *
     * @param {string} path - API endpoint path
     * @param {Object} data - Request body
     * @returns {Promise<unknown>} Response data
     */
    post: (path: string, data: unknown): Promise<unknown> => {
      return prowlarrClientRequest(config, {
        path,
        method: 'POST',
        body: data as Record<string, unknown>
      });
    },
    /**
     * Make a PUT request to the Prowlarr API
     *
     * @param {string} path - API endpoint path
     * @param {Object} data - Request body
     * @returns {Promise<unknown>} Response data
     */
    put: (path: string, data: unknown): Promise<unknown> => {
      return prowlarrClientRequest(config, {
        path,
        method: 'PUT',
        body: data as Record<string, unknown>
      });
    },
    /**
     * Make a DELETE request to the Prowlarr API
     *
     * @param {string} path - API endpoint path
     * @returns {Promise<unknown>} Response data
     */
    delete: (path: string): Promise<unknown> => {
      return prowlarrClientRequest(config, {
        path,
        method: 'DELETE'
      });
    },
    /**
     * Search for manga using Prowlarr
     *
     * @param {string} query - Search query
     * @param {Object} options - Additional search options
     * @returns {Promise<unknown>} Search results
     */
    search: (query: string, options: Record<string, unknown> = {}): Promise<unknown> => {
      // Convert options to string parameters
      const params: Record<string, string> = {
        query
      };
      // Convert options object to string parameters
      Object.entries(options).forEach(([key, value]) => {
        if (value !== null) {
          params[key] = String(value);
        }
      });
      // Use GET instead of POST for search operations
      return prowlarrClientRequest(config, {
        path: '/search',
        method: 'GET',
        params
      });
    },
    /**
     * Get all indexers from Prowlarr
     *
     * @returns {Promise<unknown>} List of indexers
     */
    getIndexers: (): Promise<unknown> => {
      return prowlarrClientRequest(config, {
        path: '/indexer'
      });
    },

    /**
     * Get a specific indexer by ID
     *
     * @param {number} id - The indexer ID
     * @returns {Promise<unknown>} The indexer
     */
    getIndexer: (id: number): Promise<unknown> => {
      return prowlarrClientRequest(config, {
        path: `/indexer/${id}`
      });
    },

    /**
     * Update an existing indexer
     *
     * @param {unknown} indexer - The indexer to update
     * @returns {Promise<unknown>} The updated indexer
     */
    updateIndexer: (indexer: unknown): Promise<unknown> => {
      const indexerObj = indexer as Record<string, unknown>;
      const indexerId = typeof indexerObj['id'] === 'number' ? indexerObj['id'] : 0;
      return prowlarrClientRequest(config, {
        path: `/indexer/${indexerId}`,
        method: 'PUT',
        body: indexerObj
      });
    },

    /**
     * Delete an indexer
     *
     * @param {number} id - The ID of the indexer to delete
     * @returns {Promise<void>} Promise that resolves when deleted
     */
    deleteIndexer: (id: number): Promise<void> => {
      return prowlarrClientRequest(config, {
        path: `/indexer/${id}`,
        method: 'DELETE'
      }) as Promise<void>;
    },

    /**
     * Test an indexer configuration
     *
     * @param {unknown} indexer - The indexer to test
     * @returns {Promise<unknown>} Test result
     */
    testIndexer: (indexer: unknown): Promise<unknown> => {
      return prowlarrClientRequest(config, {
        path: '/indexer/test',
        method: 'POST',
        body: indexer as Record<string, unknown>
      });
    },
    /**
     * Get system status from Prowlarr
     *
     * @returns {Promise<unknown>} System status information
     */
    getSystemStatus: (): Promise<unknown> => {
      return prowlarrClientRequest(config, {
        path: '/system/status'
      });
    },
    /**
     * Test the connection to Prowlarr
     *
     * @returns {Promise<boolean>} True if connection successful, false otherwise
     */
    testConnection: async (): Promise<boolean> => {
      try {
        const result = await prowlarrClientRequest(config, {
          path: '/system/status',
          timeout: 10000
        });
        logger.info('Prowlarr connection test successful:', result);
        return true;
      }
      catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        logger.error('Prowlarr connection test failed:', errorMessage);
        return false;
      }
    }
  };
}