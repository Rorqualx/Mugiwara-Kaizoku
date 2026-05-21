/**
 * Job Utilities
 *
 * Helper functions for type checking and data extraction from job objects.
 *
 * @module utils/job-utils
 */

import { JobType } from '@/utils/job-validation';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a Record object
 * @param value - Value to check
 * @returns True if value is a non-null object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Map chapters for manual import - returns all chapters regardless of status
 * @param chapters - Array of chapter data from API
 * @returns Mapped array of chapters for import with volume info
 */
export function mapChaptersForImport(chapters: unknown[]): Array<{
  id: number;
  title: string;
  chapterNumber?: number | undefined;
  index: number;
  downloadStatus: string;
  volume?: number | undefined;
}> {
  return chapters
    .filter((ch: unknown) => {
      if (!ch || typeof ch !== 'object') return false;
      return true; // No status filtering - show all chapters
    })
    .map((ch: unknown) => {
      const chapter = ch as Record<string, unknown>;
      return {
        id: typeof chapter['id'] === 'number' ? chapter['id'] : 0,
        title: typeof chapter['title'] === 'string' ? chapter['title'] : 'Unknown',
        chapterNumber: typeof chapter['chapterNumber'] === 'number' ? chapter['chapterNumber'] : undefined,
        index: typeof chapter['index'] === 'number' ? chapter['index'] : 0,
        downloadStatus: typeof chapter['downloadStatus'] === 'string' ? chapter['downloadStatus'] : 'UNKNOWN',
        volume: typeof chapter['volume'] === 'number' ? chapter['volume'] : undefined
      };
    });
}

// ============================================================================
// Formatters
// ============================================================================

/**
 * Format a date to relative time string (e.g., "5 minutes ago")
 * @param date - Date to format
 * @param options - Optional formatting options
 * @returns Formatted relative time string
 */
export function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let result = '';
  if (days > 0) {
    result = `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    result = `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    result = `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    result = 'less than a minute';
  }

  return options?.addSuffix ? `${result} ago` : result;
}

/**
 * Format processing time from milliseconds to readable string
 * @param ms - Processing time in milliseconds
 * @returns Formatted string (e.g., "2.5s", "45ms", "1.2m")
 */
export function formatProcessingTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return 'Unknown';

  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`;
  } else {
    return `${(ms / 3600000).toFixed(1)}h`;
  }
}

// ============================================================================
// Job Data Extractors
// ============================================================================

/**
 * Get task type label for display
 * @param type - Job type enum value
 * @returns Human-readable label
 */
export function getTaskTypeLabel(type: JobType): string {
  switch (type) {
    case JobType.chapter_check:
      return 'Check Chapters';
    case JobType.chapter_download:
      return 'Chapter Download';
    case JobType.metadata_refresh:
      return 'Metadata Refresh';
    case JobType.library_scan:
      return 'Library Scan';
    case JobType.backup_create:
      return 'Backup';
    case JobType.chapter_sync:
      return 'Sync Fix';
    default:
      return type.replace(/_/g, ' ');
  }
}

/**
 * Extract release title from job result or payload
 * @param task - Job task object
 * @returns Release title or fallback text
 */
export function getReleaseTitle(task: Record<string, unknown>): string {
  // Try to get from result field first
  const result = task['result'];
  if (result && isRecord(result)) {
    const releaseTitle = result['releaseTitle'];
    if (typeof releaseTitle === 'string' && releaseTitle) {
      return releaseTitle;
    }
  }

  // Try to get from payload
  const payload = task['payload'];
  if (payload && isRecord(payload)) {
    const title = payload['title'] ?? payload['releaseTitle'];
    if (typeof title === 'string' && title) {
      return title;
    }
  }

  return 'N/A';
}

/**
 * Extract download client type from job result
 * @param task - Job task object
 * @returns Client type (e.g., "Transmission", "Nzbget") or "N/A"
 */
export function getClientType(task: Record<string, unknown>): string {
  const result = task['result'];
  if (result && isRecord(result)) {
    const clientType = result['clientType'];
    if (typeof clientType === 'string' && clientType) {
      // Capitalize first letter
      return clientType.charAt(0).toUpperCase() + clientType.slice(1);
    }
  }
  return 'N/A';
}

/**
 * Extract indexer/source from job result or payload
 * @param task - Job task object
 * @returns Indexer name or "N/A"
 */
export function getIndexer(task: Record<string, unknown>): string {
  // Try result field first
  const result = task['result'];
  if (result && isRecord(result)) {
    const indexer = result['indexer'];
    if (typeof indexer === 'string' && indexer) {
      return indexer;
    }
  }

  // Try payload
  const payload = task['payload'];
  if (payload && isRecord(payload)) {
    const indexer = payload['indexer'];
    if (typeof indexer === 'string' && indexer) {
      return indexer;
    }

    // Check prowlarrResult
    const prowlarrResult = payload['prowlarrResult'];
    if (prowlarrResult && isRecord(prowlarrResult)) {
      const prowlarrIndexer = prowlarrResult['indexer'];
      if (typeof prowlarrIndexer === 'string' && prowlarrIndexer) {
        return prowlarrIndexer;
      }
    }
  }

  return 'N/A';
}

/**
 * Extract download save path from job result
 * @param task - Job task object
 * @returns Save path or undefined
 */
export function getSavePath(task: Record<string, unknown>): string | undefined {
  const result = task['result'];
  if (result && isRecord(result)) {
    const savePath = result['savePath'];
    if (typeof savePath === 'string' && savePath) {
      return savePath;
    }
  }
  return undefined;
}

/**
 * Check if this is a CHAPTER_DOWNLOAD job
 * @param task - Job task object
 * @returns True if this is a download job
 */
export function isDownloadJob(task: Record<string, unknown>): boolean {
  return task['job_type'] === JobType.chapter_download;
}