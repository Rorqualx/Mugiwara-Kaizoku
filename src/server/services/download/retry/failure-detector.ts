/**
 * Download Failure Detection Module
 *
 * Analyzes download status from various clients to detect failures
 * including stalled downloads, no seeders, and explicit errors.
 *
 * @module server/services/download/retry/failure-detector
 */

import { DownloadFailureReason } from './types';

import type { DownloadRetryConfig, DownloadClientStatus } from './types';

/**
 * Result of failure detection analysis
 */
export interface FailureDetectionResult {
  /** Whether a failure was detected */
  isFailure: boolean;
  /** The reason for the failure, if detected */
  reason?: DownloadFailureReason;
  /** Human-readable description of the failure */
  description?: string;
}

/**
 * Detects if a download has failed based on its current status
 *
 * @param status - Current download status from the client
 * @param config - Retry configuration with thresholds
 * @returns Detection result indicating failure state and reason
 */
export function detectFailure(
  status: DownloadClientStatus,
  config: DownloadRetryConfig
): FailureDetectionResult {
  // Check for explicit error state first (highest priority)
  const explicitError = isExplicitError(status);
  if (explicitError.isFailure) {
    return explicitError;
  }

  // Check for NZB-specific failures
  const nzbFailure = isNzbFailed(status);
  if (nzbFailure.isFailure) {
    return nzbFailure;
  }

  // Check for no seeders (torrent-specific)
  const noSeeders = hasNoSeeders(status, config.minSeeders);
  if (noSeeders.isFailure) {
    return noSeeders;
  }

  // Check for stalled downloads
  const stalled = isStalled(status, config.stallTimeoutMinutes);
  if (stalled.isFailure) {
    return stalled;
  }

  // No failure detected
  return { isFailure: false };
}

/**
 * Checks if a download is stalled (no progress for specified time)
 *
 * @param status - Current download status
 * @param stallTimeoutMinutes - Minutes without progress to consider stalled
 * @returns Detection result
 */
export function isStalled(
  status: DownloadClientStatus,
  stallTimeoutMinutes: number
): FailureDetectionResult {
  // Can't determine stall state if we don't have timing info
  if (status.secondsSinceLastProgress === undefined) {
    // iter-2: The client-reported isStalled flag alone is NOT a terminal signal.
    // Transmission reports isStalled=true during normal tracker handshake / peer
    // bootstrap, which can take several minutes on slow-starting torrents. The
    // previous logic failed downloads prematurely — observed: 8/20 torrents that
    // Transmission eventually completed were killed here before peers connected.
    // Require corroborating evidence of true deadness: isStalled=true + seeders
    // definitively 0. If seeders is unknown or > 0, defer failure to the
    // timing-based path below (or to secondsSinceLastProgress once the caller
    // tracks it).
    //
    // iter-3 (2026-05-16): also bail when the torrent is actually done. A
    // fast torrent that finishes between two progress polls comes through
    // this branch (no timing history yet) with isStalled=true (Transmission
    // sets that the moment download-rate hits zero) and seeders=0 (peers
    // disconnect after completion). The timing-based path and `hasNoSeeders`
    // already guard against this with the same `isComplete || progress >= 99`
    // check; mirror it here so the same release isn't killed + blocklisted
    // milliseconds after it lands on disk. Caught by the Steins;Gate trace
    // on 2026-05-16: pack #377 was complete on SMB but Mugiwara never ran
    // pack-import because this branch fired first.
    if (status.isComplete === true || (status.progress !== undefined && status.progress >= 99)) {
      return { isFailure: false };
    }
    if (status.isStalled === true && status.seeders === 0) {
      return {
        isFailure: true,
        reason: DownloadFailureReason.STALLED,
        description: 'Download marked as stalled by client (0 seeders, isStalled=true)',
      };
    }
    return { isFailure: false };
  }

  const stallTimeoutSeconds = stallTimeoutMinutes * 60;

  // Check if download has exceeded stall timeout
  if (status.secondsSinceLastProgress > stallTimeoutSeconds) {
    // Don't flag as stalled if download is complete or near complete
    if (status.isComplete === true || (status.progress !== undefined && status.progress >= 99)) {
      return { isFailure: false };
    }

    return {
      isFailure: true,
      reason: DownloadFailureReason.STALLED,
      description: `Download stalled - no progress for ${Math.round(status.secondsSinceLastProgress / 60)} minutes`,
    };
  }

  // Also check the explicit isStalled flag from the client. iter-3 (2026-05-16):
  // require seeders === 0 for the same reason the no-timing branch at line 87
  // does — Transmission flips isStalled=true the moment download-rate hits
  // zero, including normal mid-bootstrap quiet periods on a torrent with
  // live peers. Caught by the Steins;Gate run-4 trace: a 3-minute-old
  // torrent at 0% with 2 active peers got STALLED here and blocklisted.
  if (
    status.isStalled === true
    && status.progress !== undefined && status.progress < 99
    && status.seeders === 0
  ) {
    return {
      isFailure: true,
      reason: DownloadFailureReason.STALLED,
      description: 'Download marked as stalled by client (0 seeders, isStalled=true)',
    };
  }

  return { isFailure: false };
}

