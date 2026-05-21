/**
 * Transmission Torrent Operations
 *
 * Core CRUD operations for torrent management.
 * Includes add, get status, pause, resume, and remove operations.
 *
 * Extracted from: transmissionClient.ts
 */

import type { DownloadItem, AddDownloadOptions, GetStatusOptions, DownloadStatusInfo } from '@/server/services/download/base';
import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isSuccess,
  isError,
  isLoading,
} from '@/utils/async-result';
import { toNumberId, toStringId } from '@/utils/id-converters';

import { convertTorrentToDownloadItem } from './torrent-utils';

import type { TransmissionTorrentsResponse, TransmissionTorrentAddResponse, TransmissionAddParams } from './types';

// Re-export utilities for backward compatibility
export { convertTorrentToDownloadItem, mapStatus } from './torrent-utils';

/** Base fields for torrent queries */
const BASE_TORRENT_FIELDS = [
  'id', 'hashString', 'name', 'status', 'percentDone', 'rateDownload', 'rateUpload', 'eta',
  'totalSize', 'sizeWhenDone', 'downloadedEver', 'uploadedEver', 'uploadRatio', 'errorString',
  'error', 'addedDate', 'doneDate', 'downloadDir', 'isFinished', 'isStalled', 'labels', 'activityDate',
];

/** Get torrent fields based on options */
function getTorrentFields(options?: GetStatusOptions, includePriority = false): string[] {
  const fields = [...BASE_TORRENT_FIELDS];
  if (includePriority) fields.push('bandwidthPriority');
  if (options?.includeFiles) fields.push('files', 'fileStats');
  if (options?.includePeers) fields.push('peers');
  if (options?.includeTrackers) fields.push('trackers');
  return fields;
}

/** Client interface for torrent operations */
export interface TorrentOperationsClient {
  _rpcRequest<T>(method: string, params?: Record<string, unknown>): Promise<AsyncResult<T, Error>>;
  errorFactory(message: string, operation: string): Error;
}

/** Adds a download from a URL */
export async function addUrl(
  client: TorrentOperationsClient,
  options: AddDownloadOptions
): Promise<AsyncResult<{ id: string }, Error>> {
  const result = await addUrlInternal(client, options);
  if (isSuccess(result)) return createSuccessResult({ id: result.data });
  if (isError(result)) return createErrorResult(result.error);
  if (isLoading(result)) {
    return createErrorResult(new Error(`Operation still in progress: addUrl for URL ${options.url}`));
  }
  return createErrorResult(new Error('Failed to add URL to Transmission: operation not started'));
}

/**
 * For HTTP URLs, fetch the .torrent file and return as base64 content.
 * Transmission can't reliably fetch from Prowlarr/indexer URLs directly (timeouts).
 * Sending torrent data as metainfo is the standard approach — same as Sonarr/Radarr.
 */
async function fetchTorrentAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch {
    return null;
  }
}

/** Build the source params (filename or metainfo) based on URL type */
async function buildSourceParams(url: string): Promise<Pick<TransmissionAddParams, 'filename' | 'metainfo'>> {
  // Magnet links go directly as filename
  if (url.startsWith('magnet:')) {
    return { filename: url };
  }
  // HTTP URLs: fetch .torrent ourselves and send as base64 metainfo (Sonarr/Radarr approach)
  const base64Torrent = await fetchTorrentAsBase64(url);
  if (base64Torrent) {
    return { metainfo: base64Torrent };
  }
  // Fallback to filename if fetch fails
  return { filename: url };
}

/** Build optional params from AddDownloadOptions */
function buildOptionalParams(options: AddDownloadOptions): Partial<TransmissionAddParams> {
  const params: Partial<TransmissionAddParams> = {};
  if (options.destination) params.downloadDir = options.destination;
  if (options.priority) params.bandwidthPriority = options.priority;
  if (options.category) {
    params.labels = Array.isArray(options.category) ? options.category : [options.category];
  }
  if (options.clientSpecific && typeof options.clientSpecific === 'object') {
    Object.entries(options.clientSpecific).forEach(([key, value]) => {
      (params as Record<string, unknown>)[key] = value;
    });
  }
  return params;
}

