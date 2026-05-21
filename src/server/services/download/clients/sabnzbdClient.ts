/**
 * SABnzbd API Client
 *
 * A unified client for interacting with the SABnzbd Usenet client's API.
 * This implementation follows the consolidation architecture and provides a consistent
 * interface with robust error handling and resource management.
 *
 * Features:
 * - Complete SABnzbd API communication
 * - Standardized error handling and status mapping
 * - Complete download management functionality
 * - Support for both direct and proxied communication
 * - Proper resource cleanup
 */

import { DownloadStatus } from '@prisma/client';

import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';


import { BaseDownloadClient } from '../base';

import type { DownloadItem, AddDownloadOptions, GetStatusOptions, ApiClientConfig, ConnectionStatus, DownloadStatusInfo } from '../base';
// Define types for SABnzbd API responses
interface SabnzbdQueueResponse {
    queue: {
        status: string;
        paused: boolean;
        speed: string; // Speed in KB/s (like "90.12 KB/s")
        kbpersec: string; // Speed in KB/s as a string number
        mbleft: string; // MB left to download
        mb: string; // Total MB
        diskspace1: string; // Disk space in GB (like "200.50 GB")
        diskspace2: string; // Disk space in GB (like "200.50 GB")
        timeleft: string; // Time left (like "1:23:45")
        slots: SabnzbdQueueItem[];
        noofslots: number;
        finish: number; // Estimated time of completion (UNIX timestamp)
        have_warnings: number; // Number of warnings
        pause_int: string; // Pause interval
        categories: string[]; // Available categories
        scripts: string[]; // Available scripts
        start: number; // Start time (UNIX timestamp)
    };
}
interface SabnzbdHistoryResponse {
    history: {
        total_size: string; // Total size of history in bytes
        month_size: string; // Size of history for this month in bytes
        week_size: string; // Size of history for this week in bytes
        day_size: string; // Size of history for today in bytes
        slots: SabnzbdHistoryItem[];
        noofslots: number;
    };
}
interface SabnzbdQueueItem {
    nzo_id: string;
    filename: string;
    status: string;
    cat: string; // Category
    priority: string;
    percentage: string;
    percentcomplete: string; // Same as percentage but without '%'
    mb: string; // Size in MB
    mbmissing: string; // Size missing in MB
    kbpersec: string; // Speed in KB/s
    mbleft: string; // Size left in MB
    timeleft: string; // Time left
    eta: string; // ETA time
    avg_age: string; // Average age of articles
    script: string; // Post-processing script
    client_agent: string; // Client agent that added the NZB
    has_rating: boolean; // Has rating
    rating_avg: string; // Average rating
    storage: string; // Storage location
    active_files: string[]; // Active files being processed
}
interface SabnzbdHistoryItem {
    nzo_id: string;
    name: string;
    category: string;
    status: string;
    size: string; // Size in bytes
    bytes: number; // Size in bytes
    completed: number; // Completion timestamp
    download_time: number; // Download time in seconds
    storage: string; // Storage location
    path: string; // Path to files
    script: string; // Post-processing script
    stage_log: {
        name: string;
        actions: string[];
    }[];
    downloaded: number; // Downloaded bytes
    completeness: number; // Completeness percentage
    fail_message: string; // Failure message
    url: string; // Original URL
    url_info: string; // URL info
}
interface SabnzbdStatusResponse {
    status: boolean;
    nzo_ids?: string[];
    error?: string;
}
interface SabnzbdVersionResponse {
    version: string;
    status: boolean;
}
interface SabnzbdQueueStatsResponse {
    speed: string; // Current speed in B/s
    size: string; // Total queue size in bytes
    limit: string; // Speed limit
    limit_int: string; // Speed limit as integer
    speedlimit: string; // Speed limit
    speedlimit_int: string; // Speed limit as integer
    status: boolean;
}
/**
 * SABnzbd client configuration
 */
// SabnzbdConfig is just ApiClientConfig - use ApiClientConfig directly
// apiKey and other fields are already in ApiClientConfig
/**
 * Unified SABnzbd API client
 */
