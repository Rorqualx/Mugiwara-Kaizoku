/**
 * useQuickDownloadToast
 *
 * Updates a Mantine loading toast live as the unified auto-search fans out
 * across MangaDex / Suwayomi / Prowlarr / GetComics. Listens to the
 * `search:progress` realtime channel, filters by `mangaId`, and rewrites
 * the toast message in place via `notifications.update`.
 *
 * Phase coverage (each rewrites the message in place):
 *   - `searching` (no sources) — auto-selector's startup announce
 *   - `searching` (sources)    — phase-indexer-search declared list
 *   - `source-result`          — per-source settled (count + status glyph)
 *   - `dispatching`            — post-indexer-search, mid dispatch loop
 *   - `complete` / `error`     — hide toast
 *
 * A 3 s elapsed-time ticker is layered on top so the toast visibly ticks
 * during quiet stretches (the post-indexer-search dispatch loop especially
 * — on a 153-chapter bulk run it can be tens of seconds with no fresh
 * realtime event). Stops on `complete` / `error`.
 *
 * Pair with: `notifications.show({ id, title, message, loading: true })`
 * before invoking the Quick Download mutation. Hide the toast yourself in
 * the mutation's `onSettled` (defensive fallback); this hook hides on
 * `phase: 'complete' | 'error'` if it arrives first.
 */

import { useEffect, useRef } from 'react';

import { notifications } from '@mantine/notifications';

import { useRealTime } from '@/providers/RealTimeProvider';
import type { SearchSource } from '@/server/services/realtime/RealtimeEventEmitter';
import type { WebSocketEvent } from '@/types/api/v1/websocket';

type SourceStatus = 'ok' | 'timeout' | 'error';
type Phase = 'searching' | 'source-result' | 'dispatching' | 'complete' | 'error';

interface SearchEventData {
  mangaId: number;
  phase: Phase;
  message?: string;
  sources?: SearchSource[];
  source?: SearchSource;
  status?: SourceStatus;
  resultCount?: number;
  totalCount?: number;
}

interface ToastState {
  declared: SearchSource[];
  results: Map<SearchSource, { count: number; status: SourceStatus }>;
  /** Latest server message — used during `dispatching` / no-sources `searching`. */
  latestMessage: string | null;
  /** When the first event arrived. Drives the elapsed-time suffix. */
  startedAt: number | null;
  /** Track terminal state so the ticker self-stops if the unsubscribe loses the race. */
  done: boolean;
}

const ELAPSED_TICK_MS = 3000;

function isSearchEventData(v: unknown): v is SearchEventData {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r['mangaId'] === 'number' && typeof r['phase'] === 'string';
}

function statusGlyph(status: SourceStatus | undefined): string {
  if (status === 'ok') return '✓';
  if (status === 'timeout') return '⏱';
  if (status === 'error') return '✗';
  return '…';
}

function buildBaseMessage(state: ToastState): string {
  // Per-source breakdown is the richest signal once at least one source has
  // been declared or settled. Fall back to the latest server message (e.g.
  // 'Dispatching 153 chapters…'); only collapse to a generic string when
  // nothing's been said yet.
  const list = state.declared.length > 0 ? state.declared : [...state.results.keys()];
  if (list.length > 0) {
    const parts = list.map(src => {
      const v = state.results.get(src);
      return v ? `${src}: ${v.count} ${statusGlyph(v.status)}` : `${src}: …`;
    });
    return `Searching ${parts.join(' · ')}`;
  }
  return state.latestMessage ?? 'Searching enabled sources…';
}

function withElapsed(base: string, startedAt: number | null): string {
  if (startedAt === null) return base;
  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  if (elapsedSec < 1) return base;
  return `${base} · ${elapsedSec}s`;
}

function pushToast(notifId: string, message: string): void {
  // notifications.update on a missing id is a safe no-op, so we don't need
  // to guard against external dismissal.
  notifications.update({ id: notifId, loading: true, autoClose: false, message });
}

function applyEvent(data: SearchEventData, notifId: string, state: ToastState): void {
  if (data.message !== undefined) state.latestMessage = data.message;

  if (data.phase === 'searching') {
    if (Array.isArray(data.sources)) state.declared = data.sources;
    pushToast(notifId, withElapsed(buildBaseMessage(state), state.startedAt));
    return;
  }
  if (data.phase === 'source-result' && data.source) {
    state.results.set(data.source, { count: data.resultCount ?? 0, status: data.status ?? 'ok' });
    pushToast(notifId, withElapsed(buildBaseMessage(state), state.startedAt));
    return;
  }
  if (data.phase === 'dispatching') {
    // Override the per-source breakdown — the dispatch loop is the
    // bottleneck the user is waiting on, not the upstream search.
    const total = data.totalCount ?? 0;
    const cands = data.resultCount ?? 0;
    const msg = data.message
      ?? `Dispatching ${total} chapter${total === 1 ? '' : 's'} · ${cands} candidate${cands === 1 ? '' : 's'}…`;
    pushToast(notifId, withElapsed(msg, state.startedAt));
    return;
  }
  if (data.phase === 'complete' || data.phase === 'error') {
    state.done = true;
    notifications.hide(notifId);
  }
}

/**
 * Re-render the current state with a fresh elapsed-time suffix.
 * Called on a 3 s interval so the toast visibly ticks during quiet
 * server windows (esp. the post-indexer-search dispatch loop).
 *
 * Returns `false` when the ticker should self-stop (terminal phase or
 * pre-start) so the caller can `clearInterval`.
 */
function tickElapsed(state: ToastState, notifId: string): boolean {
  if (state.done || state.startedAt === null) return false;
  pushToast(notifId, withElapsed(buildBaseMessage(state), state.startedAt));
  return true;
}

export function useQuickDownloadToast(mangaId: number | null | undefined, notifId: string | null | undefined): void {
  const { subscribe, isConnected } = useRealTime();
  const stateRef = useRef<ToastState>({
    declared: [], results: new Map(), latestMessage: null, startedAt: null, done: false,
  });

  useEffect(() => {
    if (!isConnected || mangaId === null || mangaId === undefined || !notifId) return;
    stateRef.current = {
      declared: [], results: new Map(), latestMessage: null, startedAt: null, done: false,
    };

    let elapsedInterval: ReturnType<typeof setInterval> | null = null;
    const stopTicker = (): void => {
      if (elapsedInterval === null) return;
      clearInterval(elapsedInterval);
      elapsedInterval = null;
    };
    const startTickerIfNeeded = (): void => {
      if (elapsedInterval !== null) return;
      elapsedInterval = setInterval(() => {
        const alive = tickElapsed(stateRef.current, notifId);
        if (!alive) stopTicker();
      }, ELAPSED_TICK_MS);
    };

    const handler = (event: WebSocketEvent): void => {
      const data: unknown = event.data;
      if (!isSearchEventData(data)) return;
      if (data.mangaId !== mangaId) return;
      const state = stateRef.current;
      if (state.startedAt === null) {
        state.startedAt = Date.now();
        startTickerIfNeeded();
      }
      applyEvent(data, notifId, state);
      if (data.phase === 'complete' || data.phase === 'error') stopTicker();
    };

    const unsubscribe = subscribe('search:progress', handler);
    return () => {
      stopTicker();
      unsubscribe();
    };
  }, [isConnected, mangaId, notifId, subscribe]);
}