/** Internal implementation of addUrl */
async function addUrlInternal(
  client: TorrentOperationsClient,
  options: AddDownloadOptions
): Promise<AsyncResult<string, Error>> {
  try {
    const sourceParams = await buildSourceParams(options.url);
    const params: TransmissionAddParams = {
      ...sourceParams,
      paused: options.paused ?? false,
      ...buildOptionalParams(options)
    };

    const result = await client._rpcRequest<TransmissionTorrentAddResponse>('torrent-add', params);

    if (isError(result)) return createErrorResult(result.error);
    if (!isSuccess(result)) {
      return createErrorResult(new Error('Unknown error occurred during torrent addition'));
    }

    // Support both camelCase (Transmission 3.x) and kebab-case (Transmission 4.x) response keys
    const torrent = result.data.torrentAdded ?? result.data['torrent-added']
        ?? result.data.torrentDuplicate ?? result.data['torrent-duplicate'];
    if (!torrent) {
      return createErrorResult(
        client.errorFactory('Failed to add torrent: No torrent data returned', 'add_torrent')
      );
    }

    return createSuccessResult(toStringId(torrent['id']));
  } catch (error: unknown) {
    return createErrorResult(
      error instanceof Error ? error : new Error(`Failed to add torrent: ${String(error)}`)
    );
  }
}

/** Gets the status of a download */
export async function getStatus(
  client: TorrentOperationsClient,
  id: string,
  options?: GetStatusOptions
): Promise<AsyncResult<DownloadStatusInfo, Error>> {
  const result = await getStatusInternal(client, id, options);
  if (isSuccess(result)) {
    const item = result.data;
    const statusInfo: DownloadStatusInfo = {
      id: item['id'], name: item['name'], status: item['status'], progress: item.progress,
      downloadSpeed: item.downloadSpeed, totalSize: item.size ?? item.totalSize,
      downloadedSize: item.downloaded ?? item.downloadedSize,
      ...(item.uploadSpeed !== undefined && { uploadSpeed: item.uploadSpeed }),
      ...(item.eta !== undefined && { eta: item.eta }),
      ...(item.error !== undefined && { error: item.error }),
      ...(item.ratio !== undefined && { seedRatio: item.ratio }),
      ...(item.seedRatio !== undefined && !item.ratio && { seedRatio: item.seedRatio }),
      ...(item.peers !== undefined && { peers: item.peers }),
      ...(item.seeds !== undefined && { seeds: item.seeds }),
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- savePath is always defined but needs conditional spread (not in base interface)
      ...(item.savePath !== undefined && { savePath: item.savePath }),
    };
    return createSuccessResult(statusInfo);
  }
  if (isError(result)) return createErrorResult(result.error);
  if (isLoading(result)) {
    return createErrorResult(new Error(`Operation still in progress: getStatus for ID ${id}`));
  }
  return createErrorResult(new Error(`Failed to get status for torrent with ID ${id}: operation not started`));
}

/** Internal implementation of getStatus */
async function getStatusInternal(
  client: TorrentOperationsClient,
  id: string,
  options?: GetStatusOptions
): Promise<AsyncResult<DownloadItem, Error>> {
  try {
    const fields = getTorrentFields(options, true);
    const result = await client._rpcRequest<TransmissionTorrentsResponse>('torrent-get', {
      ids: toNumberId(id),
      fields,
    });
    if (isError(result)) return createErrorResult(result.error);
    if (!isSuccess(result)) return createErrorResult(new Error('Invalid response from Transmission'));
    const torrent = result.data.torrents[0];
    if (!torrent) {
      return createErrorResult(client.errorFactory(`Torrent with ID ${id} not found`, 'get_status'));
    }
    return createSuccessResult(convertTorrentToDownloadItem(torrent));
  } catch (error: unknown) {
    return createErrorResult(
      error instanceof Error ? error : new Error(`Failed to get torrent status: ${String(error)}`)
    );
  }
}

/** Gets all downloads */
export async function getAllItems(
  client: TorrentOperationsClient,
  options?: GetStatusOptions
): Promise<AsyncResult<DownloadItem[], Error>> {
  const result = await getAllItemsInternal(client, options);
  if (isSuccess(result)) return createSuccessResult(result.data);
  if (isError(result)) return createErrorResult(result.error);
  if (isLoading(result)) {
    return createErrorResult(new Error('Operation still in progress: getAllItems'));
  }
  return createErrorResult(new Error('Failed to get all torrent items: operation not started'));
}

