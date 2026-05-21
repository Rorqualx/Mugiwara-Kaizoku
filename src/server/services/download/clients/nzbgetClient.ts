/**
 * NZBGet API Client
 *
 * A simplified client for interacting with the NZBGet Usenet client's JSON-RPC API.
 * This implementation follows the official NZBGet API documentation and uses
 * correct method names and parameter ordering.
 *
 * Key Implementation Details:
 * - Uses correct JSON-RPC method names (append, not appendurl)
 * - Uses positional parameters only (parameter order is critical)
 * - Handles authentication via HTTP Basic Auth
 * - Simplified response parsing
 * - Proper error handling for authentication failures
 */

import { DownloadStatus } from '@prisma/client';

import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { BaseDownloadClient } from '../base';
import { withEnhancedErrorHandling, createContextualErrorCreator } from '../utils/errorHandling';

import {
    type NzbgetRequest,
    type NzbgetGroup,
    type NzbgetHistoryItem,
    type NzbgetStatus,
    isHTMLResponse,
    validateResponseData,
    parseResponseText,
    extractJSONRPCResult,
    createAuthError,
    createHTTPError,
    handleError,
    hasResponseProperty,
} from './nzbget/utils';

import type { DownloadItem, AddDownloadOptions, GetStatusOptions, ApiClientConfig, ConnectionStatus, DownloadStatusInfo } from '../base';
/**
 * NZBGet client configuration
 */
// NzbgetConfig is just ApiClientConfig - use ApiClientConfig directly
// username, password and other fields are already in ApiClientConfig
/**
 * Simplified NZBGet API client
 */
export class NzbgetClient extends BaseDownloadClient {
    public name = 'nzbget';
    public type: 'torrent' | 'usenet' = 'usenet';
    private username: string;
    private password: string;
    private category?: string;
    private requestId: number = 0;
    private createContextualError: ReturnType<typeof createContextualErrorCreator>;
    /**
     * Creates a new NZBGet client
     *
     * @param config - Client configuration
     */
    constructor(config: ApiClientConfig) {
        // Pass only ApiClientConfig properties to super
        super(config);
        this.username = config.username ?? '';
        this.password = config.password ?? '';
        if (config.category !== undefined) {
            this.category = config.category;
        }
        this.createContextualError = createContextualErrorCreator('NzbgetClient');
    }

    /**
     * Builds a JSON-RPC request object
     */
    private buildJSONRPCRequest(method: string, params: unknown[]): NzbgetRequest {
        return {
            version: '1.1',
            method: method,
            params: params,
            id: ++this.requestId
        };
    }

