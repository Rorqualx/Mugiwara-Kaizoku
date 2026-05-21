/**
 * Download Client Proxy Request Builder Module
 *
 * Core proxy request handling logic for all download client types.
 * Extracted from: download-client.ts
 */

import axios from 'axios';

import { logger } from '@/utils/logger';

import {
  ClientAuthConfig,
  DownloadClientType,
  buildAuthHeaders,
  safeGet,
  isRecord
} from './utils';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for building proxy requests
 */
export interface RequestBuilderConfig {
  clientType: DownloadClientType;
  clientEndpoint: string;
  method: string;
  data: unknown;
  authConfig: ClientAuthConfig;
}

/**
 * Response from proxy request
 */
export interface ProxyResponse {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
}

// ============================================================================
// Core Request Builder Functions
// ============================================================================

/**
 * Build the full URL for the proxy request
 */
export function buildFullURL(baseURL: string, clientEndpoint: string): string {
  // Ensure baseURL ends with a slash and clientEndpoint doesn't start with one
  const normalizedBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  const normalizedEndpoint = clientEndpoint.startsWith('/') ? clientEndpoint.slice(1) : clientEndpoint;
  
  return `${normalizedBaseURL}/${normalizedEndpoint}`;
}

/**
 * Execute the proxy request
 */
export async function executeProxyRequest(config: RequestBuilderConfig): Promise<ProxyResponse> {
  const { clientType, clientEndpoint, method, data, authConfig } = config;
  const { baseURL, auth, isApiKey } = authConfig;

  const url = buildFullURL(baseURL, clientEndpoint);
  const headers = buildAuthHeaders(auth, isApiKey);

  logger.debug(`Proxying ${method} request to ${clientType}: ${url}`);

  const response = await axios({
    method,
    url,
    headers,
    data: method !== 'GET' ? data : undefined,
    timeout: 30000, // 30 second timeout
    validateStatus: () => true, // Don't throw on HTTP errors
  });

  return {
    status: response.status,
    data: response.data,
    headers: response.headers as Record<string, string>,
  };
}

/**
 * Handle Transmission-specific session conflicts
 */
export async function handleTransmissionConflict(
  config: RequestBuilderConfig,
  response: ProxyResponse
): Promise<ProxyResponse> {
  if (config.clientType !== 'transmission') {
    return response;
  }

  // Check for Transmission session conflict
  if (response.status === 409 && isRecord(response.data)) {
    const conflictData = response.data;
    const sessionId = safeGet(conflictData, 'arguments') && 
                      isRecord(safeGet(conflictData, 'arguments')) &&
                      safeGet(safeGet(conflictData, 'arguments'), 'session-id');

    if (sessionId && typeof sessionId === 'string') {
      logger.debug('Handling Transmission session conflict, retrying with new session ID');
      
      // Retry the request with the new session ID
      const retryConfig = {
        ...config,
        data: {
          ...(isRecord(config.data) ? config.data : {}),
          'X-Transmission-Session-Id': sessionId,
        },
      };

      return executeProxyRequest(retryConfig);
    }
  }

  return response;
}

/**
 * Get Transmission session ID for initial requests
 */
export function getTransmissionSessionId(data: unknown): string | undefined {
  if (isRecord(data) && data['X-Transmission-Session-Id']) {
    return String(data['X-Transmission-Session-Id']);
  }
  return undefined;
}

/**
 * Forward Transmission session ID from response to subsequent requests
 */
export function forwardTransmissionSessionId(
  response: ProxyResponse,
  nextData: unknown
): unknown {
  if (isRecord(response.data) && response.data['X-Transmission-Session-Id']) {
    const sessionId = response.data['X-Transmission-Session-Id'];
    if (isRecord(nextData)) {
      return {
        ...nextData,
        'X-Transmission-Session-Id': sessionId,
      };
    }
  }
  return nextData;
}

/**
 * Main proxy request handler - orchestrates the entire proxy flow
 */
export async function handleProxyRequest(config: RequestBuilderConfig): Promise<ProxyResponse> {
  const { clientType, data } = config;

  // Handle Transmission session management
  if (clientType === 'transmission') {
    const sessionId = getTransmissionSessionId(data);
    if (sessionId) {
      const requestConfig = {
        ...config,
        data: {
          ...(isRecord(config.data) ? config.data : {}),
          'X-Transmission-Session-Id': sessionId,
        },
      };
      
      const response = await executeProxyRequest(requestConfig);
      return handleTransmissionConflict(requestConfig, response);
    }
  }

  // Execute the initial request
  const response = await executeProxyRequest(config);
  
  // Handle Transmission conflicts
  if (clientType === 'transmission') {
    return handleTransmissionConflict(config, response);
  }

  return response;
}
