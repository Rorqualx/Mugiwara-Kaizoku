/**
 * Types for download retry logic
 *
 * @module server/services/download/retry/types
 */

/**
 * Configuration for download retry behavior
 */
export interface DownloadRetryConfig {
  /** Whether automatic retry is enabled */
  enabled: boolean;
  /** Maximum number of retry attempts before giving up */
  maxAttempts: number;
  /** Minutes without progress before considering a download stalled */
  stallTimeoutMinutes: number;
  /** Minimum seeders required, below this triggers retry for torrents */
  minSeeders: number;
  /** Whether to automatically add failed releases to blocklist */
  autoBlockFailed: boolean;
  /** Days until blocked releases can be tried again */
  blockExpiryDays: number;
  /** Delay in seconds between retry attempts */
  delayBetweenRetriesSeconds: number;
}

/**
 * Default configuration values for download retry
 */
export const DEFAULT_RETRY_CONFIG: DownloadRetryConfig = {
  enabled: true,
  maxAttempts: 3,
  stallTimeoutMinutes: 30,
  minSeeders: 1,
  autoBlockFailed: true,
  blockExpiryDays: 30,
  delayBetweenRetriesSeconds: 60,
};

/**
 * Reasons why a download may have failed
 */
export enum DownloadFailureReason {
  /** Download has stalled with no progress */
  STALLED = 'STALLED',
  /** Torrent has no seeders available */
  NO_SEEDS = 'NO_SEEDS',
  /** Download client reported an error */
  CLIENT_ERROR = 'CLIENT_ERROR',
  /** NZB download failed */
  NZB_FAILED = 'NZB_FAILED',
  /** Download timed out */
  TIMEOUT = 'TIMEOUT',
  /** Unknown failure reason */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Information about a failed download for retry processing
 */
export interface FailedDownloadInfo {
  /** Job ID from the jobs table */
  jobId: bigint;
  /** Download ID from the download client */
  downloadId: string;
  /** Type of download client (transmission, deluge, nzbget, sabnzbd) */
  clientType: string;
  /** Manga ID this download is for */
  mangaId: number;
  /** Chapter IDs included in this download */
  chapterIds: number[];
  /** Title of the release that failed */
  releaseTitle: string;
  /** URL/magnet of the failed release */
  releaseUrl: string;
  /** Reason for the failure */
  failureReason: DownloadFailureReason;
  /** Current attempt count */
  attemptCount: number;
  /** Chapter number(s) being downloaded */
  chapterNumbers?: string[];
}

/**
 * Result of a retry attempt
 */
export interface RetryAttemptResult {
  /** Whether the retry was successful */
  success: boolean;
  /** New download ID if retry succeeded */
  newDownloadId?: string;
  /** Title of the alternative release used */
  alternativeUsed?: string;
  /** Error message if retry failed */
  error?: string;
}

/**
 * Status information from a download client
 * Used for failure detection
 */
export interface DownloadClientStatus {
  /** Current status string */
  status: string;
  /** Whether the download is stalled (torrent-specific) */
  isStalled?: boolean;
  /** Error message from client */
  errorString?: string;
  /** Number of seeders (torrent-specific) */
  seeders?: number;
  /** Number of peers (torrent-specific) */
  peers?: number;
  /** Download progress (0-100) */
  progress?: number;
  /** Time since last progress update in seconds */
  secondsSinceLastProgress?: number;
  /** Whether download completed successfully */
  isComplete?: boolean;
  /** Download name */
  name?: string;
  /** Save path */
  savePath?: string;
}

/**
 * Keys used for retry configuration in the Config table
 */
export const RETRY_CONFIG_KEYS = {
  ENABLED: 'download.retry.enabled',
  MAX_ATTEMPTS: 'download.retry.maxAttempts',
  STALL_TIMEOUT_MINUTES: 'download.retry.stallTimeoutMinutes',
  MIN_SEEDERS: 'download.retry.minSeeders',
  AUTO_BLOCK_FAILED: 'download.retry.autoBlockFailed',
  BLOCK_EXPIRY_DAYS: 'download.retry.blockExpiryDays',
  DELAY_BETWEEN_RETRIES: 'download.retry.delayBetweenRetriesSeconds',
} as const;