    /**
     * Makes an authenticated HTTP request to NZBGet
     * @returns Response text
     */
    private async makeAuthenticatedRequest(request: NzbgetRequest): Promise<string> {
        const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        const url = this.buildUrl('/jsonrpc');

        logger.info('NZBGet auth details:', {
            username: this.username,
            passwordLength: this.password ? this.password.length : 0,
            hasAuth: !!(this.username && this.password),
            baseURL: this.config.baseURL
        });

        const fetchResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(request)
        });

        if (!fetchResponse.ok) {
            if (fetchResponse.status === 401) {
                throw createAuthError();
            }
            throw createHTTPError(fetchResponse.status);
        }

        return fetchResponse.text();
    }

    /**
     * Validates and extracts result from JSON-RPC response
     */
    private validateJSONRPCResponse<T>(responseText: string): T {
        // Parse response
        let parsed: unknown;
        try {
            parsed = JSON.parse(responseText);
        } catch (_e: unknown) {
            parsed = responseText;
        }

        // Check for HTML/auth failure
        if (typeof parsed === 'string') {
            if (isHTMLResponse(parsed)) {
                throw createAuthError('NZBGet returned HTML instead of JSON. Please check your username and password.');
            }
            // Try parsing again
            parsed = parseResponseText(parsed);
        }

        // Validate response structure
        validateResponseData(parsed);

        // Extract and return result
        return extractJSONRPCResult<T>(parsed);
    }

    /**
     * Makes a JSON-RPC request to NZBGet
     *
     * @param method - RPC method name
     * @param params - Method parameters (positional)
     * @returns Promise resolving to the result
     */
    private async jsonRpc<T = unknown>(method: string, params: unknown[] = []): Promise<AsyncResult<T, Error>> {
        const result = await withEnhancedErrorHandling(async () => {
            const request = this.buildJSONRPCRequest(method, params);

            try {
                const responseText = await this.makeAuthenticatedRequest(request);
                const validatedResult = this.validateJSONRPCResponse<T>(responseText);
                return createSuccessResult(validatedResult);
            } catch (error: unknown) {
                // Handle HTTP errors
                if (error instanceof Error) {
                    if (hasResponseProperty(error)) {
                        const status = error.response.status;
                        if (status === 401 || status === 403 || status === 404) {
                            return createErrorResult(createHTTPError(status, error.response.statusText));
                        }
                    }

                    // Check for connection errors
                    if (error.message.includes('ECONNREFUSED')) {
                        return createErrorResult(new Error('Connection refused. Please check if NZBGet is running and the URL is correct.'));
                    }

                    return createErrorResult(error);
                }
                return createErrorResult(handleError(error));
            }
        }, `jsonRpc: ${method}`);

        return result as AsyncResult<T, Error>;
    }
    /**
     * Adds a download from a URL
     *
     * @param options - Download options
     * @returns Promise that resolves to the download ID
     */
    public async addUrl(options: AddDownloadOptions): Promise<AsyncResult<{
        id: string;
    }, Error>> {
        return this._addUrl(options);
    }
    /**
     * Private implementation of addUrl
     *
     * @param options - Download options
     * @returns Promise that resolves to AsyncResult with download ID
     */
    private async _addUrl(options: AddDownloadOptions): Promise<AsyncResult<{
        id: string;
    }, Error>> {
        const result = await withEnhancedErrorHandling(async () => {
            // NZBGet 'append' method parameters (in exact order):
            // 1. NZBFilename (string) - empty for URL downloads
            // 2. Content (string) - base64 content or empty for URL downloads
            // 3. Category (string) - category or empty
            // 4. Priority (int) - 0 for normal
            // 5. AddToTop (bool) - false
            // 6. AddPaused (bool) - from options
            // 7. DupeKey (string) - empty
            // 8. DupeScore (int) - 0
            // 9. DupeMode (string) - "FORCE"
            // 10. Parameters (array) - must include the URL as a parameter
            const params = ['',
                // 1. NZBFilename (empty for URL)
                '',
                // 2. Content (empty for URL)
                options.category ?? this.category ?? '',
                // 3. Category
                0,
                // 4. Priority (0 = normal)
                false,
                // 5. AddToTop
                options.paused ?? false,
                // 6. AddPaused
                '',
                // 7. DupeKey
                0,
                // 8. DupeScore
                'FORCE',
                // 9. DupeMode
                [
                    // 10. Parameters array
                    {
                        Name: '*Unpack:Password',
                        Value: ''
                    }, {
                        Name: 'URL',
                        Value: options.url
                    } // URL must be in parameters
                ]];
            const result = await this.jsonRpc<number>('append', params);
            if (isError(result)) {
                return result;
            }
            if (!isSuccess(result)) {
                return createErrorResult(new Error('Failed to add NZB to NZBGet'));
            }
            // NZBGet returns the NZBID as a number
            return createSuccessResult({
                id: result.data.toString()
            });
        }, `addUrl`);
        return result as AsyncResult<{
            id: string;
        }, Error>;
    }
    /**
     * Gets the status of a download
     *
     * @param id - Download ID
     * @param options - Status options
     * @returns Promise that resolves to the download item
     */
    public async getStatus(id: string, options?: GetStatusOptions): Promise<AsyncResult<DownloadStatusInfo, Error>> {
        const result = await this._getStatus(id, options);
        if (isSuccess(result)) {
            // Convert DownloadItem to DownloadStatusInfo
            const item = result.data;
            const statusInfo: DownloadStatusInfo = {
                id: item["id"],
                name: item["name"],
                status: item["status"],
                progress: item.progress,
                downloadSpeed: item.downloadSpeed,
                ...(item.uploadSpeed !== undefined && { uploadSpeed: item.uploadSpeed }),
                ...(item.eta !== undefined && { eta: item.eta }),
                totalSize: item.totalSize,
                downloadedSize: item.downloadedSize,
                ...(item.error !== undefined && { error: item.error }),
                ...(item.seedRatio !== undefined && { seedRatio: item.seedRatio }),
                ...(item.peers !== undefined && { peers: item.peers }),
                ...(item.seeds !== undefined && { seeds: item.seeds })
            };
            return createSuccessResult(statusInfo);
        }
        return result as AsyncResult<DownloadStatusInfo, Error>;
    }
    /**
     * Private implementation of getStatus
     *
     * @param id - Download ID
     * @param _options - Status options
     * @returns Promise that resolves to AsyncResult with download item
     */
    private async _getStatus(id: string, _options?: GetStatusOptions): Promise<AsyncResult<DownloadItem, Error>> {
        const result = await withEnhancedErrorHandling(async () => {
            // Check active downloads first
            const groupsResult = await this.jsonRpc<NzbgetGroup[]>('listgroups', [0]);
            if (isError(groupsResult)) {
                return groupsResult;
            }
            if (isSuccess(groupsResult)) {
                const group = groupsResult.data.find(g => g.NZBID === toNumberId(id));
                if (group) {
                    return createSuccessResult(this.convertGroupToDownloadItem(group));
                }
            }
            // Check history
            const historyResult = await this.jsonRpc<NzbgetHistoryItem[]>('history', [0]);
            if (isError(historyResult)) {
                return historyResult;
            }
            if (isSuccess(historyResult)) {
                const historyItem = historyResult.data.find(h => h.NZBID === toNumberId(id));
                if (historyItem) {
                    return createSuccessResult(this.convertHistoryItemToDownloadItem(historyItem));
                }
            }
            return createErrorResult(new Error(`Download with ID ${id} not found`));
        }, `getStatus: ${id}`);
        return result as AsyncResult<DownloadItem, Error>;
    }
    /**
     * Gets all downloads
     *
     * @param options - Status options
     * @returns Promise that resolves to a list of download items
     */
    public async getAllItems(options?: GetStatusOptions): Promise<AsyncResult<DownloadItem[], Error>> {
        return this._getAllItems(options);
    }
    /**
     * Private implementation of getAllItems
     *
     * @param _options - Status options
     * @returns Promise that resolves to AsyncResult with list of download items
     */
    private async _getAllItems(_options?: GetStatusOptions): Promise<AsyncResult<DownloadItem[], Error>> {
        const result = await withEnhancedErrorHandling(async () => {
            const [groupsResult, historyResult] = await Promise.all([this.jsonRpc<NzbgetGroup[]>('listgroups', [0]), this.jsonRpc<NzbgetHistoryItem[]>('history', [0])]);
            const items: DownloadItem[] = [];
            // Add active downloads
            if (isSuccess(groupsResult)) {
                items.push(...groupsResult.data.map(g => this.convertGroupToDownloadItem(g)));
            }
            // Add history items
            if (isSuccess(historyResult)) {
                items.push(...historyResult.data.map(h => this.convertHistoryItemToDownloadItem(h)));
            }
            return createSuccessResult(items);
        }, `getAllItems`);
        return result as AsyncResult<DownloadItem[], Error>;
    }
    /**
     * Pauses a download
     *
     * @param id - Download ID
     * @returns Promise that resolves to true if successful
     */
    public async pauseItem(id: string): Promise<AsyncResult<boolean, Error>> {
        const result = await this.jsonRpc<boolean>('editqueue', ['GroupPause', 0, '', [toNumberId(id)]]);
        if (isSuccess(result)) {
            return createSuccessResult(true);
        }
        if (isError(result)) {
            return result as AsyncResult<boolean, Error>;
        }
        return createErrorResult(new Error(`Failed to pause download ${id}`));
    }
    /**
     * Resumes a download
     *
     * @param id - Download ID
     * @returns Promise that resolves to true if successful
     */
    public async resumeItem(id: string): Promise<AsyncResult<boolean, Error>> {
        const result = await this.jsonRpc<boolean>('editqueue', ['GroupResume', 0, '', [toNumberId(id)]]);
        if (isSuccess(result)) {
            return createSuccessResult(true);
        }
        if (isError(result)) {
            return result as AsyncResult<boolean, Error>;
        }
        return createErrorResult(new Error(`Failed to resume download ${id}`));
    }
    /**
     * Removes a download
     *
     * @param id - Download ID
     * @param deleteFiles - Whether to delete downloaded files
     * @returns Promise that resolves to true if successful
     */
    public async removeItem(id: string, deleteFiles: boolean = false): Promise<AsyncResult<boolean, Error>> {
        const command = deleteFiles ? 'GroupDelete' : 'GroupFinalDelete';
        const result = await this.jsonRpc<boolean>('editqueue', [command, 0, '', [toNumberId(id)]]);
        if (isSuccess(result)) {
            return createSuccessResult(true);
        }
        if (isError(result)) {
            return result as AsyncResult<boolean, Error>;
        }
        return createErrorResult(new Error(`Failed to remove download ${id}`));
    }
    /**
     * Gets the client type
     *
     * @returns Client type
     */
    public getClientType(): string {
        return 'nzbget';
    }
    /**
     * Pauses all downloads
     *
     * @returns Promise that resolves to true if successful
     */
    public async pauseAll(): Promise<boolean> {
        const result = await this.jsonRpc<boolean>('pausedownload', []);
        if (isSuccess(result)) {
            return true;
        }
        if (isError(result)) {
            throw result.error;
        }
        throw new ValidationError('Failed to pause all downloads');
    }
    /**
     * Resumes all downloads
     *
     * @returns Promise that resolves to true if successful
     */
    public async resumeAll(): Promise<boolean> {
        const result = await this.jsonRpc<boolean>('resumedownload', []);
        if (isSuccess(result)) {
            return true;
        }
        if (isError(result)) {
            throw result.error;
        }
        throw new ValidationError('Failed to resume all downloads');
    }
    /**
     * Converts a NZBGet group to a standardized DownloadItem
     *
     * @param group - NZBGet group
     * @returns Standardized download item
     */
    private convertGroupToDownloadItem(group: NzbgetGroup): DownloadItem {
        const totalSize = group.FileSizeMB * 1024 * 1024;
        const remainingSize = group.RemainingSizeMB * 1024 * 1024;
        const downloadedSize = totalSize - remainingSize;
        const progress = totalSize > 0 ? Math.round(downloadedSize / totalSize * 100) : 0;
        const eta = group.RemainingSizeLo > 0 && group.DownloadRate > 0 ? Math.round(group.RemainingSizeLo / group.DownloadRate) : undefined;
        const groupError = group.Health < 1000 ? 'Health issues detected' : undefined;
        return {
            id: group.NZBID.toString(),
            name: group.NZBName,
            status: this.mapStatus(group.Status),
            progress,
            downloadSpeed: group.DownloadRate,
            uploadSpeed: 0,
            ...(eta !== undefined ? { eta } : {}),
            totalSize,
            downloadedSize,
            size: totalSize,
            downloaded: downloadedSize,
            uploaded: 0,
            ratio: 0,
            dateAdded: new Date(group.AddTime * 1000),
            savePath: group.DestDir,
            files: [],
            // NZBGet doesn't provide file list in group
            ...(groupError !== undefined ? { error: groupError } : {}),
            clientSpecific: {
                status: group.Status,
                category: group.Category,
                priority: group.Priority,
                parStatus: group.ParStatus,
                unpackStatus: group.UnpackStatus,
                health: group.Health
            }
        };
    }
    /**
     * Converts a NZBGet history item to a standardized DownloadItem
     *
     * @param historyItem - NZBGet history item
     * @returns Standardized download item
     */
    private convertHistoryItemToDownloadItem(historyItem: NzbgetHistoryItem): DownloadItem {
        const totalSize = historyItem.FileSizeMB * 1024 * 1024;
        const downloadedSize = historyItem.DownloadedSizeMB * 1024 * 1024;
        // iter-17: NZBGet reports Status='SUCCESS' even when par2 repair or unrar
        // unpack failed — previously we silently flipped to COMPLETED and kicked
        // off an import of a broken archive. Treat any post-processing failure
        // as an ERROR regardless of the top-level Status field.
        const ppFailed = historyItem.ParStatus === 'FAILURE' || historyItem.UnpackStatus === 'FAILURE';
        const baseSucceeded = historyItem.Status === 'SUCCESS';
        const status = baseSucceeded && !ppFailed ? DownloadStatus.COMPLETED : DownloadStatus.ERROR;
        let error: string | undefined;
        if (!baseSucceeded) {
            error = historyItem.Status;
        } else if (ppFailed) {
            if (historyItem.ParStatus === 'FAILURE' && historyItem.UnpackStatus === 'FAILURE') {
                error = 'par2 repair failed; unpack failed';
            } else if (historyItem.ParStatus === 'FAILURE') {
                error = 'par2 repair failed';
            } else {
                error = 'unpack failed';
            }
        }
        return {
            id: historyItem.NZBID.toString(),
            name: historyItem.Name,
            status,
            progress: 100,
            downloadSpeed: 0,
            uploadSpeed: 0,
            totalSize,
            downloadedSize,
            size: totalSize,
            downloaded: downloadedSize,
            uploaded: 0,
            ratio: 0,
            dateAdded: new Date(historyItem.HistoryTime * 1000),
            dateCompleted: new Date(historyItem.HistoryTime * 1000),
            savePath: historyItem.DestDir,
            files: [],
            // NZBGet doesn't provide file list in history
            ...(error !== undefined ? { error } : {}),
            clientSpecific: {
                status: historyItem.Status,
                category: historyItem.Category,
                parStatus: historyItem.ParStatus,
                unpackStatus: historyItem.UnpackStatus
            }
        };
    }
    /**
     * Maps NZBGet status to standardized DownloadStatus
     *
     * @param nzbgetStatus - NZBGet status
     * @returns Standardized download status
     */
    protected mapStatus(nzbgetStatus: string): DownloadStatus {
        switch (nzbgetStatus.toUpperCase()) {
            case 'DOWNLOADING':
                return DownloadStatus.DOWNLOADING;
            case 'PAUSED':
                return DownloadStatus.PAUSED;
            case 'QUEUED':
                return DownloadStatus.QUEUED;
            case 'PP_SUCCESS':
            case 'SUCCESS':
                return DownloadStatus.COMPLETED;
            case 'PP_FAILURE':
            case 'FAILURE':
                return DownloadStatus.ERROR;
            case 'PP_REPAIR':
                return DownloadStatus.DOWNLOADING;
            default:
                return DownloadStatus.UNKNOWN;
        }
    }
    /**
     * Pings the API to check if it's available
     *
     * @returns Promise that resolves when the ping is successful
     */
    protected async ping(): Promise<void> {
        const result = await this.jsonRpc<NzbgetStatus>('status', []);
        if (isSuccess(result)) {
            // Connection successful
            delete this.connectionError;
            return;
        }
        if (isError(result)) {
            // Connection failed
            this.connectionError = result.error;
            throw result.error;
        }
        throw new ValidationError('Failed to ping NZBGet');
    }
    /**
     * Test connection to NZBGet server
     *
     * @returns Connection status
     */
    public async testConnection(): Promise<AsyncResult<ConnectionStatus, Error>> {
        try {
            const versionResult = await this.jsonRpc<string>('version');
            if (isSuccess(versionResult)) {
                return createSuccessResult({
                    connected: true,
                    version: versionResult.data,
                    capabilities: ['usenet', 'queue', 'categories']
                });
            }
            return createErrorResult(new Error('Failed to connect to NZBGet'));
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Connection test failed'));
        }
    }
    /**
     * Dispose of resources
     */
    public dispose(): void {
        // Clean up any resources if needed
        delete this.connectionError;
    }
}
/**
 * Creates a NZBGet client
 *
 * @param config - Client configuration
 * @returns NZBGet client instance
 */
export function createNzbgetClient(config: ApiClientConfig): NzbgetClient {
    return new NzbgetClient(config);
}
