/**
 * Deluge API Client
 *
 * A unified client for interacting with the Deluge BitTorrent client's JSON-RPC API.
 * This implementation follows the consolidation architecture and provides a consistent
 * interface with robust error handling and resource management.
 *
 * Architecture:
 * This file serves as the main aggregator/facade for the decomposed Deluge client modules:
 * - types.ts: Interfaces, enums, types
 * - rate-limiter.ts: DelugeRateLimiter class
 * - authentication.ts: Authentication logic
 * - rpc-client.ts: RPC request functions
 * - torrent-operations.ts: Add/get operations
 * - torrent-control.ts: Pause/resume/remove operations
 * - status-utils.ts: Status mapping utilities
 *
 * Features:
 * - JSON-RPC based communication with automatic authentication
 * - Standardized error handling and status mapping
 * - Complete torrent management functionality
 * - Support for both direct and proxied communication
 * - Proper resource cleanup
 * - Enhanced contextual error handling
 */

import { DownloadStatus } from '@prisma/client';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { BaseDownloadClient } from '../base';
import { withEnhancedErrorHandling, createContextualErrorCreator } from '../utils/errorHandling';

// Import from decomposed modules
import { ensureAuthenticated } from './deluge/authentication';
import { createRpcRequest, RpcClientConfig } from './deluge/rpc-client';
import { mapDelugeStatus } from './deluge/status-utils';
import {
    pauseItem as pauseItemOperation,
    resumeItem as resumeItemOperation,
    removeItem as removeItemOperation,
} from './deluge/torrent-control';
import {
    addUrl as addUrlOperation,
    getStatus as getStatusOperation,
    getAllItems as getAllItemsOperation,
    TorrentOperationsContext,
} from './deluge/torrent-operations';
import {
    DelugeRateLimiter,
    DelugeAuthState,
    DelugeDaemonInfo,
    RequestCache,
} from './deluge/types';

import type {
    DownloadItem,
    AddDownloadOptions,
    GetStatusOptions,
    ApiClientConfig,
    ConnectionStatus,
    DownloadStatusInfo
} from '../base';

/**
 * Unified Deluge API client
 */
export class DelugeClient extends BaseDownloadClient {
    public name = 'deluge';
    public type: 'torrent' | 'usenet' = 'torrent';

    private password: string;
    private proxyMode: boolean;
    private proxyPath: string = '/api/proxy/deluge';
    private requestId: number = 0;
    private category?: string;

    // Authentication state
    private authState: DelugeAuthState;

    // Rate limiting
    private delugeRateLimiter: DelugeRateLimiter;
    private requestCache: RequestCache | null = null;
    private createContextualError: ReturnType<typeof createContextualErrorCreator>;

    // RPC request function (created lazily)
    private rpcRequestFn: ReturnType<typeof createRpcRequest> | null = null;

    /**
     * Creates a new Deluge client
     *
     * @param config - Client configuration
     */
    constructor(config: ApiClientConfig) {
        super(config);

        this.password = config.password ?? '';
        this.proxyMode = false;
        if (config.category !== undefined) {
            this.category = config.category;
        }
        this.delugeRateLimiter = new DelugeRateLimiter(10);
        this.requestCache = null;
        this.createContextualError = createContextualErrorCreator('DelugeClient');

        // Initialize authentication state
        this.authState = {
            authenticated: false,
            connected: false,
            sessionCookie: null,
            hostId: null,
        };
    }

    /**
     * Creates the operations context for delegation
     */
    private getOperationsContext(): TorrentOperationsContext {
        return {
            ensureAuthenticated: () => this.ensureAuthenticatedInternal(),
            rpcRequest: <T>(method: string, params: unknown[]) => this.rpcRequest<T>(method, params),
            createContextualError: (msg: string) => this.createContextualError(msg),
        };
    }

    /**
     * Adds a download from a URL
     *
     * @param options - Download options
     * @returns Promise that resolves to AsyncResult with the download ID
     */
    public async addUrl(options: AddDownloadOptions): Promise<AsyncResult<{ id: string }, Error>> {
        // Fall back to the constructor-set category (Deluge label) when the
        // call site doesn't override it.
        const effectiveOptions: AddDownloadOptions =
            options.category === undefined && this.category !== undefined
                ? { ...options, category: this.category }
                : options;
        return addUrlOperation(this.getOperationsContext(), effectiveOptions);
    }

    /**
     * Gets the status of a download
     *
     * @param id - Download ID
     * @param options - Status options
     * @returns Promise that resolves to the download item
     */
    public async getStatus(id: string, options?: GetStatusOptions): Promise<AsyncResult<DownloadStatusInfo, Error>> {
        return getStatusOperation(this.getOperationsContext(), id, options);
    }

    /**
     * Gets all downloads
     *
     * @param options - Status options
     * @returns Promise that resolves to a list of download items
     */
    public async getAllItems(options?: GetStatusOptions): Promise<AsyncResult<DownloadItem[], Error>> {
        return getAllItemsOperation(this.getOperationsContext(), options);
    }

    /**
     * Pauses a download
     *
     * @param id - Download ID
     * @returns Promise that resolves to true if successful
     */
    public async pauseItem(id: string): Promise<AsyncResult<boolean, Error>> {
        return pauseItemOperation(this.getOperationsContext(), id);
    }

    /**
     * Resumes a download
     *
     * @param id - Download ID
     * @returns Promise that resolves to true if successful
     */
    public async resumeItem(id: string): Promise<AsyncResult<boolean, Error>> {
        return resumeItemOperation(this.getOperationsContext(), id);
    }

