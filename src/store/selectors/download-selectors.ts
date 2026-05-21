/**
 * Download Selectors Module
 *
 * Provides memoized selectors for download queue and sync statistics.
 * Handles queue state, active downloads, and out-of-sync tracking.
 *
 * Extracted from: useStoreSelectors.ts (lines 313-335, 500-503, 558-561)
 *
 * @module store/selectors/download-selectors
 */

import { useMemo, useCallback } from 'react';

import { JobStatus } from '@/utils/job-validation';

import { useDownloadQueueStore, useSyncStore } from '../index';

import type { DownloadQueueItem, DownloadStats } from '../downloadQueueSlice';

/**
 * Download selectors return type
 *
 * Provides access to download queue state and statistics:
 * - Complete download queue
 * - Active downloads (currently in progress)
 * - Out-of-sync chapter statistics
 * - Download statistics with queued count
 */
export interface DownloadSelectors {
  /** Complete download queue */
  queue: DownloadQueueItem[];
  /** Active downloads (status: active) */
  activeDownloads: DownloadQueueItem[];
  /** Out-of-sync chapter statistics */
  outOfSyncStats: {
    /** Total out-of-sync chapters across all manga */
    total: number;
    /** Out-of-sync chapters grouped by manga ID */
    byManga: Record<string, number>;
  };
  /** Number of queued downloads */
  queuedDownloads: number;
  /** Download statistics including queued downloads */
  downloadStats: DownloadStats & {
    /** Number of queued downloads */
    queuedDownloads: number;
  };
}

/**
 * Hook for accessing download queue and sync selectors
 *
 * Provides memoized selectors for:
 * 1. Download queue array
 * 2. Active downloads (filtering queue for active items)
 * 3. Out-of-sync chapter statistics (aggregated by manga)
 * 4. Combined download statistics with queue count
 *
 * Performance optimizations:
 * - Uses stable selector functions
 * - Memoizes computed values
 * - Minimizes re-renders through selective subscriptions
 *
 * @returns {DownloadSelectors} Download queue state and statistics
 *
 * @example
 * ```typescript
 * function DownloadPanel() {
 *   const {
 *     queue,
 *     activeDownloads,
 *     outOfSyncStats,
 *     downloadStats
 *   } = useDownloadSelectors();
 *
 *   return (
 *     <div>
 *       <p>Active: {activeDownloads.length}</p>
 *       <p>Out of sync: {outOfSyncStats.total}</p>
 *       <p>Progress: {downloadStats.completed}/{downloadStats.total}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDownloadSelectors(): DownloadSelectors {
  // Create stable selector for download queue state
  const queueSelector = useCallback(
    (state: ReturnType<typeof useDownloadQueueStore.getState>) => ({
      queue: state.queue,
      queuedDownloads: state.queuedDownloads,
      downloadStats: state.downloadStats
    }),
    []
  );

  // Create stable selector for sync state
  const syncSelector = useCallback(
    (state: ReturnType<typeof useSyncStore.getState>) => state,
    []
  );

  // Get state from stores
  const queueState = useDownloadQueueStore(queueSelector);
  const syncState = useSyncStore(syncSelector);

  // 1. Queue computation (lines 313-317)
  // Returns the download queue array
  const queue = useMemo(() => {
    return queueState.queue;
  }, [queueState.queue]);

  // 2. Active downloads computation (lines 318-321)
  // Filters queue for items with active status
  const activeDownloads = useMemo(() => {
    return queue.filter(i => i.status === JobStatus.active);
  }, [queue]);

  // 3. Out-of-sync stats computation (lines 322-335)
  // Aggregates out-of-sync chapters and groups by manga ID
  const outOfSyncStats = useMemo(() => {
    const chapters = syncState;

    // Group chapters by manga ID and count them
    const byManga = Object.entries(chapters).reduce<Record<string, number>>(
      (acc, [mangaId, chaps]) => {
        return {
          ...acc,
          [mangaId]: Array.isArray(chaps) ? chaps.length : 0
        };
      },
      {}
    );

    // Calculate total across all manga
    return {
      total: Object.values(chapters).flat().length,
      byManga
    };
  }, [syncState]);

  // 4. Download stats computation (lines 500-503, 558-561)
  // Combines download stats with queued downloads count
  const downloadStats = useMemo(
    () => ({
      queuedDownloads: queueState.queuedDownloads,
      ...queueState.downloadStats
    }),
    [queueState.queuedDownloads, queueState.downloadStats]
  );

  return {
    queue,
    activeDownloads,
    outOfSyncStats,
    queuedDownloads: queueState.queuedDownloads,
    downloadStats
  };
}
