/**
 * Deluge Torrent Operations
 *
 * Core torrent operation methods for adding URLs and retrieving status.
 * These are the main data retrieval operations for the Deluge client.
 * Extracted from: delugeClient.ts (lines 177-382)
 */

import type { DownloadItem, AddDownloadOptions, GetStatusOptions, DownloadStatusInfo } from '@/server/services/download/base';
import { withEnhancedErrorHandling } from '@/server/services/download/utils/errorHandling';
import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isSuccess,
  isError,
  isLoading,
} from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';


import { convertToDownloadItem } from './status-utils';

import type { DelugeTorrentStatus } from './types';


/**
 * Context interface for torrent operations
 * Provides access to the client's internal methods
 */
export interface TorrentOperationsContext {
  ensureAuthenticated: () => Promise<AsyncResult<boolean, Error>>;
  rpcRequest: <T>(method: string, params: unknown[]) => Promise<AsyncResult<T, Error>>;
  createContextualError: (message: string) => Error;
}

/**
 * Adds a torrent from URL or magnet link
 *
 * @param context - Operation context with client methods
 * @param options - Download options
 * @returns Promise that resolves to an AsyncResult with the download ID
 */
export async function addUrl(
  context: TorrentOperationsContext,
  options: AddDownloadOptions
): Promise<AsyncResult<{ id: string }, Error>> {
  const result = await addUrlInternal(context, options);

  if (isError(result)) {
    return createErrorResult(result.error);
  }

  if (isSuccess(result)) {
    return createSuccessResult({ id: result.data });
  }

  if (isLoading(result)) {
    return createErrorResult(new Error('Operation still in progress: addUrl'));
  }

  return createErrorResult(new Error('Failed to add URL to Deluge: operation not started'));
}

/**
 * Internal implementation of addUrl
 *
 * @param context - Operation context with client methods
 * @param options - Download options
 * @returns Promise that resolves to an AsyncResult with the download ID
 */
async function addUrlInternal(
  context: TorrentOperationsContext,
  options: AddDownloadOptions
): Promise<AsyncResult<string, Error>> {
  return withEnhancedErrorHandling(async () => {
    const authResult = await context.ensureAuthenticated();
    if (isError(authResult)) {
      throw authResult.error;
    }

    const params: Record<string, unknown> = {
      file_priorities: [],
      add_paused: options.paused ?? false,
      compact_allocation: false,
    };

    // Add optional parameters
    if (options.destination) {
      params['download_location'] = options.destination;
    }

    if (options.category) {
      params['label'] = options.category;
    }

    // Add client-specific options
    if (options.clientSpecific) {
      Object.assign(params, options.clientSpecific);
    }

    // Handle magnet links vs URLs
    let method: string;
    let methodParams: unknown[];

    if (options.url.startsWith('magnet:')) {
      method = 'core.add_torrent_magnet';
      methodParams = [options.url, params];
    } else {
      method = 'core.add_torrent_url';
      methodParams = [options.url, params];
    }

    // Make RPC request
    const result = await context.rpcRequest<string>(method, methodParams);
    if (isError(result)) {
      throw result.error;
    }

    if (!isSuccess(result) || !result.data) {
      throw context.createContextualError(`Failed to add torrent to Deluge client: ${options.url}`);
    }

    // Return the raw data, withEnhancedErrorHandling will wrap it
    return result.data;
  }, `addUrl for ${options.url}`);
}

/**
 * Gets the status of a download
 *
 * @param context - Operation context with client methods
 * @param id - Download ID
 * @param options - Status options
 * @returns Promise that resolves to the download status info
 */
export async function getStatus(
  context: TorrentOperationsContext,
  id: string,
  options?: GetStatusOptions
): Promise<AsyncResult<DownloadStatusInfo, Error>> {
  const result = await getStatusInternal(context, id, options);

  if (isError(result)) {
    return createErrorResult(result.error);
  }

  if (isSuccess(result)) {
    const item = result.data;
    const statusInfo: DownloadStatusInfo = {
      id: item['id'],
      name: item['name'],
      status: item['status'],
      progress: item.progress,
      downloadSpeed: item.downloadSpeed,
      totalSize: item.totalSize,
      downloadedSize: item.downloadedSize,
      ...(item.uploadSpeed !== undefined && { uploadSpeed: item.uploadSpeed }),
      ...(item.eta !== undefined && { eta: item.eta }),
    };
    return createSuccessResult(statusInfo);
  }

  if (isLoading(result)) {
    return createErrorResult(new Error(`Operation still in progress: getStatus for ID ${id}`));
  }

  return createErrorResult(new Error(`Failed to get status for download ID ${id}: operation not started`));
}

