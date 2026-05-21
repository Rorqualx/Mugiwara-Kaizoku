/**
 * Tracked Download Types
 *
 * Type definitions for the tracked download state machine.
 * Provides a formal model for download lifecycle management.
 *
 * @module server/services/download/tracked-download/types
 */

/**
 * All possible states a tracked download can be in.
 *
 * Lifecycle:
 *   Queued -> Downloading -> ImportPending -> Importing -> Imported
 *                         -> DownloadFailed -> (retry) -> Queued
 *                                          -> Failed
 *                         -> DownloadPaused -> Downloading
 *            ImportPending -> ImportBlocked -> (retry) -> Importing
 *                                          -> Ignored
 */
export enum TrackedDownloadState {
  QUEUED = 'Queued',
  DOWNLOADING = 'Downloading',
  DOWNLOAD_PAUSED = 'DownloadPaused',
  DOWNLOAD_FAILED = 'DownloadFailed',
  IMPORT_PENDING = 'ImportPending',
  IMPORTING = 'Importing',
  IMPORTED = 'Imported',
  IMPORT_BLOCKED = 'ImportBlocked',
  FAILED = 'Failed',
  IGNORED = 'Ignored',
}

/**
 * Events that trigger state transitions in the tracked download state machine.
 */
export enum TrackedDownloadEvent {
  DOWNLOAD_STARTED = 'DownloadStarted',
  DOWNLOAD_COMPLETED = 'DownloadCompleted',
  DOWNLOAD_FAILED = 'DownloadFailed',
  DOWNLOAD_PAUSED = 'DownloadPaused',
  DOWNLOAD_RESUMED = 'DownloadResumed',
  IMPORT_STARTED = 'ImportStarted',
  IMPORT_COMPLETED = 'ImportCompleted',
  IMPORT_FAILED = 'ImportFailed',
  RETRY_STARTED = 'RetryStarted',
  RETRY_IMPORT = 'RetryImport',
  RETRIES_EXHAUSTED = 'RetriesExhausted',
  MANUAL_IMPORT_COMPLETED = 'ManualImportCompleted',
  CANCELLED = 'Cancelled',
  IGNORED_BY_USER = 'IgnoredByUser',
}

/**
 * Represents a download being tracked through its lifecycle.
 */
export interface TrackedDownload {
  readonly id: string;
  state: TrackedDownloadState;
  previousState: TrackedDownloadState;
  readonly downloadId: string;
  readonly clientType: string;
  readonly mode: 'SINGLE' | 'PACK';
  readonly mangaId: number;
  readonly mangaTitle: string;
  readonly releaseTitle: string;
  readonly chapterIds: number[];
  readonly jobId: bigint;
  readonly packDownloadId: bigint | null;
  progress: number;
  downloadSpeed: number;
  seeders: number | null;
  errorMessage: string | null;
  attemptCount: number;
  stateChangedAt: Date;
  readonly createdAt: Date;
}

/**
 * Result of a state transition attempt.
 */
export interface TransitionResult {
  readonly success: boolean;
  readonly previousState: TrackedDownloadState;
  readonly newState: TrackedDownloadState;
  readonly error?: string;
}

/**
 * Parameters for creating a new tracked download.
 */
export interface CreateTrackedDownloadParams {
  readonly downloadId: string;
  readonly clientType: string;
  readonly mode: 'SINGLE' | 'PACK';
  readonly mangaId: number;
  readonly mangaTitle: string;
  readonly releaseTitle: string;
  readonly chapterIds: number[];
  readonly jobId: bigint;
  readonly packDownloadId?: bigint | null;
}
