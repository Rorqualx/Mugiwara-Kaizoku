/**
 * SABnzbd Core Operations Module
 *
 * Handles core download operations for SABnzbd client.
 *
 * Methods:
 * - addUrl: Add download from URL
 * - getStatus: Get download status
 * - getAllItems: Get all downloads
 *
 * Extracted from: sabnzbdClient.ts (lines 164-270)
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';

import type { AddDownloadOptions, GetStatusOptions, DownloadStatusInfo, DownloadItem } from '../base';

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

// Core operations implementation
export class SabnzbdCoreOperations {
    private apiRequest: <T>(mode: string, params?: Record<string, unknown>) => Promise<T>;
    private convertQueueItemToDownloadItem: (item: SabnzbdQueueItem) => DownloadItem;
    private convertHistoryItemToDownloadItem: (item: SabnzbdHistoryItem) => DownloadItem;

    constructor(
        apiRequest: <T>(mode: string, params?: Record<string, unknown>) => Promise<T>,
        convertQueueItemToDownloadItem: (item: SabnzbdQueueItem) => DownloadItem,
        convertHistoryItemToDownloadItem: (item: SabnzbdHistoryItem) => DownloadItem
    ) {
        this.apiRequest = apiRequest;
        this.convertQueueItemToDownloadItem = convertQueueItemToDownloadItem;
        this.convertHistoryItemToDownloadItem = convertHistoryItemToDownloadItem;
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
        try {
            const params: Record<string, unknown> = {
                name: options.url,
                mode: 'addurl'
            };

            // Add optional parameters
            if (options['category']) {
                params['cat'] = options['category'];
            }

            if (options['paused']) {
                params['priority'] = '1'; // Set to paused
            }

            if (options['clientSpecific']) {
                // Handle client-specific options
                const clientSpecific = options['clientSpecific'];
                const scriptValue = clientSpecific['script'];
                if (scriptValue !== undefined && scriptValue !== null) {
                    params['script'] = scriptValue;
                }
                const priorityValue = clientSpecific['priority'];
                if (priorityValue !== undefined && priorityValue !== null) {
                    params['priority'] = priorityValue.toString();
                }
                const ppValue = clientSpecific['pp'];
                if (ppValue !== undefined && ppValue !== null) {
                    params['pp'] = ppValue.toString();
                }
            }

            // Make API request
            const result = await this.apiRequest<SabnzbdStatusResponse>('addurl', params);

            if (!result.status) {
                return createErrorResult(new ValidationError(result.error ?? 'Failed to add NZB'));
            }

            // If nzo_ids is not returned, we need to fetch the queue to find the ID
            if (!result.nzo_ids || result.nzo_ids.length === 0) {
                // Get the queue and find the most recently added item
                const queue = await this.apiRequest<SabnzbdQueueResponse>('queue');
                if (queue.queue.slots.length === 0) {
                    return createErrorResult(new ValidationError('NZB added but no ID was returned'));
                }

                // Sort by most recently added (assuming the first slot is the most recent)
                const addedNzb = queue.queue.slots[0];
                if (addedNzb === undefined) {
                    return createErrorResult(new ValidationError('NZB added but no ID was returned'));
                }

                return createSuccessResult({ id: addedNzb.nzo_id });
            }

            // Return the first NZO ID
            const firstId = result.nzo_ids[0];
            if (firstId === undefined) {
                return createErrorResult(new ValidationError('NZB added but no ID was returned'));
            }

            return createSuccessResult({ id: firstId });
        } catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to add URL'));
        }
    }

    /**
     * Gets the status of a download
     *
     * @param id - Download ID
     * @param _options - Status options
     * @returns Promise that resolves to the download item
     */
    public async getStatus(id: string, _options?: GetStatusOptions): Promise<AsyncResult<DownloadStatusInfo, Error>> {
        try {
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
        } catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to get download status'));
        }
    }

    /**
     * Gets all downloads
     *
     * @returns Promise that resolves to a list of download items
     */
    public async getAllItems(): Promise<AsyncResult<DownloadItem[], Error>> {
        try {
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
        } catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to get all download items'));
        }
    }
}