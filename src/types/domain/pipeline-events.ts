/**
 * Pipeline Event Types
 *
 * Defines all typed event payloads and the event map for the in-process
 * PipelineEventBus. These events track the lifecycle of the download
 * pipeline: search -> score -> grab -> download -> import.
 *
 * IMPORTANT: This is separate from the WebSocket/RealtimeEventEmitter types.
 * Pipeline events are internal server-side events; the realtime bridge handler
 * forwards selected events to WebSocket clients.
 *
 * @module types/domain/pipeline-events
 */

import type { ProwlarrSearchResult } from '@/types/prowlarr';

// ============================================================================
// Event Name Constants
// ============================================================================

export const PIPELINE_EVENTS = {
  SEARCH_COMPLETED: 'pipeline:search-completed',
  RELEASE_SCORED: 'pipeline:release-scored',
  RELEASE_REJECTED: 'pipeline:release-rejected',
  DOWNLOAD_GRABBED: 'pipeline:download-grabbed',
  DOWNLOAD_COMPLETED: 'pipeline:download-completed',
  DOWNLOAD_FAILED: 'pipeline:download-failed',
  IMPORT_STARTED: 'pipeline:import-started',
  IMPORT_COMPLETED: 'pipeline:import-completed',
  IMPORT_FAILED: 'pipeline:import-failed',
  IMPORT_BLOCKED: 'pipeline:import-blocked',
  SEARCH_FAILED: 'pipeline:search-failed',
} as const;

export type PipelineEventName = (typeof PIPELINE_EVENTS)[keyof typeof PIPELINE_EVENTS];

// ============================================================================
// Base Event Interface
// ============================================================================

export interface PipelineEventBase {
  /** ISO timestamp of when the event occurred */
  timestamp: Date;
  /** Service that emitted the event (e.g. 'chapter-processor', 'download-monitor') */
  source: string;
}

// ============================================================================
// Search & Scoring Events
// ============================================================================

export interface SearchCompletedEvent extends PipelineEventBase {
  mangaId: number;
  mangaTitle: string;
  query: string;
  resultCount: number;
  indexersQueried: number;
}

export interface SearchFailedEvent extends PipelineEventBase {
  mangaId: number;
  mangaTitle: string;
  query: string;
  totalQueries: number;
  failedQueries: number;
  errors: Array<{ searchQuery: string; errorMessage: string; statusCode?: number | undefined }>;
}

export interface ReleaseScoredEvent extends PipelineEventBase {
  mangaId: number;
  releaseTitle: string;
  indexer: string;
  score: number;
  accepted: boolean;
  breakdown: Record<string, number>;
}

export interface ReleaseRejectedEvent extends PipelineEventBase {
  mangaId: number;
  chapterId?: number;
  releaseTitle: string;
  indexer: string;
  downloadUrl: string;
  size: number;
  seeders?: number;
  score: number;
  rejectionReason: string;
  rejectionType: 'permanent' | 'temporary';
  prowlarrResult: ProwlarrSearchResult;
}

// ============================================================================
// Download Events
// ============================================================================

export interface DownloadGrabbedEvent extends PipelineEventBase {
  mangaId: number;
  downloadId: string;
  clientType: string;
  releaseTitle: string;
  indexer: string;
  protocol: string;
  size: number;
}

export interface DownloadCompletedEvent extends PipelineEventBase {
  mangaId: number;
  downloadId: string;
  jobId: string;
  savePath: string;
  size: number;
}

export interface DownloadFailedEvent extends PipelineEventBase {
  mangaId: number;
  downloadId: string;
  jobId: string;
  error: string;
  willRetry: boolean;
}

// ============================================================================
// Import Events
// ============================================================================

export interface ImportStartedEvent extends PipelineEventBase {
  mangaId: number;
  packDownloadId: number;
  downloadId: string;
}

export interface ImportCompletedEvent extends PipelineEventBase {
  mangaId: number;
  packDownloadId: number;
  chaptersCreated: number;
  chapterIds: number[];
}

export interface ImportFailedEvent extends PipelineEventBase {
  mangaId: number;
  packDownloadId: number;
  error: string;
}

export interface ImportBlockedEvent extends PipelineEventBase {
  mangaId: number;
  packDownloadId: number;
  reason: string;
  actionUrl?: string;
}

// ============================================================================
// Event Map (type-safe handler registration)
// ============================================================================

export interface PipelineEventMap {
  [PIPELINE_EVENTS.SEARCH_COMPLETED]: SearchCompletedEvent;
  [PIPELINE_EVENTS.RELEASE_SCORED]: ReleaseScoredEvent;
  [PIPELINE_EVENTS.RELEASE_REJECTED]: ReleaseRejectedEvent;
  [PIPELINE_EVENTS.DOWNLOAD_GRABBED]: DownloadGrabbedEvent;
  [PIPELINE_EVENTS.DOWNLOAD_COMPLETED]: DownloadCompletedEvent;
  [PIPELINE_EVENTS.DOWNLOAD_FAILED]: DownloadFailedEvent;
  [PIPELINE_EVENTS.IMPORT_STARTED]: ImportStartedEvent;
  [PIPELINE_EVENTS.IMPORT_COMPLETED]: ImportCompletedEvent;
  [PIPELINE_EVENTS.IMPORT_FAILED]: ImportFailedEvent;
  [PIPELINE_EVENTS.IMPORT_BLOCKED]: ImportBlockedEvent;
  [PIPELINE_EVENTS.SEARCH_FAILED]: SearchFailedEvent;
}
