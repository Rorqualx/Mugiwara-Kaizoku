/**
 * SABnzbd Status Mapping Utilities Module
 *
 * Handles status mapping between SABnzbd-specific status strings
 * and standardized DownloadStatus values.
 *
 * Extracted from: sabnzbdClient.ts (lines 608-639)
 */

import { DownloadStatus } from '@prisma/client';

/**
 * Maps SABnzbd queue status to standardized DownloadStatus
 */
export function mapStatus(sabnzbdStatus: string): DownloadStatus {
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
 */
export function mapHistoryStatus(historyStatus: string): DownloadStatus {
  if (historyStatus === 'Completed') {
    return DownloadStatus.COMPLETED;
  } else if (historyStatus === 'Failed') {
    return DownloadStatus.ERROR;
  } else {
    return DownloadStatus.UNKNOWN;
  }
}