/**
 * Checks if a torrent has insufficient seeders
 *
 * @param status - Current download status
 * @param minSeeders - Minimum seeders required
 * @returns Detection result
 */
export function hasNoSeeders(
  status: DownloadClientStatus,
  minSeeders: number
): FailureDetectionResult {
  // Only applicable for torrents - skip if no seeder info
  if (status.seeders === undefined) {
    return { isFailure: false };
  }

  // Don't flag if download is complete or near complete
  if (status.isComplete === true || (status.progress !== undefined && status.progress >= 99)) {
    return { isFailure: false };
  }

  // Respect the caller's grace period: if isStalled is false (grace period
  // not yet passed), don't kill for no seeders — the torrent may still be
  // connecting to tracker/peers.
  if (status.isStalled === false) {
    return { isFailure: false };
  }

  // Check seeder count against minimum
  if (status.seeders < minSeeders) {
    // If progress is 0 and no seeders after grace period, definitely a problem
    if (status.progress !== undefined && status.progress < 1 && status.seeders === 0) {
      return {
        isFailure: true,
        reason: DownloadFailureReason.NO_SEEDS,
        description: 'Torrent has no seeders and cannot start downloading',
      };
    }

    // If some progress but now no seeders, might be temporary
    // Only flag if stalled as well
    if (status.seeders === 0 && status.isStalled === true) {
      return {
        isFailure: true,
        reason: DownloadFailureReason.NO_SEEDS,
        description: 'Torrent has no seeders and is stalled',
      };
    }

    // Below minimum but has some seeders - less critical
    if (minSeeders > 1 && status.seeders > 0 && status.seeders < minSeeders) {
      // Only flag if stalled
      if (status.isStalled === true) {
        return {
          isFailure: true,
          reason: DownloadFailureReason.NO_SEEDS,
          description: `Torrent has only ${status.seeders} seeder(s), minimum required is ${minSeeders}`,
        };
      }
    }
  }

  return { isFailure: false };
}

/**
 * Checks for explicit error states reported by the download client
 *
 * @param status - Current download status
 * @returns Detection result
 */
export function isExplicitError(status: DownloadClientStatus): FailureDetectionResult {
  // Check for error string from client
  if (status.errorString && status.errorString.trim().length > 0) {
    return {
      isFailure: true,
      reason: DownloadFailureReason.CLIENT_ERROR,
      description: `Client error: ${status.errorString}`,
    };
  }

  // Check for error status keywords
  const statusLower = status.status.toLowerCase();
  const errorKeywords = ['error', 'failed', 'failure', 'corrupt', 'invalid', 'rejected'];

  for (const keyword of errorKeywords) {
    if (statusLower.includes(keyword)) {
      return {
        isFailure: true,
        reason: DownloadFailureReason.CLIENT_ERROR,
        description: `Download status indicates error: ${status.status}`,
      };
    }
  }

  return { isFailure: false };
}

/**
 * Checks for NZB-specific failures
 *
 * @param status - Current download status
 * @returns Detection result
 */
export function isNzbFailed(status: DownloadClientStatus): FailureDetectionResult {
  const statusLower = status.status.toLowerCase();

  // NZBGet/SABnzbd specific failure states
  const nzbFailureKeywords = [
    'repair failed',
    'unpack failed',
    'pp-failure',
    'post-processing failed',
    'crc error',
    'rar error',
    'missing articles',
    'par2 failed',
    'download_ghosts',
    'fetch_error',
    'download_error',
    'nzb_deleted',
    'bad_fetch',
    'incomplete',
    'failed_par_check',
    'failed_repair',
    'failed_unpack',
  ];

  for (const keyword of nzbFailureKeywords) {
    if (statusLower.includes(keyword)) {
      return {
        isFailure: true,
        reason: DownloadFailureReason.NZB_FAILED,
        description: `NZB download failed: ${status.status}`,
      };
    }
  }

  // Check for generic NZB error in error string
  if (status.errorString) {
    const errorLower = status.errorString.toLowerCase();
    const nzbErrorKeywords = ['par2', 'unrar', 'unpack', 'repair', 'article', 'nzb'];

    for (const keyword of nzbErrorKeywords) {
      if (errorLower.includes(keyword)) {
        return {
          isFailure: true,
          reason: DownloadFailureReason.NZB_FAILED,
          description: `NZB error: ${status.errorString}`,
        };
      }
    }
  }

  return { isFailure: false };
}

