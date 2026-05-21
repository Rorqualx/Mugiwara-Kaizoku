/**
 * SABnzbd Data Conversion Utilities Module
 *
 * Converts SABnzbd-specific data structures to standardized download items
 * for consistent handling across the application.
 *
 * Extracted from: sabnzbdClient.ts (lines 499-601)
 */

import { DownloadStatus } from '@prisma/client';

import { mapStatus, mapHistoryStatus } from './sabnzbd-status';
import { parseTimeLeft } from './sabnzbd-utils';

import type { DownloadItem } from '../base';
import type { SabnzbdQueueItem, SabnzbdHistoryItem } from './sabnzbd-types';

/**
 * Converts a SABnzbd queue item to a standardized DownloadItem
 */
export function convertQueueItemToDownloadItem(this: unknown, item: SabnzbdQueueItem): DownloadItem {
  // Parse values
  const percentageValue = parseFloat(item.percentage) || 0;
  const mbValue = parseFloat(item.mb) || 0;
  const speedValue = parseFloat(item.kbpersec) || 0;
  const progress = percentageValue;
  const totalSize = mbValue * 1024 * 1024; // MB to bytes
  const downloadSpeed = speedValue * 1024; // KB/s to bytes/s
  const downloaded = totalSize * (progress / 100);
  const eta = parseTimeLeft.call(this, item.timeleft);

  // Map status
  const status = mapStatus.call(this, item.status);

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
    savePath: item.storage || '',
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
 */
export function convertHistoryItemToDownloadItem(this: unknown, item: SabnzbdHistoryItem): DownloadItem {
  // Parse values
  const sizeFromString = parseFloat(item.size) || 0;
  const totalSize = item.bytes || sizeFromString;
  const completed = item.completed ? new Date(item.completed * 1000) : undefined;

  // Map status
  const status = mapHistoryStatus.call(this, item.status);

  // Create download item
  const downloadItem: DownloadItem = {
    id: item.nzo_id,
    name: item.name,
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
    // iter-17: SABnzbd sometimes marks the job as Failed without populating
    // fail_message (par2/unpack failures in particular). Inspect stage_log for
    // a structured reason so the failure-detector keyword matcher can pick up
    // par2/unrar/repair and raise NZB_FAILED instead of the generic bucket.
    downloadItem.error = extractStageLogFailure(item.stage_log) ?? 'Download failed';
  }

  return downloadItem;
}

function extractStageLogFailure(stageLog: SabnzbdHistoryItem['stage_log']): string | undefined {
  if (!Array.isArray(stageLog) || stageLog.length === 0) return undefined;
  const failureStages = ['Repair', 'Unpack', 'Decode', 'Verify'];
  for (const entry of stageLog) {
    if (!failureStages.includes(entry.name)) continue;
    const failedAction = entry.actions.find((a) => /fail|error|unable/i.test(a));
    if (failedAction !== undefined) {
      return `${entry.name.toLowerCase()} failed: ${failedAction}`;
    }
  }
  return undefined;
}