    /**
     * Removes a download
     *
     * @param id - Download ID
     * @param deleteFiles - Whether to delete downloaded files
     * @returns Promise that resolves to true if successful
     */
    public async removeItem(id: string, deleteFiles?: boolean): Promise<AsyncResult<boolean, Error>> {
        return removeItemOperation(this.getOperationsContext(), id, deleteFiles);
    }

    /**
     * Gets the client type
     *
     * @returns Client type
     */
    public getClientType(): string {
        return 'deluge';
    }

    /**
     * Internal wrapper for ensureAuthenticated that returns boolean for context compatibility
     */
    private async ensureAuthenticatedInternal(): Promise<AsyncResult<boolean, Error>> {
        const result = await this.ensureAuthenticated();
        if (isError(result)) {
            return result as AsyncResult<boolean, Error>;
        }
        return createSuccessResult(true);
    }

    /**
     * Ensures the client is authenticated and connected to a daemon
     *
     * @returns Promise that resolves to an AsyncResult with void (success) or Error
     */
    private async ensureAuthenticated(): Promise<AsyncResult<void, Error>> {
        return ensureAuthenticated(
            this.authState,
            this.password,
            <T>(method: string, params: unknown[], skipAuth: boolean) => this.rpcRequest<T>(method, params, skipAuth),
            this.createContextualError
        );
    }

    /**
     * Makes an RPC request to the Deluge API
     *
     * @param method - RPC method
     * @param params - RPC parameters
     * @param skipAuth - Whether to skip authentication check
     * @returns Promise that resolves to an AsyncResult with the response data or error
     */
    private async rpcRequest<T>(
        method: string,
        params: unknown[] = [],
        skipAuth: boolean = false
    ): Promise<AsyncResult<T, Error>> {
        // Create RPC request function lazily
        if (!this.rpcRequestFn) {
            const rpcConfig: RpcClientConfig = {
                password: this.password,
                proxyMode: this.proxyMode,
                proxyPath: this.proxyPath,
                delugeRateLimiter: this.delugeRateLimiter,
                buildUrl: (path: string) => this.buildUrl(path),
                createContextualError: this.createContextualError,
                config: { baseURL: this.config.baseURL ?? '' },
            };

            this.rpcRequestFn = createRpcRequest(
                rpcConfig,
                this.authState,
                () => this.ensureAuthenticated(),
                () => ++this.requestId
            );
        }

        return this.rpcRequestFn<T>(method, params, skipAuth);
    }

    /**
     * Maps Deluge status to standardized DownloadStatus
     *
     * @param state - Deluge state string
     * @returns Standardized download status
     */
    protected mapStatus(state: unknown): DownloadStatus {
        return mapDelugeStatus(state);
    }

    /**
     * Pings the API to check if it's available
     *
     * @returns Promise that resolves when the ping is successful
     */
    protected async ping(): Promise<void> {
        const result = await this._ping();
        if (isError(result)) {
            throw result.error;
        }
        return;
    }

    /**
     * Internal implementation of ping that returns AsyncResult
     *
     * @returns Promise that resolves to an AsyncResult with void if successful or error
     */
    private async _ping(): Promise<AsyncResult<void, Error>> {
        const result = await withEnhancedErrorHandling(async () => {
            const authResult = await this.ensureAuthenticated();
            if (isError(authResult)) {
                throw authResult.error;
            }

            // Get daemon info to verify connection
            const hostsResult = await this.rpcRequest<DelugeDaemonInfo[]>('web.get_hosts', []);

            if (!isSuccess(hostsResult)) {
                if (isError(hostsResult)) {
                    throw hostsResult.error;
                }
                throw this.createContextualError('Failed to get Deluge hosts');
            }

            const hosts = hostsResult.data;
            if (hosts.length === 0) {
                const error = this.createContextualError('No Deluge daemons found during connection test');
                logger.error('Deluge connection failed', {
                    error: error instanceof Error ? error.message : String(error)
                });
                throw error;
            }

            // Get first connected host
            const connectedHost = hosts.find((host: DelugeDaemonInfo) => host.connected);

            logger.info('Deluge connection successful', {
                version: `Deluge ${connectedHost?.version ?? 'unknown'} (${connectedHost?.name ?? 'unknown'})`
            });

            return createSuccessResult(undefined);
        }, `ping`);

        return result as AsyncResult<void, Error>;
    }

    /**
     * Test connection to the Deluge server
     *
     * @returns Promise that resolves to connection status
     */
    public async testConnection(): Promise<AsyncResult<ConnectionStatus, Error>> {
        try {
            const authResult = await this.ensureAuthenticated();
            if (isError(authResult)) {
                return createErrorResult(authResult.error);
            }

            // Get server info to verify connection
            const response = await this.rpcRequest<string>('daemon.get_version', []);
            if (isSuccess(response)) {
                return createSuccessResult({
                    connected: true,
                    version: response.data,
                    capabilities: ['torrent', 'pause', 'resume', 'remove']
                });
            }

            return createErrorResult(new Error('Failed to get Deluge version'));
        } catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Connection test failed'));
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.authState.authenticated = false;
        this.authState.connected = false;
        this.authState.sessionCookie = null;
        this.authState.hostId = null;

        if (this.requestCache) {
            this.requestCache = null;
        }

        this.rpcRequestFn = null;
    }
}

/**
 * Creates a Deluge client
 *
 * @param config - Client configuration
 * @returns Deluge client instance
 */
export function createDelugeClient(config: ApiClientConfig): DelugeClient {
    return new DelugeClient(config);
}
