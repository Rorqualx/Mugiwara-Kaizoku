/**
 * Tracked Download Service
 *
 * Manages an in-memory cache of TrackedDownload instances and orchestrates
 * state transitions, progress updates, and WebSocket event emission.
 *
 * Singleton pattern consistent with RealtimeEventEmitter.
 *
 * @module server/services/download/tracked-download/tracked-download-service
 */

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/utils/logger';

import { transition, canTransition, isTerminalState, getValidEvents } from './state-machine';
import { TrackedDownloadEvent, TrackedDownloadState } from './types';

import type {
  TrackedDownload,
  TransitionResult,
  CreateTrackedDownloadParams,
} from './types';

// ============================================================================
// Service Class
// ============================================================================

class TrackedDownloadService {
  private static instance: TrackedDownloadService | undefined;

  /** In-memory cache keyed by tracked download ID */
  private readonly downloads: Map<string, TrackedDownload> = new Map();

  /** Secondary index: downloadId (client hash) -> tracked download ID */
  private readonly downloadIdIndex: Map<string, string> = new Map();

  private constructor() {
    logger.info('[TrackedDownloadService] Initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TrackedDownloadService {
    TrackedDownloadService.instance ??= new TrackedDownloadService();
    return TrackedDownloadService.instance;
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get all tracked downloads
   *
   * @returns Array of all tracked downloads
   */
  public getAll(): TrackedDownload[] {
    return [...this.downloads.values()];
  }

  /**
   * Get a tracked download by its ID
   *
   * @param id - Tracked download ID (e.g., "job:123")
   * @returns The tracked download, or undefined if not found
   */
  public get(id: string): TrackedDownload | undefined {
    return this.downloads.get(id);
  }

  /**
   * Get a tracked download by its client download ID (hash)
   *
   * @param downloadId - The download client hash/ID
   * @returns The tracked download, or undefined if not found
   */
  public getByDownloadId(downloadId: string): TrackedDownload | undefined {
    const trackedId = this.downloadIdIndex.get(downloadId);
    if (!trackedId) {
      return undefined;
    }
    return this.downloads.get(trackedId);
  }

  /**
   * Get all tracked downloads for a specific manga
   *
   * @param mangaId - Manga ID to filter by
   * @returns Array of tracked downloads for that manga
   */
  public getByMangaId(mangaId: number): TrackedDownload[] {
    return [...this.downloads.values()].filter(d => d.mangaId === mangaId);
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Create a new tracked download and add it to the cache.
   *
   * @param params - Parameters for the new tracked download
   * @returns The newly created tracked download
   */
  public create(params: CreateTrackedDownloadParams): TrackedDownload {
    const id = `job:${params.jobId}`;

    // Check for duplicates
    if (this.downloads.has(id)) {
      logger.warn('[TrackedDownloadService] Duplicate tracked download, replacing', {
        id,
        downloadId: params.downloadId,
      });
      this.removeInternal(id);
    }

    const now = new Date();
    const download: TrackedDownload = {
      id,
      state: TrackedDownloadState.QUEUED,
      previousState: TrackedDownloadState.QUEUED,
      downloadId: params.downloadId,
      clientType: params.clientType,
      mode: params.mode,
      mangaId: params.mangaId,
      mangaTitle: params.mangaTitle,
      releaseTitle: params.releaseTitle,
      chapterIds: params.chapterIds,
      jobId: params.jobId,
      packDownloadId: params.packDownloadId ?? null,
      progress: 0,
      downloadSpeed: 0,
      seeders: null,
      errorMessage: null,
      attemptCount: 0,
      stateChangedAt: now,
      createdAt: now,
    };

    this.downloads.set(id, download);
    this.downloadIdIndex.set(params.downloadId, id);

    logger.info('[TrackedDownloadService] Created tracked download', {
      id,
      downloadId: params.downloadId,
      mangaId: params.mangaId,
      mode: params.mode,
      releaseTitle: params.releaseTitle,
    });

    return download;
  }

  /**
   * Transition the state of a tracked download.
   *
   * Validates the transition, updates the cache, and emits a WebSocket event.
   *
   * @param id - Tracked download ID
   * @param event - The event triggering the transition
   * @param errorMessage - Optional error message (for failure transitions)
   * @returns TransitionResult indicating success or failure
   */
  public transitionState(
    id: string,
    event: TrackedDownloadEvent,
    errorMessage?: string,
  ): TransitionResult {
    const download = this.downloads.get(id);

    if (!download) {
      return {
        success: false,
        previousState: TrackedDownloadState.QUEUED,
        newState: TrackedDownloadState.QUEUED,
        error: `Tracked download not found: ${id}`,
      };
    }

    const result = transition(download.state, event);

    if (!result.success) {
      logger.warn('[TrackedDownloadService] Invalid state transition', {
        id,
        currentState: download.state,
        event,
        error: result.error,
        validEvents: getValidEvents(download.state),
      });
      return result;
    }

    // Update the download
    const previousState = download.state;
    download.previousState = previousState;
    download.state = result.newState;
    download.stateChangedAt = new Date();

    if (errorMessage !== undefined) {
      download.errorMessage = errorMessage;
    }

    // Track retry attempts
    if (event === TrackedDownloadEvent.RETRY_STARTED || event === TrackedDownloadEvent.RETRY_IMPORT) {
      download.attemptCount += 1;
    }

    logger.info('[TrackedDownloadService] State transition', {
      id,
      previousState,
      newState: result.newState,
      event,
      attemptCount: download.attemptCount,
    });

    // Emit WebSocket event (fire and forget)
    void this.emitStateChange(download, previousState);

    return result;
  }

  /**
   * Update progress metrics for a tracked download.
   *
   * @param id - Tracked download ID
   * @param progress - Download progress percentage (0-100)
   * @param speed - Download speed in bytes/sec
   * @param seeders - Number of seeders (if available)
   */
  public updateProgress(
    id: string,
    progress: number,
    speed: number,
    seeders: number | null,
  ): void {
    const download = this.downloads.get(id);
    if (!download) {
      logger.debug('[TrackedDownloadService] Cannot update progress for unknown download', { id });
      return;
    }

    download.progress = Math.min(100, Math.max(0, progress));
    download.downloadSpeed = speed;
    download.seeders = seeders;
  }

  /**
   * Remove a tracked download from the cache.
   *
   * @param id - Tracked download ID to remove
   */
  public remove(id: string): void {
    const removed = this.removeInternal(id);
    if (removed) {
      logger.info('[TrackedDownloadService] Removed tracked download', { id });
    } else {
      logger.debug('[TrackedDownloadService] Attempted to remove unknown download', { id });
    }
  }

  /**
   * Check whether a transition is valid for a tracked download.
   *
   * @param id - Tracked download ID
   * @param event - The event to check
   * @returns True if the transition is valid, false otherwise
   */
  public canTransition(id: string, event: TrackedDownloadEvent): boolean {
    const download = this.downloads.get(id);
    if (!download) {
      return false;
    }
    return canTransition(download.state, event);
  }

  /**
   * Check whether a tracked download is in a terminal state.
   *
   * @param id - Tracked download ID
   * @returns True if in a terminal state, false if not found or still active
   */
  public isTerminal(id: string): boolean {
    const download = this.downloads.get(id);
    if (!download) {
      return false;
    }
    return isTerminalState(download.state);
  }

  /**
   * Bulk-load tracked downloads into the cache (used for hydration from DB).
   *
   * @param downloads - Array of tracked downloads to load
   */
  public loadAll(downloads: TrackedDownload[]): void {
    for (const download of downloads) {
      this.downloads.set(download.id, download);
      this.downloadIdIndex.set(download.downloadId, download.id);
    }
    logger.info('[TrackedDownloadService] Loaded tracked downloads from database', {
      count: downloads.length,
    });
  }

  /**
   * Get the number of tracked downloads in the cache.
   *
   * @returns Count of tracked downloads
   */
  public get size(): number {
    return this.downloads.size;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Remove a download from both indexes.
   *
   * @param id - Tracked download ID
   * @returns True if a download was removed
   */
  private removeInternal(id: string): boolean {
    const download = this.downloads.get(id);
    if (!download) {
      return false;
    }

    this.downloadIdIndex.delete(download.downloadId);
    this.downloads.delete(id);
    return true;
  }

  /**
   * Emit a WebSocket event for a state change.
   *
   * @param download - The tracked download that changed
   * @param previousState - The state before the transition
   */
  private async emitStateChange(
    download: TrackedDownload,
    previousState: TrackedDownloadState,
  ): Promise<void> {
    await realtimeEmitter.emitTrackedDownloadState({
      id: download.id,
      previousState,
      newState: download.state,
      downloadId: download.downloadId,
      mangaId: download.mangaId,
      releaseTitle: download.releaseTitle,
      progress: download.progress,
      errorMessage: download.errorMessage,
    });
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const trackedDownloadService = TrackedDownloadService.getInstance();

export { TrackedDownloadService };
