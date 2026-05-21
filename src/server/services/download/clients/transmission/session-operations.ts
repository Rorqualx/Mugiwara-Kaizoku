/**
 * Transmission Session Operations
 *
 * Session management, settings, and connection testing operations.
 *
 * Extracted from: transmissionClient.ts
 */

import type { ConnectionStatus } from '@/server/services/download/base';
import { withEnhancedErrorHandling } from '@/server/services/download/utils/errorHandling';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError, isLoading } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';



/**
 * Transmission session response structure
 */
export interface TransmissionSessionResponse {
  version: string;
  rpcVersion: number;
  rpcVersionMinimum: number;
  downloadDir: string;
}

/**
 * Client interface for session operations
 */
export interface SessionOperationsClient {
  sessionInfo?: TransmissionSessionResponse;
  _rpcRequest<T>(method: string, params?: Record<string, unknown>): Promise<AsyncResult<T, Error>>;
  errorFactory(message: string, operation: string): Error;
  updateConnectionStatus(connected: boolean, error?: string): void;
}

/**
 * Gets session information
 *
 * @param client - The client instance
 * @returns Promise that resolves to session information
 */
export async function getSessionInfo(
  client: SessionOperationsClient
): Promise<TransmissionSessionResponse> {
  const result = await getSessionInfoInternal(client);
  if (isSuccess(result)) {
    return result.data;
  }
  if (isError(result)) {
    throw result.error;
  }
  if (isLoading(result)) {
    throw new ValidationError('Operation still in progress: getSessionInfo');
  }
  throw new ValidationError('Failed to get Transmission session information: operation not started');
}

/**
 * Internal implementation of getSessionInfo using AsyncResult pattern
 *
 * @param client - The client instance
 * @returns Promise that resolves to AsyncResult with session information
 */
export async function getSessionInfoInternal(
  client: SessionOperationsClient
): Promise<AsyncResult<TransmissionSessionResponse, Error>> {
  try {
    if (client.sessionInfo) {
      return createSuccessResult(client.sessionInfo);
    }
    const result = await client._rpcRequest<TransmissionSessionResponse>('session-get');
    if (isError(result)) {
      return createErrorResult(result.error);
    }
    if (!isSuccess(result)) {
      return createErrorResult(new Error('Invalid response from Transmission session-get'));
    }
    const mutableClient = client as typeof client & { sessionInfo: TransmissionSessionResponse | undefined };
    mutableClient.sessionInfo = result.data;
    return createSuccessResult(result.data);
  }
  catch (error: unknown) {
    return createErrorResult(error instanceof Error ? error : new Error(`Failed to get session info: ${String(error)}`));
  }
}

/**
 * Gets free space for a directory
 *
 * @param client - The client instance
 * @param path - Directory path
 * @returns Promise that resolves to free space in bytes
 */
export async function getFreeSpace(
  client: SessionOperationsClient,
  path?: string
): Promise<number> {
  const result = await getFreeSpaceInternal(client, path);
  if (isSuccess(result)) {
    return result.data;
  }
  if (isError(result)) {
    throw result.error;
  }
  if (isLoading(result)) {
    throw new ValidationError(`Operation still in progress: getFreeSpace for path ${path ?? 'default'}`);
  }
  throw new ValidationError(`Failed to get free space for path ${path ?? 'default'}: operation not started`);
}

/**
 * Internal implementation of getFreeSpace using AsyncResult pattern
 *
 * @param client - The client instance
 * @param path - Directory path
 * @returns Promise that resolves to AsyncResult with free space in bytes
 */
export async function getFreeSpaceInternal(
  client: SessionOperationsClient,
  path?: string
): Promise<AsyncResult<number, Error>> {
  try {
    const params: Record<string, unknown> = {};
    if (path) {
      params["path"] = path;
    }
    const result = await client._rpcRequest<{
      path: string;
      'size-bytes': number;
    }>('free-space', params);
    if (isError(result)) {
      return createErrorResult(result.error);
    }
    if (!isSuccess(result) || !result.data['size-bytes']) {
      return createErrorResult(new Error('Invalid response from Transmission free-space'));
    }
    return createSuccessResult(result.data['size-bytes']);
  }
  catch (error: unknown) {
    return createErrorResult(error instanceof Error ? error : new Error(`Failed to get free space: ${String(error)}`));
  }
}

/**
 * Sets the download directory
 *
 * @param client - The client instance
 * @param path - Directory path
 * @returns Promise that resolves to true if successful
 */
export async function setDownloadDir(
  client: SessionOperationsClient,
  path: string
): Promise<boolean> {
  const result = await setDownloadDirInternal(client, path);
  if (isSuccess(result)) {
    return result.data;
  }
  if (isError(result)) {
    throw result.error;
  }
  if (isLoading(result)) {
    throw new ValidationError(`Operation still in progress: setDownloadDir for path ${path}`);
  }
  throw new ValidationError(`Failed to set download directory to ${path}: operation not started`);
}

/**
 * Internal implementation of setDownloadDir using AsyncResult pattern
 *
 * @param client - The client instance
 * @param path - Directory path
 * @returns Promise that resolves to AsyncResult with boolean indicating success
 */
