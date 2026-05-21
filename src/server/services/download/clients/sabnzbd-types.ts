/**
 * SABnzbd API Type Definitions
 *
 * Shared type definitions for SABnzbd API responses and data structures
 * used across all SABnzbd client modules.
 *
 * Extracted from: sabnzbdClient.ts (lines 25-118)
 */

// ============================================================================
// API Response Types
// ============================================================================

export interface SabnzbdQueueResponse {
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

export interface SabnzbdHistoryResponse {
    history: {
        total_size: string; // Total size of history in bytes
        month_size: string; // Size of history for this month in bytes
        week_size: string; // Size of history for this week in bytes
        day_size: string; // Size of history for today in bytes
        slots: SabnzbdHistoryItem[];
        noofslots: number;
    };
}

// ============================================================================
// Item Types
// ============================================================================

export interface SabnzbdQueueItem {
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

export interface SabnzbdHistoryItem {
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

// ============================================================================
// Status and Configuration Types
// ============================================================================

export interface SabnzbdStatusResponse {
    status: boolean;
    nzo_ids?: string[];
    error?: string;
}

export interface SabnzbdVersionResponse {
    version: string;
    status: boolean;
}

export interface SabnzbdQueueStatsResponse {
    speed: string; // Current speed in B/s
    size: string; // Total queue size in bytes
    limit: string; // Speed limit
    limit_int: string; // Speed limit as integer
    speedlimit: string; // Speed limit
    speedlimit_int: string; // Speed limit as integer
    status: boolean;
}