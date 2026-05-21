/**
 * Tracked Downloads Hook
 *
 * Subscribes to the 'tracked-downloads:state' WebSocket channel and
 * maintains a local map of tracked download states. Components can
 * look up the current TrackedDownloadState for any job by its ID.
 *
 * @module hooks/useTrackedDownloads
 */

import { useState, useCallback, useEffect } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import type { WebSocketEvent } from '@/types/api/v1/websocket';

// ============================================================================
// Types
// ============================================================================

export interface TrackedDownloadStatus {
  id: string;
  state: string;
  previousState: string;
  downloadId: string;
  mangaId: number;
  releaseTitle: string;
  progress: number;
  errorMessage: string | null;
}

export interface UseTrackedDownloadsReturn {
  getState: (jobId: string) => string | undefined;
  getStatus: (jobId: string) => TrackedDownloadStatus | undefined;
  states: Map<string, TrackedDownloadStatus>;
}

// ============================================================================
// Type Guards
// ============================================================================

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseStatus(data: Record<string, unknown>): TrackedDownloadStatus | null {
  const id = data['id'];
  const state = data['newState'];
  const previousState = data['previousState'];
  const downloadId = data['downloadId'];
  const mangaId = data['mangaId'];
  const releaseTitle = data['releaseTitle'];
  const progress = data['progress'];
  const errorMessage = data['errorMessage'];

  if (
    typeof id !== 'string' ||
    typeof state !== 'string' ||
    typeof previousState !== 'string' ||
    typeof downloadId !== 'string' ||
    typeof mangaId !== 'number' ||
    typeof releaseTitle !== 'string' ||
    typeof progress !== 'number'
  ) {
    return null;
  }

  return {
    id,
    state,
    previousState,
    downloadId,
    mangaId,
    releaseTitle,
    progress,
    errorMessage: typeof errorMessage === 'string' ? errorMessage : null,
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useTrackedDownloads(): UseTrackedDownloadsReturn {
  const { isConnected, subscribe } = useRealTime();
  const [stateMap, setStateMap] = useState<Map<string, TrackedDownloadStatus>>(new Map());

  // Handle tracked-download state-changed events
  const handleStateChange = useCallback((event: WebSocketEvent): void => {
    const data = isRecord(event.data) ? event.data : null;
    if (!data) return;

    const status = parseStatus(data);
    if (!status) return;

    setStateMap(prev => {
      const next = new Map(prev);
      next.set(status.id, status);
      return next;
    });
  }, []);

  // Subscribe to tracked-downloads:state channel
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('tracked-downloads:state', handleStateChange);
    return unsubscribe;
  }, [isConnected, subscribe, handleStateChange]);

  const getState = useCallback((jobId: string): string | undefined => {
    const key = `job:${jobId}`;
    return stateMap.get(key)?.state;
  }, [stateMap]);

  const getStatus = useCallback((jobId: string): TrackedDownloadStatus | undefined => {
    const key = `job:${jobId}`;
    return stateMap.get(key);
  }, [stateMap]);

  return { getState, getStatus, states: stateMap };
}