export async function setDownloadDirInternal(
  client: SessionOperationsClient,
  path: string
): Promise<AsyncResult<boolean, Error>> {
  try {
    const result = await client._rpcRequest('session-set', {
      'download-dir': path
    });
    if (isError(result)) {
      return createErrorResult(result.error);
    }
    return createSuccessResult(true);
  }
  catch (error: unknown) {
    return createErrorResult(error instanceof Error ? error : new Error(`Failed to set download directory: ${String(error)}`));
  }
}

/**
 * Adds labels to a torrent
 *
 * @param client - The client instance
 * @param id - Torrent ID
 * @param labels - Labels to add
 * @returns Promise that resolves to true if successful
 */
export async function addLabels(
  client: SessionOperationsClient,
  id: number,
  labels: string[]
): Promise<boolean> {
  const result = await addLabelsInternal(client, id, labels);
  if (isSuccess(result)) {
    return result.data;
  }
  if (isError(result)) {
    throw result.error;
  }
  if (isLoading(result)) {
    throw new ValidationError(`Operation still in progress: addLabels for ID ${id}`);
  }
  throw new ValidationError(`Failed to add labels to torrent with ID ${id}: operation not started`);
}

/**
 * Internal implementation of addLabels using AsyncResult pattern
 *
 * @param client - The client instance
 * @param id - Torrent ID
 * @param labels - Labels to add
 * @returns Promise that resolves to AsyncResult with boolean indicating success
 */
export async function addLabelsInternal(
  client: SessionOperationsClient,
  id: number,
  labels: string[]
): Promise<AsyncResult<boolean, Error>> {
  try {
    const result = await client._rpcRequest('torrent-set', {
      ids: id,
      labels
    });
    if (isError(result)) {
      return createErrorResult(result.error);
    }
    return createSuccessResult(true);
  }
  catch (error: unknown) {
    return createErrorResult(error instanceof Error ? error : new Error(`Failed to add labels: ${String(error)}`));
  }
}

/**
 * Pings the API to check if it's available
 *
 * @param client - The client instance
 * @returns Promise that resolves when the ping is successful
 */
export async function ping(
  client: SessionOperationsClient
): Promise<void> {
  const result = await pingInternal(client);
  if (isSuccess(result)) {
    return;
  }
  if (isError(result)) {
    throw result.error;
  }
  if (isLoading(result)) {
    throw new ValidationError('Ping operation still in progress');
  }
  throw new ValidationError('Failed to ping Transmission: operation not started');
}

/**
 * Internal implementation of ping that returns AsyncResult
 *
 * @param client - The client instance
 * @returns Promise that resolves to an AsyncResult with void if successful or error
 */
export async function pingInternal(
  client: SessionOperationsClient
): Promise<AsyncResult<void, Error>> {
  const result = await withEnhancedErrorHandling(async () => {
    const sessionInfoResult = await getSessionInfoInternal(client);
    if (isError(sessionInfoResult)) {
      const error = client.errorFactory('Failed to get Transmission session information', 'ping');
      client.updateConnectionStatus(false, error.message);
      throw error;
    }
    if (isSuccess(sessionInfoResult)) {
      client.updateConnectionStatus(true);
      // Store session info for internal use
      const mutableClient = client as typeof client & { sessionInfo: TransmissionSessionResponse | undefined };
      mutableClient.sessionInfo = sessionInfoResult.data;
      return createSuccessResult(undefined);
    }
    throw client.errorFactory('Failed to verify Transmission connection', 'ping');
  }, 'ping');
  return result as AsyncResult<void, Error>;
}

/**
 * Tests the connection to the API
 *
 * @param client - The client instance
 * @returns Promise that resolves to connection status
 */
export async function testConnection(
  client: SessionOperationsClient
): Promise<AsyncResult<ConnectionStatus, Error>> {
  try {
    const result = await pingInternal(client);
    if (isSuccess(result)) {
      const status: ConnectionStatus = {
        connected: true,
        ...(client.sessionInfo?.version !== undefined ? { version: client.sessionInfo.version } : {})
      };
      return createSuccessResult(status);
    }
    if (isError(result)) {
      const status: ConnectionStatus = {
        connected: false,
        error: result.error instanceof Error ? result.error.message : String(result.error)
      };
      return createSuccessResult(status);
    }
    const status: ConnectionStatus = {
      connected: false,
      error: 'Connection test did not complete'
    };
    return createSuccessResult(status);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    client.updateConnectionStatus(false, errorMessage);
    const status: ConnectionStatus = {
      connected: false,
      error: errorMessage
    };
    return createSuccessResult(status);
  }
}

/**
 * Internal implementation of testConnection that returns AsyncResult
 *
 * @param client - The client instance
 * @returns Promise that resolves to an AsyncResult with true if successful or error
 */
export async function testConnectionInternal(
  client: SessionOperationsClient
): Promise<AsyncResult<boolean, Error>> {
  const result = await withEnhancedErrorHandling(async () => {
    // Simply delegate to pingInternal which already has all the necessary error handling
    const pingResult = await pingInternal(client);
    if (isError(pingResult)) {
      return pingResult;
    }
    // Connection status is updated in pingInternal()
    return createSuccessResult(true);
  }, 'testConnection');
  return result as AsyncResult<boolean, Error>;
}
