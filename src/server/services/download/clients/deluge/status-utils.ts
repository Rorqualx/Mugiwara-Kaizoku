/**
 * Deluge Status Utilities
 *
 * Status conversion utilities for mapping Deluge torrent states to
 * standardized DownloadStatus values and converting to DownloadItem format.
 * Extracted from: delugeClient.ts (lines 845-935)
 */

import { DownloadStatus } from '@prisma/client';

import type { DownloadItem } from '@/server/services/download/base';



import type { DelugeTorrentStatus } from './types';


/**
 * Deluge status values
 */
export const DelugeStatusValues = {
  PAUSED: 'paused',
  QUEUED: 'queued',
  CHECKING: 'checking',
  DOWNLOADING: 'downloading',
  SEEDING: 'seeding',
  ALLOCATING: 'allocating',
  ERROR: 'error',
} as const;

/**
 * Type for valid Deluge status values
 */
type DelugeStatusValue = (typeof DelugeStatusValues)[keyof typeof DelugeStatusValues];

/**
 * Maps Deluge status to standardized DownloadStatus
 *
 * @param state - Deluge state string
 * @returns Standardized download status
 */
export function mapDelugeStatus(state: unknown): DownloadStatus {
  // Type guard for string values
  if (typeof state !== 'string') {
    return DownloadStatus.UNKNOWN;
  }

  // Normalize state to lowercase for consistent comparison
  const normalizedState = state.toLowerCase();

  // Type guard to check if normalized state is a valid DelugeStatus value
  const isValidDelugeStatus = (status: string): status is DelugeStatusValue => {
    return Object.values(DelugeStatusValues).includes(status as DelugeStatusValue);
  };

  // If not a valid status string, return unknown
  if (!isValidDelugeStatus(normalizedState)) {
    return DownloadStatus.UNKNOWN;
  }

  // Type-safe status mapping using object references
  switch (normalizedState) {
    case DelugeStatusValues.PAUSED:
      return DownloadStatus.PAUSED;

    case DelugeStatusValues.QUEUED:
    case DelugeStatusValues.CHECKING:
      return DownloadStatus.QUEUED;

    case DelugeStatusValues.DOWNLOADING:
    case DelugeStatusValues.ALLOCATING:
      return DownloadStatus.DOWNLOADING;

    case DelugeStatusValues.SEEDING:
      return DownloadStatus.COMPLETED;

    case DelugeStatusValues.ERROR:
      return DownloadStatus.ERROR;

    default:
      // This should never happen if the isValidDelugeStatus check passes,
      // but TypeScript requires handling the default case for exhaustiveness
      return DownloadStatus.UNKNOWN;
  }
}

/**
 * Converts a Deluge torrent status to a standardized DownloadItem
 *
 * @param id - Torrent ID
 * @param status - Deluge torrent status
 * @returns Standardized download item
 */
export function convertToDownloadItem(id: string, status: DelugeTorrentStatus): DownloadItem {
  // Map status
  const downloadStatus = mapDelugeStatus(status.state);

  // Calculate dates
  const dateAdded = status.time_added ? new Date(status.time_added * 1000) : new Date();
  const _dateCompleted = status.completed_time
    ? new Date(status.completed_time * 1000)
    : undefined;

  // Create download item
  const downloadItem: DownloadItem = {
    id,
    name: status['name'],
    status: downloadStatus,
    progress: Math.round(status.progress * 100),
    downloadSpeed: status.download_payload_rate,
    uploadSpeed: status.upload_payload_rate,
    totalSize: status.total_size,
    downloadedSize: status.total_done,
    dateAdded,
    savePath: status.save_path,
    files: [],
    ...(status.eta >= 0 && { eta: status.eta }),
    ...(status.label && { labels: [status.label] }),
  };

  // Add files if available with proper array validation
  if (Array.isArray(status.files) && status.files.length > 0) {
    downloadItem.files = status.files.map((file: unknown) => {
      // Validate file object has required properties
      if (typeof file !== 'object' || file === null) {
        return { name: 'Unknown file', size: 0, progress: 0 };
      }
      const fileObj = file as Record<string, unknown>;

      return {
        name: typeof fileObj['path'] === 'string' ? fileObj['path'] : 'Unknown file',
        size: typeof fileObj['size'] === 'number' ? fileObj['size'] : 0,
        progress: typeof fileObj['progress'] === 'number' ? (fileObj['progress'] as number) * 100 : 0,
      };
    });
  }

  return downloadItem;
}