export class SabnzbdClient extends BaseDownloadClient {
    public name = 'sabnzbd';
    public type: 'torrent' | 'usenet' = 'usenet';
    private apiKey: string;
    private proxyMode: boolean;
    private proxyPath: string = '/api/proxy/sabnzbd';
    private category?: string;
    /**
     * Creates a new SABnzbd client
     *
     * @param config - Client configuration
     */
    constructor(config: ApiClientConfig) {
        // Ensure baseURL does not end with /api
        let baseURL = config.baseURL ?? '';
        if (baseURL.endsWith('/api')) {
            baseURL = baseURL.substring(0, baseURL.length - 4);
        }
        if (baseURL.endsWith('/')) {
            baseURL = baseURL.substring(0, baseURL.length - 1);
        }
        // Create base API client - pass only ApiClientConfig properties
        super(config);
        // Store properties
        this.apiKey = config.apiKey ?? '';
        this.proxyMode = false;
        if (config.category !== undefined) {
            this.category = config.category;
        }
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
        const params: Record<string, unknown> = {
            name: options.url,
            mode: 'addurl'
        };
        // Add optional parameters
        if (options.category) {
            params["cat"] = options.category;
        }
        else if (this.category) {
            params["cat"] = this.category;
        }
        if (options.paused) {
            params["priority"] = '1'; // Set to paused
        }
        if (options.clientSpecific) {
            // Handle client-specific options
            const clientSpecific = options.clientSpecific;
            const scriptValue = clientSpecific["script"];
            if (scriptValue !== undefined && scriptValue !== null) {
                params["script"] = scriptValue;
            }
            const priorityValue = clientSpecific["priority"];
            if (priorityValue !== undefined && priorityValue !== null) {
                params["priority"] = priorityValue.toString();
            }
            const ppValue = clientSpecific["pp"];
            if (ppValue !== undefined && ppValue !== null) {
                params["pp"] = ppValue.toString();
            }
        }
        // Make API request
        const result = await this.apiRequest<SabnzbdStatusResponse>('addurl', params);
        if (!result["status"]) {
            throw new ValidationError(result.error ?? 'Failed to add NZB');
        }
        // If nzo_ids is not returned, we need to fetch the queue to find the ID
        if (!result.nzo_ids || result.nzo_ids.length === 0) {
            // Get the queue and find the most recently added item
            const queue = await this.apiRequest<SabnzbdQueueResponse>('queue');
            if (queue.queue.slots.length === 0) {
                throw new ValidationError('NZB added but no ID was returned');
            }
            // Sort by most recently added (assuming the first slot is the most recent)
            const addedNzb = queue.queue.slots[0];
            if (addedNzb === undefined) {
                throw new ValidationError('NZB added but no ID was returned');
            }
            return createSuccessResult({ id: addedNzb.nzo_id });
        }
        // Return the first NZO ID
        const firstId = result.nzo_ids[0];
        if (firstId === undefined) {
            throw new ValidationError('NZB added but no ID was returned');
        }
        return createSuccessResult({ id: firstId });
    }
    /**
     * Gets the status of a download
     *
     * @param id - Download ID
     * @param _options - Status options
     * @returns Promise that resolves to the download item
     */
    public async getStatus(id: string, _options?: GetStatusOptions): Promise<AsyncResult<DownloadStatusInfo, Error>> {
        // First check the queue
        const queue = await this.apiRequest<SabnzbdQueueResponse>('queue', { nzo_ids: id });
        // Find the item in the queue
        if (queue.queue.slots.length > 0) {
            const item = queue.queue.slots.find((slot) => slot.nzo_id === id);
            if (item) {
                return createSuccessResult(this.convertQueueItemToDownloadItem(item));
            }
        }
        // If not in queue, check history
        const history = await this.apiRequest<SabnzbdHistoryResponse>('history', { nzo_ids: id });
        // Find the item in history
        if (history.history.slots.length > 0) {
            const item = history.history.slots.find((slot) => slot.nzo_id === id);
            if (item) {
                return createSuccessResult(this.convertHistoryItemToDownloadItem(item));
            }
        }
        // Item not found
        return createErrorResult(new Error(`Download with ID ${id} not found`));
    }
    /**
     * Gets all downloads
     *
     * @param options - Status options
     * @returns Promise that resolves to a list of download items
     */
    public async getAllItems(): Promise<AsyncResult<DownloadItem[], Error>> {
        // Get both queue and history
        const [queue, history] = await Promise.all([
            this.apiRequest<SabnzbdQueueResponse>('queue'),
            this.apiRequest<SabnzbdHistoryResponse>('history', { limit: 50 })
        ]);
        // Convert queue items
        const queueItems = queue.queue.slots.map((item) => this.convertQueueItemToDownloadItem(item));
        // Convert history items
        const historyItems = history.history.slots.map((item) => this.convertHistoryItemToDownloadItem(item));
        // Combine and return
        return createSuccessResult([...queueItems, ...historyItems]);
    }
    /**
     * Pauses a download
     *
     * @param id - Download ID
     * @returns Promise that resolves to true if successful
     */
    public async pauseItem(id: string): Promise<AsyncResult<boolean, Error>> {
        const _result = await this.apiRequest<SabnzbdStatusResponse>('queue', {
            name: 'pause',
            value: id,
            mode: 'queue'
        });
        return createSuccessResult(true);
    }
    /**
     * Resumes a download
     *
     * @param id - Download ID
     * @returns Promise that resolves to true if successful
     */
    public async resumeItem(id: string): Promise<AsyncResult<boolean, Error>> {
        const _result = await this.apiRequest<SabnzbdStatusResponse>('queue', {
            name: 'resume',
            value: id,
            mode: 'queue'
        });
        return createSuccessResult(true);
    }
    /**
     * Removes a download
     *
     * @param id - Download ID
     * @param deleteFiles - Whether to delete downloaded files
     * @returns Promise that resolves to true if successful
     */
    public async removeItem(id: string, deleteFiles: boolean = false): Promise<AsyncResult<boolean, Error>> {
        // Check if the item is in the queue or history
        let inQueue = false;
        try {
            const queue = await this.apiRequest<SabnzbdQueueResponse>('queue', { nzo_ids: id });
            inQueue = queue.queue.slots.some((slot) => slot.nzo_id === id);
        }
        catch (_error: unknown) {
  // Ignore errors and assume it's not in the queue
            inQueue = false;
        }
        if (inQueue) {
            // Remove from queue
            const _result = await this.apiRequest<SabnzbdStatusResponse>('queue', {
                name: 'delete',
                value: id,
                mode: 'queue',
                del_files: deleteFiles ? 1 : 0
            });
            return createSuccessResult(true);
        }
        else {
            // Remove from history
            const _result = await this.apiRequest<SabnzbdStatusResponse>('history', {
                name: 'delete',
                value: id,
                mode: 'history',
                del_files: deleteFiles ? 1 : 0
            });
            return createSuccessResult(true);
        }
    }
    /**
     * Gets the client type
     *
     * @returns Client type
     */
    public getClientType(): string {
        return 'sabnzbd';
    }
    /**
     * Gets the version of SABnzbd
     *
     * @returns Promise that resolves to the version
     */
    public async getVersion(): Promise<string> {
        const result = await this.apiRequest<SabnzbdVersionResponse>('version');
        return result.version;
    }
    /**
     * Pauses the entire queue
     *
     * @returns Promise that resolves to true if successful
     */
    public async pauseQueue(): Promise<boolean> {
        const _result = await this.apiRequest<SabnzbdStatusResponse>('pause');
        return true;
    }
    /**
     * Resumes the entire queue
     *
     * @returns Promise that resolves to true if successful
     */
    public async resumeQueue(): Promise<boolean> {
        const _result = await this.apiRequest<SabnzbdStatusResponse>('resume');
        return true;
    }
    /**
     * Sets the speed limit
     *
     * @param limit - Speed limit in KB/s (0 for unlimited)
     * @returns Promise that resolves to true if successful
     */
    public async setSpeedLimit(limit: number): Promise<boolean> {
        const _result = await this.apiRequest<SabnzbdStatusResponse>('config', {
            name: 'speedlimit',
            value: limit.toString(),
            mode: 'set'
        });
        return true;
    }
    /**
     * Gets the queue stats
     *
     * @returns Promise that resolves to queue stats
     */
    public async getQueueStats(): Promise<{
        speed: number;
        size: number;
        limit: number;
    }> {
        const result = await this.apiRequest<SabnzbdQueueStatsResponse>('qstatus');
        return {
            speed: parseFloat(result.speed) || 0,
            size: parseFloat(result.size) || 0,
            limit: parseFloat(result.speedlimit) || 0
        };
    }
    /**
     * Makes an API request to SABnzbd
     *
     * @param mode - API mode
     * @param params - Additional parameters
     * @returns Promise that resolves to the response data
     */
    private async apiRequest<T>(mode: string, params: Record<string, unknown> = {}): Promise<T> {
        if (this.proxyMode) {
            // Use proxy endpoint
            return this.proxyRequest<T>(mode, params);
        }
        else {
            // Use direct API
            return this.directRequest<T>(mode, params);
        }
    }
    /**
     * Makes a direct API request to SABnzbd
     *
     * @param mode - API mode
     * @param params - Additional parameters
     * @returns Promise that resolves to the response data
     */
    private async directRequest<T>(mode: string, params: Record<string, unknown> = {}): Promise<T> {
        // Prepare query parameters
        const queryParams: Record<string, string> = {
            apikey: this.apiKey,
            output: 'json',
            ...params
        };
        // Set mode if not already set in params
        if (!params["mode"]) {
            queryParams["mode"] = mode;
        }
        try {
            // Make GET request to API
            const url = this.buildUrl('/api');
            const response = await fetch(`${url}?${new URLSearchParams(queryParams).toString()}`, {
                headers: this.buildAuthHeaders()
            });
            if (!response.ok) {
                throw new ValidationError(`HTTP error! status: ${response["status"]}`);
            }
            const result = (await response.json()) as T;
            return result;
        }
        catch (error: unknown) {
            // Transform error
            throw new Error(`SABnzbd API error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Makes a proxied API request to SABnzbd
     *
     * @param mode - API mode
     * @param params - Additional parameters
     * @returns Promise that resolves to the response data
     */
    private async proxyRequest<T>(mode: string, params: Record<string, unknown> = {}): Promise<T> {
        try {
            // Make POST request to proxy
            const url = this.buildUrl(this.proxyPath);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...this.buildAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mode,
                    params: {
                        ...params,
                        apikey: this.apiKey,
                        output: 'json'
                    }
                })
            });
            if (!response.ok) {
                throw new ValidationError(`HTTP error! status: ${response["status"]}`);
            }
            const result = (await response.json()) as T;
            return result;
        }
        catch (error: unknown) {
            // Transform error
            throw new Error(`SABnzbd API proxy error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Converts a SABnzbd queue item to a standardized DownloadItem
     *
     * @param item - SABnzbd queue item
     * @returns Standardized download item
     */
    private convertQueueItemToDownloadItem(item: SabnzbdQueueItem): DownloadItem {
        // Parse values
        const percentageValue = parseFloat(item.percentage) || 0;
        const mbValue = parseFloat(item.mb) || 0;
        const speedValue = parseFloat(item.kbpersec) || 0;
        const progress = percentageValue;
        const totalSize = mbValue * 1024 * 1024; // MB to bytes
        const downloadSpeed = speedValue * 1024; // KB/s to bytes/s
        const downloaded = totalSize * (progress / 100);
        const eta = this.parseTimeLeft(item.timeleft);
        // Map status
        const status = this.mapStatus(item["status"]);
        // Create download item
        const downloadItem: DownloadItem = {
            id: item.nzo_id,
            name: item.filename,
            status,
            progress,
            downloadSpeed,
            uploadSpeed: 0, // SABnzbd doesn't have upload speed
            totalSize,
            downloadedSize: downloaded,
            size: totalSize,
            downloaded,
            uploaded: 0, // SABnzbd doesn't have upload tracking
            ratio: 0, // SABnzbd doesn't have ratio tracking
            dateAdded: new Date(), // SABnzbd doesn't provide date added in queue items
            savePath: item.storage,
            files: [], // SABnzbd doesn't provide file list in queue items
            clientSpecific: {
                category: item.cat,
                priority: item.priority,
                script: item.script,
                storage: item.storage,
                activeFiles: item.active_files
            }
        };

        // Add optional fields only if they have values
        if (eta !== undefined) {
            downloadItem.eta = eta;
        }

        if (status === DownloadStatus.ERROR) {
            downloadItem.error = 'Download failed';
        }

        return downloadItem;
    }
    /**
     * Converts a SABnzbd history item to a standardized DownloadItem
     *
     * @param item - SABnzbd history item
     * @returns Standardized download item
     */
    private convertHistoryItemToDownloadItem(item: SabnzbdHistoryItem): DownloadItem {
        // Parse values - use item.bytes directly as totalSize
        const totalSize = item.bytes;
        const completed = item.completed ? new Date(item.completed * 1000) : undefined;
        // Map status
        const status = this.mapHistoryStatus(item["status"]);
        // Create download item
        const downloadItem: DownloadItem = {
            id: item.nzo_id,
            name: item["name"],
            status,
            progress: status === DownloadStatus.COMPLETED ? 100 : 0,
            downloadSpeed: 0, // History items don't have speed
            uploadSpeed: 0,
            totalSize,
            downloadedSize: totalSize,
            size: totalSize,
            downloaded: status === DownloadStatus.COMPLETED ? totalSize : 0,
            uploaded: 0,
            ratio: 0,
            dateAdded: completed ?? new Date(),
            savePath: item.storage || item.path || '',
            files: [], // SABnzbd doesn't provide file list in history items
            clientSpecific: {
                category: item.category,
                script: item.script,
                storage: item.storage,
                path: item.path,
                url: item.url,
                stageLogs: item.stage_log,
                downloadTime: item.download_time
            }
        };

        // Add optional fields only if they have values
        if (status === DownloadStatus.COMPLETED && completed !== undefined) {
            downloadItem.dateCompleted = completed;
        }

        if (item.fail_message) {
            downloadItem.error = item.fail_message;
        } else if (status === DownloadStatus.ERROR) {
            downloadItem.error = 'Download failed';
        }

        return downloadItem;
    }
    /**
     * Maps SABnzbd queue status to standardized DownloadStatus
     *
     * @param sabnzbdStatus - SABnzbd status
     * @returns Standardized download status
     */
    protected mapStatus(sabnzbdStatus: string): DownloadStatus {
        const statusMap: Record<string, DownloadStatus> = {
            'Downloading': DownloadStatus.DOWNLOADING,
            'Paused': DownloadStatus.PAUSED,
            'Extracting': DownloadStatus.DOWNLOADING,
            'Repairing': DownloadStatus.DOWNLOADING,
            'Verifying': DownloadStatus.DOWNLOADING,
            'QuickCheck': DownloadStatus.DOWNLOADING,
            'Queued': DownloadStatus.QUEUED,
            'Fetching': DownloadStatus.DOWNLOADING,
            'Failed': DownloadStatus.ERROR
        };
        const mappedStatus = statusMap[sabnzbdStatus];
        return mappedStatus ?? DownloadStatus.UNKNOWN;
    }
    /**
     * Maps SABnzbd history status to standardized DownloadStatus
     *
     * @param historyStatus - SABnzbd history status
     * @returns Standardized download status
     */
    private mapHistoryStatus(historyStatus: string): DownloadStatus {
        if (historyStatus === 'Completed') {
            return DownloadStatus.COMPLETED;
        }
        else if (historyStatus === 'Failed') {
            return DownloadStatus.ERROR;
        }
        else {
            return DownloadStatus.UNKNOWN;
        }
    }
    /**
     * Parses a time left string into seconds
     *
     * @param timeLeft - Time left string (e.g., "1:23:45" or "23:45")
     * @returns Seconds
     */
    private parseTimeLeft(timeLeft: string): number | undefined {
        if (!timeLeft || timeLeft === '0:00:00' || timeLeft === '0:00') {
            return undefined;
        }
        const parts = timeLeft.split(':');
        if (parts.length === 3) {
            // Hours:Minutes:Seconds
            const part0 = parts[0];
            const part1 = parts[1];
            const part2 = parts[2];
            if (part0 !== undefined && part1 !== undefined && part2 !== undefined) {
                const hours = parseInt(part0, 10) || 0;
                const minutes = parseInt(part1, 10) || 0;
                const seconds = parseInt(part2, 10) || 0;
                return hours * 3600 + minutes * 60 + seconds;
            }
        }
        else if (parts.length === 2) {
            // Minutes:Seconds
            const part0 = parts[0];
            const part1 = parts[1];
            if (part0 !== undefined && part1 !== undefined) {
                const minutes = parseInt(part0, 10) || 0;
                const seconds = parseInt(part1, 10) || 0;
                return minutes * 60 + seconds;
            }
        }
        return undefined;
    }
    /**
     * Pings the API to check if it's available
     *
     * @returns Promise that resolves when the ping is successful
     */
    protected async ping(): Promise<void> {
        try {
            const version = await this.getVersion();
            this.updateConnectionStatus(true, version);
        }
        catch (error: unknown) {
            this.updateConnectionStatus(false, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }
    /**
     * Test connection to SABnzbd server
     *
     * @returns Connection status
     */
    public async testConnection(): Promise<AsyncResult<ConnectionStatus, Error>> {
        try {
            await this.apiRequest<SabnzbdQueueResponse>('version');
            return createSuccessResult({
                connected: true,
                version: 'SABnzbd',
                capabilities: ['usenet', 'queue', 'categories']
            });
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
    }
}
/**
 * Creates a SABnzbd client
 *
 * @param config - Client configuration
 * @returns SABnzbd client instance
 */
export function createSabnzbdClient(config: ApiClientConfig): SabnzbdClient {
    return new SabnzbdClient(config);
}
