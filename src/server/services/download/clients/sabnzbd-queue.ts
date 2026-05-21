/**
 * SABnzbd Queue Management Module
 *
 * Handles queue management operations for SABnzbd client.
 *
 * Methods:
 * - pauseItem: Pause a download
 * - resumeItem: Resume a download
 * - removeItem: Remove a download
 *
 * Extracted from: sabnzbdClient.ts (lines 277-337)
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult } from '@/utils/async-result';

// Define types locally since sabnzbd-types.ts doesn't exist yet
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

interface SabnzbdStatusResponse {
    status: boolean;
    nzo_ids?: string[];
    error?: string;
}

// Queue management implementation
export class SabnzbdQueueOperations {
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

    // Note: The apiRequest method would need to be implemented or injected
    // This is a placeholder that would need to be connected to the actual API client
    private apiRequest<T>(_mode: string, _params: Record<string, unknown> = {}): Promise<T> {
        // This method would need to be implemented to make actual API calls
        // For now, it's a placeholder that matches the original signature
        throw new Error('apiRequest method not implemented - needs to be connected to SabnzbdClient');
    }
}