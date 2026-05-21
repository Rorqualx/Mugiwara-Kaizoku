/**
 * useQuickDownloadToast
 *
 * Updates a Mantine loading toast live as the unified auto-search fans out
 * across MangaDex / Suwayomi / Prowlarr / GetComics. Listens to the
 * `search:progress` realtime channel, filters by `mangaId`, and rewrites
 * the toast message in place via `notifications.update`.
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
type Phase = 'searching' | 'source-result' | 'complete' | 'error';

interface SearchEventData {
  mangaId: number;
  phase: Phase;
  message?: string;
  sources?: SearchSource[];
  source?: SearchSource;
  status?: SourceStatus;
  resultCount?: number;
}

interface ToastState {
  declared: SearchSource[];
  results: Map<SearchSource, { count: number; status: SourceStatus }>;
}

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

function buildMessage(state: ToastState): string {
  const list = state.declared.length > 0 ? state.declared : [...state.results.keys()];
  if (list.length === 0) return 'Searching enabled sources…';
  const parts = list.map(src => {
    const v = state.results.get(src);
    return v ? `${src}: ${v.count} ${statusGlyph(v.status)}` : `${src}: …`;
  });
  return `Searching ${parts.join(' · ')}`;
}

function applyEvent(data: SearchEventData, notifId: string, state: ToastState): void {
  if (data.phase === 'searching' && Array.isArray(data.sources)) {
    state.declared = data.sources;
    notifications.update({ id: notifId, loading: true, autoClose: false, message: data.message ?? buildMessage(state) });
    return;
  }
  if (data.phase === 'source-result' && data.source) {
    state.results.set(data.source, { count: data.resultCount ?? 0, status: data.status ?? 'ok' });
    notifications.update({ id: notifId, loading: true, autoClose: false, message: buildMessage(state) });
    return;
  }
  if (data.phase === 'complete' || data.phase === 'error') {
    notifications.hide(notifId);
  }
}

export function useQuickDownloadToast(mangaId: number | null | undefined, notifId: string | null | undefined): void {
  const { subscribe, isConnected } = useRealTime();
  const stateRef = useRef<ToastState>({ declared: [], results: new Map() });

  useEffect(() => {
    if (!isConnected || mangaId === null || mangaId === undefined || !notifId) return;
    stateRef.current = { declared: [], results: new Map() };

    const handler = (event: WebSocketEvent): void => {
      const data: unknown = event.data;
      if (!isSearchEventData(data)) return;
      if (data.mangaId !== mangaId) return;
      applyEvent(data, notifId, stateRef.current);
    };

    const unsubscribe = subscribe('search:progress', handler);
    return () => { unsubscribe(); };
  }, [isConnected, mangaId, notifId, subscribe]);
}