/**
 * Determines if a download should be considered for retry
 * based on overall health metrics
 *
 * @param status - Current download status
 * @param config - Retry configuration
 * @returns Whether the download is healthy or should be retried
 */
export function isDownloadHealthy(
  status: DownloadClientStatus,
  config: DownloadRetryConfig
): boolean {
  const result = detectFailure(status, config);
  return !result.isFailure;
}

/**
 * Creates a DownloadClientStatus from various client-specific formats
 * This is a helper for normalizing different client responses
 *
 * @param clientStatus - Raw status from download client
 * @param clientType - Type of download client (transmission, deluge, nzbget, sabnzbd)
 * @returns Normalized DownloadClientStatus
 */
// eslint-disable-next-line complexity -- Pure data mapper normalizing 4 different download client APIs (Transmission, Deluge, NZBGet, SABnzbd) to common interface; branching inherent to multi-client support
export function normalizeClientStatus(
  clientStatus: Record<string, unknown>,
  clientType: string
): DownloadClientStatus {
  // Extract error string with proper handling
  const errorString = (clientStatus['errorString'] as string | undefined)
    ?? (clientStatus['error'] as string | undefined)
    ?? (clientStatus['error_message'] as string | undefined);

  const normalized: DownloadClientStatus = {
    status: String(clientStatus['status'] ?? clientStatus['state'] ?? 'unknown'),
    isStalled: Boolean(clientStatus['isStalled'] ?? clientStatus['is_stalled'] ?? false),
    progress: Number(clientStatus['progress'] ?? clientStatus['percentDone'] ?? 0),
    isComplete: Boolean(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive check for dynamic client data
      (clientStatus['isComplete']
      ?? clientStatus['is_finished']
      ?? (clientStatus['percentDone'] === 1))
      || (Number(clientStatus['progress']) >= 100)
    ),
  };

  // Only set errorString if it has a value (exactOptionalPropertyTypes compliance)
  if (errorString !== undefined) {
    normalized.errorString = errorString;
  }

  // Handle torrent-specific fields
  if (clientType === 'transmission' || clientType === 'deluge') {
    normalized.seeders = Number(clientStatus['seeders'] ?? clientStatus['num_seeds'] ?? clientStatus['peersSendingToUs']);
    normalized.peers = Number(clientStatus['peers'] ?? clientStatus['num_peers'] ?? clientStatus['peersConnected']);

    // Calculate time since last progress for Transmission
    if (clientStatus['secondsDownloading'] !== undefined && clientStatus['eta'] !== undefined) {
      // If eta is -1 or very high and download is not progressing, consider it stalled
      const eta = Number(clientStatus['eta']);
      if (eta === -1 || eta > 86400 * 7) { // -1 or > 7 days
        normalized.isStalled = true;
      }
    }

    // Deluge-specific stall detection
    if (clientStatus['time_since_download'] !== undefined) {
      normalized.secondsSinceLastProgress = Number(clientStatus['time_since_download']);
    }
  }

  // Handle NZB-specific fields
  if (clientType === 'nzbget' || clientType === 'sabnzbd') {
    // NZBGet uses different status field names
    if (clientType === 'nzbget') {
      const nzbStatus = String(clientStatus['Status'] ?? clientStatus['status']);
      normalized.status = nzbStatus;

      // NZBGet failure detection
      if (
        nzbStatus.includes('FAILURE')
        || nzbStatus.includes('BAD')
        || nzbStatus.includes('DELETED')
      ) {
        normalized.errorString = nzbStatus;
      }
    }

    // SABnzbd uses different status values
    if (clientType === 'sabnzbd') {
      const sabStatus = String(clientStatus['status'] ?? '');
      normalized.status = sabStatus;

      // iter-17: match any SAB status containing "failed" / "error" (was
      // previously limited to literal 'Failed' / 'Repair failed', missing
      // states like 'Extracting failed' and 'Verifying failed'). Prefer the
      // richer fail_message — populated by sabnzbd-converters from stage_log
      // when the client doesn't set it directly — so the NZB keyword matcher
      // can classify the failure as par2/unpack.
      const failMessage = clientStatus['fail_message'] as string | undefined;
      const sabStatusLower = sabStatus.toLowerCase();
      if (sabStatusLower.includes('failed') || sabStatusLower.includes('error')) {
        normalized.errorString = normalized.errorString ?? failMessage ?? sabStatus;
      }
    }
  }

  // Name and path for logging purposes
  normalized.name = String(clientStatus['name'] ?? clientStatus['title'] ?? 'unknown');
  normalized.savePath = String(clientStatus['savePath'] ?? clientStatus['save_path'] ?? clientStatus['downloadDir'] ?? '');

  return normalized;
}
