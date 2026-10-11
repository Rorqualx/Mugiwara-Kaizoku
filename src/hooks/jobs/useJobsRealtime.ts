/**
 * Realtime feed for the Jobs page.
 *
 * Owns the WebSocket subscriptions, the per-job live overlay (progress, speed,
 * ETA, "importing" status) and the polling fallback, so the page component only
 * renders.
 *
 * Two things here are deliberate:
 * - `downloads:progress` events are buffered in a ref and applied in ONE state
 *   update per flush window. A busy download client emits several events per
 *   second per job; applying each one re-mapped, re-sorted and re-rendered up
 *   to 100 table rows per event.
 * - The subscription effect depends only on stable callbacks. Depending on a
 *   freshly-built object made the effect unsubscribe and resubscribe on every
 *   render, which in turn re-rendered every realtime consumer.
 *
 * @module hooks/jobs/useJobsRealtime
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';

/** How often buffered progress events are applied to React state. */
const PROGRESS_FLUSH_MS = 250;

/** Trailing window that collapses a burst of finished jobs into one refetch. */
const REFETCH_DEBOUNCE_MS = 750;

/** Poll interval used only while the socket is disconnected. */
const FALLBACK_POLL_MS = 3000;

/** Transfer statistics reported by the download client for one job. */
export interface JobLiveStats {
  speed?: number;
  eta?: number;
}

/** Live values layered over the queried job rows, keyed by job id. */
export interface JobLiveOverlay {
  progressMap: Record<string, number>;
  statusMap: Record<string, string>;
  statsMap: Record<string, JobLiveStats>;
}

/** Stable refetch callbacks from `useJobQueries`. */
export interface JobsRealtimeRefetchers {
  refetchActiveStatuses: () => void;
  refetchCompleted: () => Promise<unknown>;
  refetchFailed: () => Promise<unknown>;
  refetchAll: () => void;
}

/** One buffered `downloads:progress` event, merged per job until the flush. */
interface PendingUpdate {
  progress?: number;
  stats?: JobLiveStats;
  /** `'importing'` to set the status, `null` to clear it, absent to leave it. */
  status?: 'importing' | null;
}

const EMPTY_OVERLAY: JobLiveOverlay = { progressMap: {}, statusMap: {}, statsMap: {} };

/** Reads the fields the Jobs page uses out of a `downloads:progress` payload. */
function parseProgressEvent(event: { data?: unknown }): { taskId: string; update: PendingUpdate; finished: boolean } | null {
  if (!event.data || typeof event.data !== 'object') return null;
  const payload = event.data as Record<string, unknown>;
  const taskId = payload['taskId'];
  if (typeof taskId !== 'string') return null;

  const update: PendingUpdate = {};
  const progress = payload['progress'];
  if (typeof progress === 'number') update.progress = Math.round(progress);

  const speed = payload['speed'];
  const eta = payload['eta'];
  if (typeof speed === 'number' || typeof eta === 'number') {
    update.stats = {
      ...(typeof speed === 'number' ? { speed } : {}),
      ...(typeof eta === 'number' ? { eta } : {}),
    };
  }

  const status = payload['status'];
  if (typeof status === 'string') update.status = status === 'importing' ? 'importing' : null;

  return { taskId, update, finished: status === 'completed' || status === 'failed' };
}

/** Applies every buffered update to the overlay, returning a new overlay. */
function applyPending(prev: JobLiveOverlay, pending: Map<string, PendingUpdate>): JobLiveOverlay {
  const progressMap = { ...prev.progressMap };
  const statusMap = { ...prev.statusMap };
  const statsMap = { ...prev.statsMap };
  for (const [taskId, update] of pending) {
    if (update.progress !== undefined) progressMap[taskId] = update.progress;
    if (update.stats !== undefined) statsMap[taskId] = update.stats;
    if (update.status === 'importing') statusMap[taskId] = 'importing';
    else if (update.status === null) Reflect.deleteProperty(statusMap, taskId);
  }
  return { progressMap, statusMap, statsMap };
}

/**
 * Subscribes the Jobs page to job and download events.
 *
 * @param refetchers - stable refetch callbacks (identity must not change per render)
 * @returns the live overlay to merge into the job rows
 */
export function useJobsRealtime(refetchers: JobsRealtimeRefetchers): JobLiveOverlay {
  const { refetchActiveStatuses, refetchCompleted, refetchFailed, refetchAll } = refetchers;
  const { isConnected, subscribe } = useRealTime();
  const [overlay, setOverlay] = useState<JobLiveOverlay>(EMPTY_OVERLAY);

  const pendingRef = useRef<Map<string, PendingUpdate>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback((): void => {
    flushTimerRef.current = null;
    const pending = pendingRef.current;
    if (pending.size === 0) return;
    pendingRef.current = new Map();
    setOverlay(prev => applyPending(prev, pending));
  }, []);

  const scheduleRefetchAll = useCallback((): void => {
    if (refetchTimerRef.current !== null) return;
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null;
      refetchAll();
    }, REFETCH_DEBOUNCE_MS);
  }, [refetchAll]);

  const handleDownloadProgress = useCallback((event: { data?: unknown }): void => {
    const parsed = parseProgressEvent(event);
    if (!parsed) return;
    const existing = pendingRef.current.get(parsed.taskId);
    pendingRef.current.set(parsed.taskId, { ...existing, ...parsed.update });
    flushTimerRef.current ??= setTimeout(flush, PROGRESS_FLUSH_MS);
    if (parsed.finished) scheduleRefetchAll();
  }, [flush, scheduleRefetchAll]);

  useEffect(() => {
    if (!isConnected) return;
    const unsubs = [
      subscribe('jobs:active', refetchActiveStatuses),
      subscribe('jobs:failed', () => { void refetchFailed(); }),
      subscribe('jobs:completed', () => { void refetchCompleted(); }),
      subscribe('downloads:progress', handleDownloadProgress),
    ];
    return () => { unsubs.forEach(unsubscribe => unsubscribe()); };
  }, [isConnected, subscribe, refetchActiveStatuses, refetchFailed, refetchCompleted, handleDownloadProgress]);

  // Timers outlive a reconnect on purpose (a pending flush still applies);
  // they are only dropped when the page unmounts.
  useEffect(() => {
    return () => {
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
      if (refetchTimerRef.current !== null) clearTimeout(refetchTimerRef.current);
      flushTimerRef.current = null;
      refetchTimerRef.current = null;
    };
  }, []);

  // Fallback polling while the socket is down.
  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(refetchAll, FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [isConnected, refetchAll]);

  return overlay;
}
