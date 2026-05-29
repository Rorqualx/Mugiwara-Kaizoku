/**
 * Download Feed Hook
 *
 * Subscribes to WebSocket channels for download progress, job updates,
 * and import progress. Normalizes events into a unified feed with
 * throttled rendering to avoid render storms from high-frequency events.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import type { WebSocketEvent } from '@/types/api/v1/websocket';

// ============================================================================
// Types
// ============================================================================

export type FeedSeverity = 'info' | 'success' | 'warning' | 'error';
export type FeedType = 'download' | 'job' | 'import' | 'failure' | 'search';

export interface FeedMessage {
  id: string;
  timestamp: string;
  type: FeedType;
  summary: string;
  severity: FeedSeverity;
  progress?: number;
  jobType?: string;
}

export interface UseDownloadFeedResult {
  messages: FeedMessage[];
  latestMessage: FeedMessage | null;
  messageCount: number;
  clearHistory: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_MESSAGES = 50;
const THROTTLE_MS = 300;
const MESSAGE_TTL_MS = 10_000; // Auto-dismiss terminal messages after 10 seconds
// In-flight messages (severity=info with progress unfinished) should NOT disappear after 10s —
// the user explicitly wants the panel to keep showing what's currently updating. Cap them at
// 5 minutes as a safety so a truly orphaned "started" event eventually clears itself.
const IN_FLIGHT_TTL_MS = 5 * 60_000;

function isInFlight(msg: FeedMessage): boolean {
  if (msg.severity !== 'info') return false;
  return msg.progress === undefined || msg.progress < 100;
}

// ============================================================================
// Helpers
// ============================================================================

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function formatDownloadEvent(data: Record<string, unknown>): FeedMessage {
  const status = String(data['status'] ?? 'unknown');
  const filename = data['filename'] ? String(data['filename']) : undefined;
  const progress = typeof data['progress'] === 'number' ? data['progress'] : undefined;
  const label = filename ?? `Task ${String(data['taskId'] ?? '?')}`;

  const severityMap: Record<string, FeedSeverity> = {
    completed: 'success', failed: 'error', paused: 'warning',
  };

  return {
    id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    type: 'download',
    summary: `${label}: ${status}${progress !== undefined ? ` (${Math.round(progress)}%)` : ''}`,
    severity: severityMap[status] ?? 'info',
    ...(progress !== undefined && { progress }),
  };
}

function formatJobEvent(data: Record<string, unknown>): FeedMessage {
  const status = String(data['status'] ?? 'unknown');
  const jobType = data['jobType'] ? String(data['jobType']) : undefined;
  const jobId = String(data['jobId'] ?? '?');
  const progress = typeof data['progress'] === 'number' ? data['progress'] : undefined;
  const label = jobType?.replace(/_/g, ' ') ?? `Job #${jobId}`;

  const severityMap: Record<string, FeedSeverity> = {
    completed: 'success', failed: 'error', cancelled: 'warning',
  };

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    type: 'job',
    summary: `${label}: ${status}${progress !== undefined ? ` (${Math.round(progress)}%)` : ''}`,
    severity: severityMap[status] ?? 'info',
    ...(progress !== undefined && { progress }),
    ...(jobType !== undefined && { jobType }),
  };
}

function formatImportEvent(data: Record<string, unknown>): FeedMessage {
  const operation = String(data['operation'] ?? 'unknown');
  const title = data['mangaTitle'] ? String(data['mangaTitle']) : 'Import';
  const progress = typeof data['progress'] === 'number' ? data['progress'] : undefined;
  const files = typeof data['filesImported'] === 'number' ? data['filesImported'] : undefined;
  const total = typeof data['totalFiles'] === 'number' ? data['totalFiles'] : undefined;

  const fileInfo = files !== undefined && total !== undefined ? ` (${files}/${total} files)` : '';

  const severityMap: Record<string, FeedSeverity> = {
    completed: 'success', failed: 'error',
  };

  return {
    id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    type: 'import',
    summary: `${title}: ${operation}${fileInfo}`,
    severity: severityMap[operation] ?? 'info',
    ...(progress !== undefined && { progress }),
  };
}

function formatSearchEvent(data: Record<string, unknown>): FeedMessage {
  const phase = String(data['phase'] ?? 'unknown');
  const title = data['mangaTitle'] ? String(data['mangaTitle']) : 'Search';
  const resultCount = typeof data['resultCount'] === 'number' ? data['resultCount'] : undefined;
  const failedQueryCount = typeof data['failedQueryCount'] === 'number' ? data['failedQueryCount'] : undefined;
  const errorDetails = Array.isArray(data['errorDetails']) ? data['errorDetails'] : undefined;

  // Build richer summary for error events with failure details
  let summary: string;
  if (phase === 'error' && failedQueryCount !== undefined && errorDetails !== undefined) {
    const reasons = errorDetails
      .map((e: unknown) => (isRecord(e) ? String(e['errorMessage'] ?? 'unknown') : 'unknown'))
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
      .slice(0, 3);
    summary = `${title}: ${failedQueryCount} search queries failed (${reasons.join(', ')})`;
  } else {
    summary = data['message'] ? String(data['message']) : `${title}: ${phase}`;
  }

  const severityMap: Record<string, FeedSeverity> = {
    complete: resultCount !== undefined && resultCount > 0 ? 'success' : 'warning',
    error: 'error',
  };

  return {
    id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    type: 'search',
    summary,
    severity: severityMap[phase] ?? 'info',
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useDownloadFeed(): UseDownloadFeedResult {
  const { subscribe, isConnected } = useRealTime();
  const bufferRef = useRef<FeedMessage[]>([]);
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlushRef = useRef(false);

  const flushBuffer = useCallback((): void => {
    pendingFlushRef.current = false;
    setMessages([...bufferRef.current]);
  }, []);

  const addMessage = useCallback((msg: FeedMessage): void => {
    bufferRef.current = [...bufferRef.current.slice(-(MAX_MESSAGES - 1)), msg];

    if (!pendingFlushRef.current) {
      pendingFlushRef.current = true;
      throttleRef.current = setTimeout(flushBuffer, THROTTLE_MS);
    }
  }, [flushBuffer]);

  // Subscribe to WebSocket channels
  useEffect(() => {
    if (!isConnected) return;

    const handleEvent = (event: WebSocketEvent): void => {
      const data = isRecord(event.data) ? event.data : {};
      const channel = event.channel ?? '';

      if (channel === 'search:progress' || event.type.startsWith('search:')) {
        addMessage(formatSearchEvent(data));
      } else if (channel === 'downloads:progress' || event.type.startsWith('download:')) {
        addMessage(formatDownloadEvent(data));
      } else if (channel === 'import:progress' || event.type.startsWith('import:')) {
        addMessage(formatImportEvent(data));
      } else {
        addMessage(formatJobEvent(data));
      }
    };

    const unsubs = [
      subscribe('downloads:progress', handleEvent),
      subscribe('jobs:active', handleEvent),
      subscribe('import:progress', handleEvent),
      subscribe('search:progress', handleEvent),
    ];

    return (): void => {
      unsubs.forEach(fn => fn());
      if (throttleRef.current) clearTimeout(throttleRef.current);
    };
  }, [isConnected, subscribe, addMessage]);

  // Auto-dismiss messages after TTL
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const before = bufferRef.current.length;
      bufferRef.current = bufferRef.current.filter((msg) => {
        const ageMs = now - new Date(msg.timestamp).getTime();
        return ageMs < (isInFlight(msg) ? IN_FLIGHT_TTL_MS : MESSAGE_TTL_MS);
      });
      if (bufferRef.current.length !== before) {
        flushBuffer();
      }
    }, 2000);

    return (): void => { clearInterval(interval); };
  }, [flushBuffer]);

  const clearHistory = useCallback((): void => {
    bufferRef.current = [];
    setMessages([]);
  }, []);

  return {
    messages,
    latestMessage: messages.length > 0 ? messages[messages.length - 1] ?? null : null,
    messageCount: messages.length,
    clearHistory,
  };
}