/**
 * Internal implementation of getStatus
 *
 * @param context - Operation context with client methods
 * @param id - Download ID
 * @param options - Status options
 * @returns Promise that resolves to an AsyncResult with the download item
 */
async function getStatusInternal(
  context: TorrentOperationsContext,
  id: string,
  options?: GetStatusOptions
): Promise<AsyncResult<DownloadItem, Error>> {
  return withEnhancedErrorHandling(async () => {
    const authResult = await context.ensureAuthenticated();
    if (isError(authResult)) {
      throw authResult.error;
    }

    // Define fields to retrieve
    const fields = [
      'state',
      'name',
      'total_size',
      'progress',
      'download_payload_rate',
      'upload_payload_rate',
      'eta',
      'ratio',
      'time_added',
      'completed_time',
      'save_path',
      'total_done',
      'total_uploaded',
      'label',
      'message',
    ];

    // Add additional fields based on options
    if (options?.includeFiles) {
      fields.push('files');
    }

    // Make RPC request
    const result = await context.rpcRequest<Record<string, DelugeTorrentStatus>>(
      'core.get_torrents_status',
      [{ hash: id }, fields]
    );

    if (!isSuccess(result)) {
      throw isError(result) ? result.error : context.createContextualError(`Failed to get torrent status from Deluge client: ${id}`);
    }

    // Ensure the torrent exists
    const torrentStatus = result.data[id];
    if (!torrentStatus) {
      throw new ValidationError(`Torrent with ID ${id} not found in Deluge client`);
    }

    // Convert to standardized DownloadItem
    const downloadItem = convertToDownloadItem(id, torrentStatus);

    // Return the raw data, withEnhancedErrorHandling will wrap it
    return downloadItem;
  }, `getStatus for ${id}`);
}

/**
 * Gets all downloads
 *
 * @param context - Operation context with client methods
 * @param options - Status options
 * @returns Promise that resolves to a list of download items
 */
export async function getAllItems(
  context: TorrentOperationsContext,
  options?: GetStatusOptions
): Promise<AsyncResult<DownloadItem[], Error>> {
  const result = await getAllItemsInternal(context, options);

  if (isError(result)) {
    return createErrorResult(result.error);
  }

  if (isSuccess(result)) {
    return createSuccessResult(result.data);
  }

  if (isLoading(result)) {
    return createErrorResult(new Error('Operation still in progress: getAllItems'));
  }

  return createErrorResult(new Error('Failed to get all download items from Deluge: operation not started'));
}

/**
 * Internal implementation of getAllItems
 *
 * @param context - Operation context with client methods
 * @param options - Status options
 * @returns Promise that resolves to an AsyncResult with a list of download items
 */
async function getAllItemsInternal(
  context: TorrentOperationsContext,
  options?: GetStatusOptions
): Promise<AsyncResult<DownloadItem[], Error>> {
  return withEnhancedErrorHandling(async () => {
    const authResult = await context.ensureAuthenticated();
    if (isError(authResult)) {
      throw authResult.error;
    }

    // Define fields to retrieve
    const fields = [
      'state',
      'name',
      'total_size',
      'progress',
      'download_payload_rate',
      'upload_payload_rate',
      'eta',
      'ratio',
      'time_added',
      'completed_time',
      'save_path',
      'total_done',
      'total_uploaded',
      'label',
      'message',
    ];

    // Add additional fields based on options
    if (options?.includeFiles) {
      fields.push('files');
    }

    // Make RPC request
    const result = await context.rpcRequest<Record<string, DelugeTorrentStatus>>(
      'core.get_torrents_status',
      [{}, fields]
    );

    if (!isSuccess(result)) {
      throw isError(result) ? result.error : context.createContextualError('Failed to retrieve torrent status data from Deluge client');
    }

    // Convert all torrents to standardized DownloadItems
    const downloadItems = Object.entries(result.data).map(([id, status]) => {
      // Convert to standardized format - status is typed as DelugeTorrentStatus
      return convertToDownloadItem(id, status);
    });

    // Return the raw data, withEnhancedErrorHandling will wrap it
    return downloadItems;
  }, 'getAllItems');
}
