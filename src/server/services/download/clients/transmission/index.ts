/**
 * Transmission API Client - Main Aggregator
 *
 * Thin wrapper that delegates to focused modules.
 * Each module handles specific responsibilities.
 *
 * Architecture:
 * - types.ts (237 lines) - Type definitions
 * - rpc-client.ts (280 lines) - RPC communication
 * - torrent-operations.ts (660 lines) - Torrent CRUD
 * - session-operations.ts (356 lines) - Session management
 *
 * Original: 1126 lines -> Refactored: ~170 lines (85% reduction)
 */


import { DownloadStatus } from '@prisma/client';

import {
  BaseDownloadClient,
  type DownloadItem,
  type AddDownloadOptions,
  type GetStatusOptions,
  type ApiClientConfig,
  type ConnectionStatus,
  type DownloadStatusInfo,
} from '@/server/services/download/base';
import type { AsyncResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';




// Import and re-export types
export * from './types';
export type { TransmissionSessionResponse } from './session-operations';

// Import module functions
import { rpcRequestInternal, type RpcClientContext } from './rpc-client';
import {
  getSessionInfo,
  getFreeSpace,
  setDownloadDir,
  addLabels as sessionAddLabels,
  ping,
  testConnection,
  type SessionOperationsClient,
  type TransmissionSessionResponse,
} from './session-operations';
import {
  addUrl,
  getStatus,
  getAllItems,
  pauseItem,
  resumeItem,
  removeItem,
  mapStatus,
  type TorrentOperationsClient,
} from './torrent-operations';

/**
 * Unified Transmission API client
 *
 * Note: The class is compatible with RpcClientContext, TorrentOperationsClient,
 * and SessionOperationsClient interfaces but doesn't explicitly implement them
 * because the base class has protected members that the interfaces require public.
 */
export class TransmissionClient extends BaseDownloadClient {
  public name = 'transmission';
  public type: 'torrent' | 'usenet' = 'torrent';
  public proxyMode: boolean;
  public proxyPath: string = '/api/proxy/transmission';
  public sessionInfo?: TransmissionSessionResponse;
  private category?: string;

  constructor(config: ApiClientConfig) {
    super(config);
    this.proxyMode =
      (config as ApiClientConfig & { proxyMode?: boolean }).proxyMode ?? false;
    if (config.category !== undefined) {
      this.category = config.category;
    }
  }

  protected buildUrl(path: string): string {
    const baseUrl = super.buildUrl(path);
    if (baseUrl.includes('/transmission/rpc')) {
      return baseUrl;
    }
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}/transmission/rpc`;
  }

  // Delegate to RPC client
  public async _rpcRequest<T>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<AsyncResult<T, Error>> {
    return rpcRequestInternal(this as unknown as RpcClientContext, method, params);
  }

  // Delegate to torrent operations
  public async addUrl(
    options: AddDownloadOptions
  ): Promise<AsyncResult<{ id: string }, Error>> {
    // Fall back to the constructor-set category (Transmission label) when the
    // call site doesn't override it.
    const effectiveOptions: AddDownloadOptions =
      options.category === undefined && this.category !== undefined
        ? { ...options, category: this.category }
        : options;
    return addUrl(this as unknown as TorrentOperationsClient, effectiveOptions);
  }

  public async getStatus(
    id: string,
    options?: GetStatusOptions
  ): Promise<AsyncResult<DownloadStatusInfo, Error>> {
    return getStatus(this as unknown as TorrentOperationsClient, id, options);
  }

  public async getAllItems(
    options?: GetStatusOptions
  ): Promise<AsyncResult<DownloadItem[], Error>> {
    return getAllItems(this as unknown as TorrentOperationsClient, options);
  }

  public async pauseItem(id: string): Promise<AsyncResult<boolean, Error>> {
    return pauseItem(this as unknown as TorrentOperationsClient, id);
  }

  public async resumeItem(id: string): Promise<AsyncResult<boolean, Error>> {
    return resumeItem(this as unknown as TorrentOperationsClient, id);
  }

  public async removeItem(
    id: string,
    deleteFiles?: boolean
  ): Promise<AsyncResult<boolean, Error>> {
    return removeItem(this as unknown as TorrentOperationsClient, id, deleteFiles);
  }

  // Delegate to session operations
  public async getSessionInfo(): Promise<TransmissionSessionResponse> {
    return getSessionInfo(this as unknown as SessionOperationsClient);
  }

  public async getFreeSpace(path?: string): Promise<number> {
    return getFreeSpace(this as unknown as SessionOperationsClient, path);
  }

  public async setDownloadDir(path: string): Promise<boolean> {
    return setDownloadDir(this as unknown as SessionOperationsClient, path);
  }

  public async addLabels(id: string, labels: string[]): Promise<boolean> {
    return sessionAddLabels(this as unknown as SessionOperationsClient, toNumberId(id), labels);
  }

  public async testConnection(): Promise<AsyncResult<ConnectionStatus, Error>> {
    return testConnection(this as unknown as SessionOperationsClient);
  }

  protected async ping(): Promise<void> {
    return ping(this as unknown as SessionOperationsClient);
  }

  protected mapStatus(transmissionStatus: unknown): DownloadStatus {
    return mapStatus(transmissionStatus);
  }

  public getClientType(): string {
    return 'transmission';
  }

  public dispose(): void {
    this.sessionId = null;
    delete this.sessionInfo;
  }
}

/**
 * Creates a Transmission client
 */
export function createTransmissionClient(
  config: ApiClientConfig
): TransmissionClient {
  return new TransmissionClient(config);
}
