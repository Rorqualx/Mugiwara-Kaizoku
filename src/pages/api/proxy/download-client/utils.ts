/**
 * Download Client Proxy Utilities Module
 *
 * Shared helper functions, type definitions, and validation schemas
 * used across all download client proxy modules.
 *
 * Extracted from: download-client.ts
 */

import { getConfig, getConfigBoolean } from '@/server/utils/configReader';
import { logger } from '@/utils/logger';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Response object type for Next.js API routes
 */
export interface NextApiResponse {
  status: (code: number) => NextApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (body: unknown) => void;
}

/**
 * Configuration for proxy request handling
 */
export interface ProxyRequestConfig {
  req: Record<string, unknown>;
  res: NextApiResponse;
  clientType: string;
  clientEndpoint: string;
  method: string;
  data: unknown;
}

/**
 * Configuration for Deluge proxy requests
 */
export interface DelugeProxyConfig {
  req: Record<string, unknown>;
  res: NextApiResponse;
  baseURL: string;
  password: string;
  endpoint: string;
  method: string;
  data: unknown;
}

/**
 * Configuration for client authentication
 */
export interface ClientAuthConfig {
  baseURL: string;
  auth: string;
  isApiKey: boolean;
}

/**
 * Unified client configuration interface
 */
export interface ClientConfig {
  baseURL: string | null | undefined;
  auth: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid download client types
 */
export const VALID_CLIENT_TYPES = ['transmission', 'deluge', 'nzbget', 'sabnzbd'] as const;

/**
 * Download client type
 */
export type DownloadClientType = typeof VALID_CLIENT_TYPES[number];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely access property on unknown object
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Type guard to check if value is a record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate client type
 */
export function isValidClientType(clientType: string): clientType is DownloadClientType {
  return VALID_CLIENT_TYPES.includes(clientType as DownloadClientType);
}

/**
 * Get client configuration prefix
 */
export function getClientConfigPrefix(clientType: DownloadClientType): string {
  return `download.${clientType}.`;
}

/**
 * Load client configuration
 */
export async function loadClientConfig(clientType: DownloadClientType): Promise<ClientAuthConfig | null> {
  const prefix = getClientConfigPrefix(clientType);

  // Check if client is enabled
  const enabled = await getConfigBoolean(`${prefix}enabled`, false);
  if (!enabled) {
    return null;
  }

  // Get base URL
  const baseURL = await getConfig(`${prefix}baseURL`);
  if (!baseURL) {
    return null;
  }

  let auth = '';
  const isApiKey = clientType !== 'deluge';

  switch (clientType) {
    case 'transmission':
      auth = (await getConfig(`${prefix}apiKey`)) ?? '';
      break;
    case 'deluge':
      auth = (await getConfig(`${prefix}password`)) ?? '';
      break;
    case 'nzbget': {
      const username = (await getConfig(`${prefix}username`)) ?? '';
      const password = (await getConfig(`${prefix}password`)) ?? '';
      auth = `${username}:${password}`;
      break;
    }
    case 'sabnzbd':
      auth = (await getConfig(`${prefix}apiKey`)) ?? '';
      break;
    default:
      // Handle unexpected client types gracefully
      return null;
  }

  if (!auth) {
    return null;
  }

  return { baseURL, auth, isApiKey };
}

/**
 * Create error response
 */
export function createErrorResponse(
  res: NextApiResponse,
  status: number,
  error: string,
  details?: string
): void {
  const response: Record<string, unknown> = { error };
  if (details) {
    response['details'] = details;
  }
  res.status(status).json(response);
}

/**
 * Handle Axios errors
 */
export function handleAxiosError(error: unknown, clientType: string, res: NextApiResponse): void {
  logger.error(`Error proxying request to ${clientType}:`, error);

  if (isAxiosError(error)) {
    const axiosErr = error;
    if (axiosErr.code === 'ECONNREFUSED') {
      return createErrorResponse(
        res,
        503,
        `Cannot connect to ${clientType}`,
        'Connection refused'
      );
    }
    if (axiosErr.code === 'ETIMEDOUT') {
      return createErrorResponse(
        res,
        504,
        `Request to ${clientType} timed out`
      );
    }
    return createErrorResponse(
      res,
      502,
      `Error communicating with ${clientType}`,
      error instanceof Error ? error.message : String(error)
    );
  }

  return createErrorResponse(
    res,
    500,
    'Internal server error',
    error instanceof Error ? error.message : 'Unknown error'
  );
}

/**
 * Type guard for Axios errors
 */
export function isAxiosError(error: unknown): error is import('axios').AxiosError {
  return typeof error === 'object' && error !== null && 'isAxiosError' in error;
}

/**
 * Build authentication headers
 */
export function buildAuthHeaders(auth: string, isApiKey: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (isApiKey) {
    headers['X-Api-Key'] = auth;
  } else {
    headers['Authorization'] = `Basic ${Buffer.from(auth).toString('base64')}`;
  }

  return headers;
}

/**
 * Validate required parameters
 */
export function validateRequiredParameters(
  clientType: string | undefined,
  clientEndpoint: string | undefined,
  res: NextApiResponse
): boolean {
  if (!clientType || !clientEndpoint) {
    createErrorResponse(res, 400, 'Missing required parameters');
    return false;
  }

  if (!isValidClientType(clientType)) {
    createErrorResponse(res, 400, 'Invalid client type');
    return false;
  }

  return true;
}
