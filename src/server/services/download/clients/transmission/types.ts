/**
 * Transmission Client Type Definitions
 *
 * Type definitions, interfaces, and enums for the Transmission BitTorrent client.
 * This foundation module is imported by all other transmission modules.
 *
 * Extracted from: transmissionClient.ts (lines 27-204)
 */

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an object has the structure of a TransmissionResponse
 */
export function isTransmissionResponse<T>(obj: unknown): obj is TransmissionResponse<T> {
    return obj !== null && typeof obj === 'object' && 'result' in obj && typeof (obj as {
        result: unknown;
    }).result === 'string' && 'arguments' in obj;
}

// ============================================================================
// Core Torrent Types
// ============================================================================

/**
 * Represents a file within a torrent
 */
export interface TransmissionTorrentFile {
    name: string;
    length: number;
    bytesCompleted?: number;
}

/**
 * Statistics for a torrent file
 */
export interface TransmissionFileStat {
    bytesCompleted: number;
    wanted: boolean;
    priority: number;
}

/**
 * Represents a peer connected to a torrent
 */
export interface TransmissionPeer {
    address: string;
    clientName: string;
    rateToClient: number;
    rateToPeer: number;
    progress: number;
}

/**
 * Represents a tracker for a torrent
 */
export interface TransmissionTracker {
    announce: string;
    id: number;
    scrape: string;
    tier: number;
}

/**
 * Complete torrent information from Transmission
 */
export interface TransmissionTorrent {
    id: number;
    hashString: string;
    name: string;
    status: number;
    percentDone: number;
    rateDownload: number;
    rateUpload: number;
    eta: number;
    sizeWhenDone: number;
    totalSize: number;
    downloadedEver: number;
    uploadedEver: number;
    uploadRatio: number;
    errorString?: string;
    error?: number;
    addedDate: number;
    doneDate?: number;
    downloadDir: string;
    files?: TransmissionTorrentFile[];
    fileStats?: TransmissionFileStat[];
    peers?: TransmissionPeer[];
    trackers?: TransmissionTracker[];
    activityDate?: number;
    bandwidthPriority?: number;
    isFinished?: boolean;
    isStalled?: boolean;
    labels?: string[];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Transmission API response structure
 *
 * @template T - The type of data in the arguments field
 */
export interface TransmissionResponse<T> {
    /** Result status, "success" indicates successful operation */
    result: string;
    /** Response data payload */
    arguments: T;
    /** Optional request tag for correlation */
    tag?: number;
}

/**
 * Response when adding a torrent
 */
export interface TransmissionTorrentAddResponse {
    /** camelCase (Transmission 3.x) */
    torrentAdded?: { id: number; hashString: string; name: string };
    torrentDuplicate?: { id: number; hashString: string; name: string };
    /** kebab-case (Transmission 4.x) */
    'torrent-added'?: { id: number; hashString: string; name: string };
    'torrent-duplicate'?: { id: number; hashString: string; name: string };
}

/**
 * Response containing a list of torrents
 */
export interface TransmissionTorrentsResponse {
    torrents: TransmissionTorrent[];
}

/**
 * Session information response
 */
export interface TransmissionSessionResponse {
    version: string;
    rpcVersion: number;
    rpcVersionMinimum: number;
    downloadDir: string;
}

// ============================================================================
// Status Enum
// ============================================================================

/**
 * Transmission torrent status values
 * @see https://github.com/transmission/transmission/blob/main/libtransmission/transmission.h
 */
export enum TransmissionTorrentStatus {
    STOPPED = 0,
    // Torrent is stopped
    CHECK_WAIT = 1,
    // Queued to check files
    CHECK = 2,
    // Checking files
    DOWNLOAD_WAIT = 3,
    // Queued to download
    DOWNLOAD = 4,
    // Downloading
    SEED_WAIT = 5,
    // Queued to seed
    SEED = 6 // Seeding
}

// ============================================================================
// RPC Types
// ============================================================================

/**
 * RPC request parameters type
 */
export interface RpcRequestParams {
    [key: string]: unknown;
}

/**
 * Transmission-specific add torrent parameters
 */
export interface TransmissionAddParams extends RpcRequestParams {
    /** Torrent file URL or magnet link */
    filename?: string;
    /** Base64-encoded .torrent file content (preferred for HTTP URLs — same approach as Sonarr/Radarr) */
    metainfo?: string;
    /** Whether to add the torrent in paused state */
    paused: boolean;
    /** Download directory path */
    downloadDir?: string;
    /** Bandwidth priority (-1 = low, 0 = normal, 1 = high) */
    bandwidthPriority?: number;
    /** Array of labels to apply to the torrent */
    labels?: string[];
    /** Whether to download only specified files */
    filesWanted?: number[];
    /** Whether to set high priority for specific files */
    priorityHigh?: number[];
    /** Whether to set low priority for specific files */
    priorityLow?: number[];
    /** Maximum download speed in KB/s (0 = unlimited) */
    downloadLimit?: number;
    /** Whether to honor the download limit */
    downloadLimited?: boolean;
    /** Maximum upload speed in KB/s (0 = unlimited) */
    uploadLimit?: number;
    /** Whether to honor the upload limit */
    uploadLimited?: boolean;
}

/**
 * RPC request payload structure
 */
export interface RpcRequestPayload<T = RpcRequestParams> {
    /** RPC method name */
    method: string;
    /** RPC method parameters */
    arguments: T;
    /** Optional tag for request correlation */
    tag?: number;
}

/**
 * Proxy request configuration
 */
export interface ProxyRequestConfig extends Record<string, unknown> {
    /** Base URL for the Transmission API */
    baseURL: string;
    /** Optional username for authentication */
    username?: string;
    /** Optional password for authentication */
    password?: string;
}
