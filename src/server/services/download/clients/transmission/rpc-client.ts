/**
 * Transmission RPC Client
 *
 * Handles all RPC communication with Transmission daemon.
 * Supports both direct and proxied communication modes.
 *
 * Extracted from: transmissionClient.ts (lines 778-974)
 */

import { withEnhancedErrorHandling } from '@/server/services/download/utils/errorHandling';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError, isLoading } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';

import { isTransmissionResponse } from './types';

import type {
  TransmissionResponse,
  RpcRequestParams,
  RpcRequestPayload,
  ProxyRequestConfig,
} from './types';

/**
 * Interface for the RPC client context
 * Defines properties required by RPC operations from the main client
 */
export interface RpcClientContext {
  /** Current session ID for Transmission API authentication */
  sessionId: string | null;
  /** Whether to use proxy mode for requests */
  proxyMode: boolean;
  /** Path for proxy requests */
  proxyPath: string;
  /** Optional username for authentication */
  username?: string;
  /** Optional password for authentication */
  password?: string;
  /** Client configuration */
  config: { baseURL?: string };
  /** Build URL for requests */
  buildUrl(path: string): string;
  /** Create error with operation context */
  errorFactory(message: string, operation: string): Error;
}

/**
 * Makes an RPC request to the Transmission API
 *
 * @template T - The expected return type from the RPC call
 * @param client - RPC client context
 * @param method - RPC method name
 * @param params - RPC parameters
 * @returns Promise that resolves to the response data
 * @throws Error if the request fails
 */
export async function rpcRequest<T>(
  client: RpcClientContext,
  method: string,
  params: RpcRequestParams = {}
): Promise<T> {
  const result = await rpcRequestInternal<T>(client, method, params);
  if (isSuccess(result)) {
    return result.data;
  }
  if (isError(result)) {
    throw result.error;
  }
  if (isLoading(result)) {
    throw new ValidationError(`Operation still in progress: rpcRequest ${method}`);
  }
  throw new ValidationError(`Failed to execute RPC request: ${method}: operation not started`);
}

/**
 * Internal implementation of rpcRequest using AsyncResult pattern
 *
 * @template T - The expected return type from the RPC call
 * @param client - RPC client context
 * @param method - RPC method name
 * @param params - RPC parameters
 * @returns Promise that resolves to AsyncResult with response data
 */
export async function rpcRequestInternal<T>(
  client: RpcClientContext,
  method: string,
  params: RpcRequestParams = {},
  retryCount: number = 0
): Promise<AsyncResult<T, Error>> {
  try {
    if (client.proxyMode) {
      return await proxyRequest<T>(client, method, params);
    }
    else {
      return await directRequest<T>(client, method, params);
    }
  }
  catch (error: unknown) {
    // Handle 409 session ID refresh — directRequest already updates client.sessionId,
    // so we just need to detect the 409 and retry with the new session ID (max 1 retry)
    if (error instanceof Error && error.message.includes('409') && client.sessionId && retryCount < 1) {
      return rpcRequestInternal<T>(client, method, params, retryCount + 1);
    }
    return createErrorResult(
      error instanceof Error
        ? client.errorFactory(`Transmission RPC error calling ${method}: ${error.message}`, 'rpc_error')
        : new Error(`RPC request failed: ${String(error)}`)
    );
  }
}

/**
 * Makes a direct RPC request to the Transmission API
 *
 * @template T - The expected return type from the RPC call
 * @param client - RPC client context
 * @param method - RPC method name
 * @param params - RPC parameters
 * @returns Promise that resolves to AsyncResult with response data
 */
