/**
 * Transmission Torrent Utilities
 *
 * Utility functions for torrent data conversion and status mapping.
 *
 * Extracted from: torrent-operations.ts
 */


import { DownloadStatus } from '@prisma/client';

import type { DownloadItem } from '@/server/services/download/base';
import { toStringId } from '@/utils/id-converters';


import type {
  TransmissionTorrent,
  TransmissionTorrentStatus,
} from './types';

/**
 * Converts a Transmission torrent to a standardized DownloadItem
 *
 * @param torrent - Transmission torrent
 * @returns Standardized download item
 */
export function convertTorrentToDownloadItem(torrent: TransmissionTorrent): DownloadItem {
  // Map status
  const status = mapStatus(torrent['status']);

  // Calculate dates
  const dateAdded = torrent.addedDate ? new Date(torrent.addedDate * 1000) : new Date();
  const dateCompleted = torrent.doneDate ? new Date(torrent.doneDate * 1000) : undefined;

  // Calculate eta
  const eta = torrent.eta >= 0 ? torrent.eta : undefined;

  // Create download item
  const downloadItem: DownloadItem = {
    id: toStringId(torrent['id']),
    name: torrent['name'],
    status,
    progress: Math.round(torrent.percentDone * 100),
    downloadSpeed: torrent.rateDownload,
    uploadSpeed: torrent.rateUpload,
    ...(eta !== undefined ? { eta } : {}),
    totalSize: torrent.totalSize,
    downloadedSize: torrent.downloadedEver,
    size: torrent.totalSize,
    downloaded: torrent.downloadedEver,
    uploaded: torrent.uploadedEver,
    ratio: torrent.uploadRatio,
    seedRatio: torrent.uploadRatio,
    dateAdded,
    ...(dateCompleted !== undefined ? { dateCompleted } : {}),
    savePath: torrent.downloadDir,
    files: torrent.files
      ? torrent.files.map((f) => ({
          name: f['name'],
          size: f.length,
          progress:
            f.bytesCompleted && f.length ? Math.round((f.bytesCompleted / f.length) * 100) : 0,
        }))
      : [],
    labels: torrent.labels ?? [],
    trackers: torrent.trackers ? torrent.trackers.map((t) => t.announce) : [],
    ...(torrent.errorString !== undefined ? { error: torrent.errorString } : {}),
    clientSpecific: {
      hashString: torrent.hashString,
      downloadDir: torrent.downloadDir,
      isFinished: torrent.isFinished,
      isStalled: torrent.isStalled,
      labels: torrent.labels,
      files: torrent.files,
      fileStats: torrent.fileStats,
      peers: torrent.peers,
      trackers: torrent.trackers,
    },
  };

  return downloadItem;
}

/**
 * Maps Transmission status to standardized DownloadStatus
 *
 * @param transmissionStatus - Transmission status code
 * @returns Standardized download status
 */
export function mapStatus(transmissionStatus: unknown): DownloadStatus {
  // Type guard for number values
  if (typeof transmissionStatus !== 'number') {
    return DownloadStatus.UNKNOWN;
  }

  // Type guard to check if status is a valid TransmissionTorrentStatus value
  const isValidTransmissionStatus = (status: number): status is TransmissionTorrentStatus => {
    return [0, 1, 2, 3, 4, 5, 6].includes(status);
  };

  // If not a valid status code, return unknown
  if (!isValidTransmissionStatus(transmissionStatus)) {
    return DownloadStatus.UNKNOWN;
  }

  // Type-safe status mapping using numeric values
  // TransmissionTorrentStatus enum values:
  // STOPPED = 0, CHECK_WAIT = 1, CHECK = 2, DOWNLOAD_WAIT = 3, DOWNLOAD = 4, SEED_WAIT = 5, SEED = 6
  switch (transmissionStatus) {
    case 0: // STOPPED
      return DownloadStatus.PAUSED;
    case 1: // CHECK_WAIT
    case 2: // CHECK
      return DownloadStatus.DOWNLOADING;
    case 3: // DOWNLOAD_WAIT
      return DownloadStatus.QUEUED;
    case 4: // DOWNLOAD
      return DownloadStatus.DOWNLOADING;
    case 5: // SEED_WAIT
      return DownloadStatus.QUEUED;
    case 6: // SEED
      return DownloadStatus.SEEDING;
    default:
      return DownloadStatus.UNKNOWN;
  }
}