/** Internal implementation of getAllItems */
async function getAllItemsInternal(
  client: TorrentOperationsClient,
  options?: GetStatusOptions
): Promise<AsyncResult<DownloadItem[], Error>> {
  try {
    const fields = getTorrentFields(options);
    const result = await client._rpcRequest<TransmissionTorrentsResponse>('torrent-get', { fields });
    if (isError(result)) return createErrorResult(result.error);
    if (!isSuccess(result)) return createErrorResult(new Error('Invalid response from Transmission'));
    const downloadItems = result.data.torrents.map((torrent) => convertTorrentToDownloadItem(torrent));
    return createSuccessResult(downloadItems);
  } catch (error: unknown) {
    return createErrorResult(
      error instanceof Error ? error : new Error(`Failed to get all torrent items: ${String(error)}`)
    );
  }
}

/** Pauses a download */
export async function pauseItem(
  client: TorrentOperationsClient,
  id: string
): Promise<AsyncResult<boolean, Error>> {
  const result = await pauseItemInternal(client, id);
  if (isSuccess(result)) return createSuccessResult(result.data);
  if (isError(result)) return createErrorResult(result.error);
  if (isLoading(result)) {
    return createErrorResult(new Error(`Operation still in progress: pauseItem for ID ${id}`));
  }
  return createErrorResult(new Error(`Failed to pause torrent with ID ${id}: operation not started`));
}

/** Internal implementation of pauseItem */
async function pauseItemInternal(
  client: TorrentOperationsClient,
  id: string
): Promise<AsyncResult<boolean, Error>> {
  try {
    const result = await client._rpcRequest('torrent-stop', { ids: toNumberId(id) });
    if (isError(result)) return createErrorResult(result.error);
    return createSuccessResult(true);
  } catch (error: unknown) {
    return createErrorResult(
      error instanceof Error ? error : new Error(`Failed to pause torrent: ${String(error)}`)
    );
  }
}

/** Resumes a download */
export async function resumeItem(
  client: TorrentOperationsClient,
  id: string
): Promise<AsyncResult<boolean, Error>> {
  const result = await resumeItemInternal(client, id);
  if (isSuccess(result)) return createSuccessResult(result.data);
  if (isError(result)) return createErrorResult(result.error);
  if (isLoading(result)) {
    return createErrorResult(new Error(`Operation still in progress: resumeItem for ID ${id}`));
  }
  return createErrorResult(new Error(`Failed to resume torrent with ID ${id}: operation not started`));
}

/** Internal implementation of resumeItem */
async function resumeItemInternal(
  client: TorrentOperationsClient,
  id: string
): Promise<AsyncResult<boolean, Error>> {
  try {
    const result = await client._rpcRequest('torrent-start', { ids: toNumberId(id) });
    if (isError(result)) return createErrorResult(result.error);
    return createSuccessResult(true);
  } catch (error: unknown) {
    return createErrorResult(
      error instanceof Error ? error : new Error(`Failed to resume torrent: ${String(error)}`)
    );
  }
}

/** Removes a download */
export async function removeItem(
  client: TorrentOperationsClient,
  id: string,
  deleteFiles?: boolean
): Promise<AsyncResult<boolean, Error>> {
  const result = await removeItemInternal(client, id, deleteFiles ?? false);
  if (isSuccess(result)) return createSuccessResult(result.data);
  if (isError(result)) return createErrorResult(result.error);
  if (isLoading(result)) {
    return createErrorResult(new Error(`Operation still in progress: removeItem for ID ${id}`));
  }
  return createErrorResult(new Error(`Failed to remove torrent with ID ${id}: operation not started`));
}

/** Internal implementation of removeItem */
async function removeItemInternal(
  client: TorrentOperationsClient,
  id: string,
  deleteFiles: boolean = false
): Promise<AsyncResult<boolean, Error>> {
  try {
    const result = await client._rpcRequest('torrent-remove', {
      ids: toNumberId(id),
      'delete-local-data': deleteFiles,
    });
    if (isError(result)) return createErrorResult(result.error);
    return createSuccessResult(true);
  } catch (error: unknown) {
    return createErrorResult(
      error instanceof Error ? error : new Error(`Failed to remove torrent: ${String(error)}`)
    );
  }
}