export async function directRequest<T>(
  client: RpcClientContext,
  method: string,
  params: RpcRequestParams = {}
): Promise<AsyncResult<T, Error>> {
  try {
    // Set up headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    // Add session ID if available
    if (client.sessionId) {
      headers['X-Transmission-Session-Id'] = client.sessionId;
    }
    // Create the request payload
    const payload: RpcRequestPayload = {
      method,
      arguments: params
    };
    // Make the request using fetch with 30s timeout
    const url = client.buildUrl('');
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000)
    });

    // HTTP 409 has two meanings in Transmission:
    // 1. Session ID invalid - returns HTML with X-Transmission-Session-Id header
    // 2. Duplicate torrent - returns JSON with torrentDuplicate field
    // Check for session ID header to distinguish
    if (!response.ok) {
      if (response.status === 409) {
        const newSessionId = response.headers.get('X-Transmission-Session-Id');
        if (newSessionId) {
          // Session ID invalid - update and throw to trigger retry
          const mutableClient = client as typeof client & { sessionId: string | null };
          mutableClient.sessionId = newSessionId;
          throw new ValidationError(`409: Session ID updated, retry required`);
        }
        // No session ID header - this is a duplicate torrent response
        // Continue to parse as JSON
      } else {
        // Other HTTP errors
        throw new ValidationError(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const httpResponse = (await response.json()) as TransmissionResponse<T>;
    // Validate that the response has the expected structure
    if (!isTransmissionResponse<T>(httpResponse)) {
      return createErrorResult(client.errorFactory('Transmission API error: Invalid response format', 'invalid_format'));
    }
    // Validate the response result
    if (httpResponse.result !== 'success') {
      return createErrorResult(client.errorFactory(`Transmission API error: ${httpResponse.result}`, 'api_error'));
    }
    // Safe type assertion for the result
    if (httpResponse.arguments === undefined) {
      return createErrorResult(client.errorFactory('Transmission API error: Missing result arguments', 'no_result'));
    }
    return createSuccessResult(httpResponse.arguments);
  }
  catch (error: unknown) {
    // Check for 409 Conflict (session ID invalid)
    if (error instanceof Error && error.toString().includes('409')) {
      throw error; // Let the caller handle session ID refresh
    }
    // Transform other errors
    return createErrorResult(
      error instanceof Error
        ? client.errorFactory(`Transmission API direct request error: ${error instanceof Error ? error.message : String(error)}`, 'direct_error')
        : new Error(`Direct RPC request failed: ${String(error)}`)
    );
  }
}

/**
 * Makes a proxied RPC request to the Transmission API
 *
 * @template T - The expected return type from the RPC call
 * @param client - RPC client context
 * @param method - RPC method name
 * @param params - RPC parameters
 * @returns Promise that resolves to AsyncResult with response data
 */
export async function proxyRequest<T>(
  client: RpcClientContext,
  method: string,
  params: RpcRequestParams = {}
): Promise<AsyncResult<T, Error>> {
  const result = await withEnhancedErrorHandling(async () => {
    try {
      // Create the request payload
      const payload: RpcRequestPayload = {
        method,
        arguments: params
      };
      // Create the proxy configuration
      const proxyConfig: ProxyRequestConfig = {
        baseURL: client.config.baseURL ?? client.buildUrl(''),
        username: client.username ?? '',
        password: client.password ?? ''
      };
      // Make request through proxy
      const proxyUrl = client.buildUrl(client.proxyPath);
      const url = new URL(proxyUrl);
      Object.entries(proxyConfig).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
      const fetchResponse = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000)
      });
      if (!fetchResponse.ok) {
        throw new ValidationError(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
      }
      const response = await fetchResponse.json() as unknown;
      // Check if the response exists
      if (!response) {
        throw client.errorFactory('No response received from proxy request', 'proxyRequest');
      }
      try {
        // Check if the response has the expected TransmissionResponse structure
        if (isTransmissionResponse<T>(response)) {
          // If it's a properly structured response, return the arguments directly
          return createSuccessResult(response.arguments);
        }
        // Otherwise, return the response as-is
        return createSuccessResult(response as T);
      }
      catch (extractError: unknown) {
        throw client.errorFactory(
          `Failed to extract response data: ${extractError instanceof Error ? extractError.message : String(extractError)}`,
          'proxyRequest'
        );
      }
    }
    catch (error: unknown) {
      // Pass through 409 errors for session ID handling
      if (error instanceof Error && (error instanceof Error ? error.message : String(error)).includes('409')) {
        throw error; // Let the caller handle session ID refresh
      }
      // Transform other errors
      throw client.errorFactory(
        `Transmission API proxy request error: ${error instanceof Error ? error.message : String(error)}`,
        'proxyRequest'
      );
    }
  }, `proxyRequest[${method}]`);
  return result as AsyncResult<T, Error>;
}
