/**
 * Real-Time Event Emitter Service
 *
 * Provides a simple API for services to emit events to WebSocket clients.
 * Handles both local broadcasting and cross-server routing.
 *
 * Usage:
 * ```typescript
 * import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
 *
 * // Emit job update
 * realtimeEmitter.emitJobUpdate({
 *   jobId: '123',
 *   status: 'completed',
 *   progress: 100,
 * });
 *
 * // Emit download progress
 * realtimeEmitter.emitDownloadProgress({
 *   taskId: 'task-456',
 *   mangaId: 1,
 *   progress: 50,
 * });
 * ```
 *
 * @module server/services/realtime/RealtimeEventEmitter
 */

import { websocketService } from '@/server/api/services/websocket-service';
import { getRouter } from '@/server/realtime/DistributedMessageRouter';
import { CHANNEL_PATTERNS, type WebSocketEvent } from '@/types/api/v1/websocket';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface JobUpdatePayload {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  result?: unknown;
  error?: string;
  jobType?: string;
  metadata?: Record<string, unknown>;
  /** Initiating user — scopes the live event to them (+admins). null/undefined = system job. */
  targetUserId?: string | null | undefined;
}

export interface DownloadProgressPayload {
  taskId: string;
  mangaId: number | string;
  chapterId?: number | string;
  progress: number;
  speed?: number;
  eta?: number;
  status: 'queued' | 'downloading' | 'importing' | 'completed' | 'failed' | 'paused';
  filename?: string;
  /** Initiating user — scopes the live event to them (+admins). */
  targetUserId?: string | null | undefined;
}

export interface NotificationPayload {
  id?: string;
  title: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp?: string;
  action?: {
    label: string;
    url?: string;
    onClick?: string;
  };
}

export interface LibraryScanPayload {
  libraryId: number;
  progress: number;
  status: 'started' | 'scanning' | 'processing' | 'completed' | 'failed';
  currentFile?: string | undefined;
  totalFiles?: number | undefined;
  processedFiles?: number | undefined;
  error?: string | undefined;
}

export interface MangaUpdatePayload {
  mangaId: number;
  action: 'created' | 'updated' | 'deleted' | 'metadata_updated' | 'chapters_updated';
  data?: Record<string, unknown>;
}

export interface ChapterUpdatePayload {
  chapterId: number;
  mangaId: number;
  action: 'created' | 'updated' | 'deleted' | 'read' | 'unread' | 'downloaded' | 'failed';
  data?: Record<string, unknown>;
}

export interface SystemStatusPayload {
  status: 'healthy' | 'degraded' | 'maintenance' | 'error';
  uptime?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  activeJobs?: number;
  queuedJobs?: number;
  message?: string;
}

export interface VolumeSplitProgressPayload {
  operationId: string;
  stage: 'initializing' | 'extracting_images' | 'detecting_chapters' |
         'calculating_confidence' | 'creating_chapters' | 'complete' | 'error';
  percentComplete: number;
  currentChapter?: number;
  totalChapters?: number;
  totalImages?: number;
  volumePath?: string;
  errorMessage?: string;
}

export interface BackupOperationPayload {
  backupId?: number | undefined;
  operation: 'created' | 'deleted' | 'restored' | 'scheduled' | 'started' | 'completed' | 'failed';
  name?: string | undefined;
  progress?: number | undefined;
  error?: string | undefined;
}

export interface ImportProgressPayload {
  mangaId?: number | undefined;
  mangaTitle?: string | undefined;
  operation: 'started' | 'progress' | 'completed' | 'failed';
  filesImported?: number | undefined;
  totalFiles?: number | undefined;
  currentFile?: string | undefined;
  progress?: number | undefined;
  error?: string | undefined;
  // Pack import specific fields
  packDownloadId?: number | undefined;
  chaptersCreated?: number | undefined;
  chapterIds?: number[] | undefined;
  status?: string | undefined;
}

export interface CalendarSyncPayload {
  operation: 'started' | 'progress' | 'completed' | 'failed' | 'cleanup';
  mangaCount?: number | undefined;
  eventsReconciled?: number | undefined;
  eventsCleanedUp?: number | undefined;
  error?: string | undefined;
}

export interface ReadingProgressPayload {
  chapterId: number;
  mangaId: number;
  progress: number;
  pagesRead?: number | undefined;
  totalPages?: number | undefined;
}

export interface BookmarkPayload {
  id: number;
  type: 'volume' | 'manga' | 'reader';
  action: 'created' | 'deleted' | 'toggled';
  entityId: number;
  mangaId?: number | undefined;
}

export interface SystemEventPayload {
  eventType: string;
  source: string;
  message: string;
  data?: Record<string, unknown> | undefined;
}

export interface ReleaseDetectionPayload {
  mangaId: number;
  mangaTitle: string;
  newChapters?: number | undefined;
  detectedAt: string;
}

export interface ConversionJobPayload {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number | undefined;
  inputFile?: string | undefined;
  outputFile?: string | undefined;
  error?: string | undefined;
}

export type SearchSource = 'mangadex' | 'suwayomi' | 'prowlarr' | 'getcomics';

export interface SearchProgressPayload {
  mangaId: number;
  /** Display-only; not used for routing. Optional so deep callers
   *  (e.g. `runUnifiedReleaseSearch`) can emit without an extra DB hit. */
  mangaTitle?: string | undefined;
  /** `dispatching` covers the post-indexer-search window — scoring,
   *  in-flight checks, native enqueue, Prowlarr manual iteration — which
   *  used to freeze the toast for many seconds on bulk runs. */
  phase: 'searching' | 'source-result' | 'dispatching' | 'complete' | 'error';
  message: string;
  /** Set on phase='searching' to declare the enabled+mediaType-gated source list. */
  sources?: SearchSource[] | undefined;
  /** Set on phase='source-result' to identify which source just settled. */
  source?: SearchSource | undefined;
  /** Set on phase='source-result' alongside `source` to convey the adapter outcome. */
  status?: 'ok' | 'timeout' | 'error' | undefined;
  resultCount?: number | undefined;
  startedCount?: number | undefined;
  totalCount?: number | undefined;
  errorDetails?: Array<{ searchQuery: string; errorMessage: string; statusCode?: number | undefined }> | undefined;
  failedQueryCount?: number | undefined;
  totalQueryCount?: number | undefined;
}

export type MetadataRefreshPhase =
  | 'starting'
  | 'fetching_providers'
  | 'enriching_metadata'
  | 'persisting_data'
  | 'reconciling_chapters'
  | 'validating_volumes'
  | 'ai_agent_remediation'
  | 'ai_agent_model_loading'
  | 'ai_agent_merging'
  | 'fandom_enrichment'
  | 'fandom_chapters'
  | 'fandom_scraping'
  | 'wikipedia_enrichment'
  | 'comicvine_scraping'
  | 'applying_data'
  | 'rebuilding_chapters'
  | 'completed'
  | 'error';

export interface MetadataRefreshProgressPayload {
  mangaId: number;
  phase: MetadataRefreshPhase;
  phaseIndex: number;
  totalPhases: number;
  message: string;
  error?: string | undefined;
}

export interface TrackedDownloadStatePayload {
  id: string;
  previousState: string;
  newState: string;
  downloadId: string;
  mangaId: number;
  releaseTitle: string;
  progress: number;
  errorMessage: string | null;
}

// ============================================================================
// Event Emitter Class
// ============================================================================

class RealtimeEventEmitter {
  private static instance: RealtimeEventEmitter | undefined;

  private constructor() {
    logger.info('RealtimeEventEmitter initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RealtimeEventEmitter {
    RealtimeEventEmitter.instance ??= new RealtimeEventEmitter();
    return RealtimeEventEmitter.instance;
  }

  // ==========================================================================
  // Core Emit Method
  // ==========================================================================

  /**
   * Emit an event to a channel
   *
   * @param channel - Channel name (e.g., 'jobs:active', 'downloads:progress')
   * @param type - Event type (e.g., 'job:updated', 'download:progress')
   * @param data - Event payload
   */
  public async emit(channel: string, type: string, data: unknown, targetUserId?: string | null): Promise<void> {
    try {
      const event: WebSocketEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type,
        channel,
        data,
        timestamp: new Date().toISOString(),
        // Scope user-private events to the initiating user (+admins) at the
        // delivery layer (message-router). Absent = global broadcast.
        ...(typeof targetUserId === 'string' ? { targetUserId } : {}),
      };

      // Broadcast locally
      await websocketService.broadcastToChannel(channel, event);

      // Route to other servers
      const router = getRouter();
      if (router) {
        await router.routeMessage(channel, event as unknown as Record<string, unknown>);
      }

      logger.debug('Event emitted', { channel, type, eventId: event.id });
    } catch (error) {
      logger.error('Failed to emit event', {
        error: error instanceof Error ? error.message : String(error),
        channel,
        type,
      });
    }
  }

  // ==========================================================================
  // Job Events
  // ==========================================================================

  /**
   * Emit job update event
   */
  public async emitJobUpdate(payload: JobUpdatePayload): Promise<void> {
    const t = payload.targetUserId;
    // Emit to specific job channel
    await this.emit(`jobs:${payload.jobId}`, 'job:updated', payload, t);

    // Also emit to wildcard channel for listeners subscribed to all job updates
    await this.emit('jobs:active', 'job:updated', payload, t);

    // Emit status-specific events
    if (payload.status === 'completed') {
      await this.emit('jobs:completed', 'job:completed', payload, t);
    } else if (payload.status === 'failed') {
      await this.emit('jobs:failed', 'job:failed', payload, t);
    }
  }

  /**
   * Emit job created event
   */
  public async emitJobCreated(payload: JobUpdatePayload): Promise<void> {
    await this.emit('jobs:active', 'job:created', payload, payload.targetUserId);
    await this.emit('jobs:queued', 'job:queued', payload, payload.targetUserId);
  }

  /**
   * Emit job progress event
   */
  public async emitJobProgress(jobId: string, progress: number, metadata?: Record<string, unknown>, targetUserId?: string | null): Promise<void> {
    await this.emit(`jobs:${jobId}`, 'job:progress', {
      jobId,
      progress,
      ...metadata,
    }, targetUserId);
  }

  // ==========================================================================
  // Download Events
  // ==========================================================================

  /**
   * Emit download progress event
   */
  public async emitDownloadProgress(payload: DownloadProgressPayload): Promise<void> {
    await this.emit(CHANNEL_PATTERNS.DOWNLOAD_PROGRESS, 'download:progress', payload, payload.targetUserId);

    // Also emit to manga-specific channel
    await this.emit(
      CHANNEL_PATTERNS.MANGA_UPDATES(Number(payload.mangaId)),
      'download:progress',
      payload,
      payload.targetUserId
    );
  }

  /**
   * Emit download started event
   */
  public async emitDownloadStarted(payload: DownloadProgressPayload): Promise<void> {
    await this.emit(CHANNEL_PATTERNS.DOWNLOAD_PROGRESS, 'download:started', payload, payload.targetUserId);
  }

  /**
   * Emit download completed event
   */
  public async emitDownloadCompleted(payload: DownloadProgressPayload): Promise<void> {
    await this.emit(CHANNEL_PATTERNS.DOWNLOAD_PROGRESS, 'download:completed', {
      ...payload,
      status: 'completed',
      progress: 100,
    }, payload.targetUserId);
  }

  /**
   * Emit download failed event
   */
  public async emitDownloadFailed(
    payload: DownloadProgressPayload,
    error: string
  ): Promise<void> {
    await this.emit(CHANNEL_PATTERNS.DOWNLOAD_PROGRESS, 'download:failed', {
      ...payload,
      status: 'failed',
      error,
    }, payload.targetUserId);
  }

  // ==========================================================================
  // Notification Events
  // ==========================================================================

  /**
   * Emit system notification
   */
  public async emitNotification(payload: NotificationPayload): Promise<void> {
    await this.emit(CHANNEL_PATTERNS.SYSTEM_NOTIFICATIONS, 'notification', {
      ...payload,
      id: payload.id ?? `notif_${Date.now()}`,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }

  /**
   * Emit user-specific notification
   */
  public async emitUserNotification(
    userId: string,
    payload: NotificationPayload
  ): Promise<void> {
    await this.emit(CHANNEL_PATTERNS.USER_NOTIFICATIONS(userId), 'notification', {
      ...payload,
      id: payload.id ?? `notif_${Date.now()}`,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }

  // ==========================================================================
  // Library Events
  // ==========================================================================

  /**
   * Emit library scan progress
   */
  public async emitLibraryScanProgress(payload: LibraryScanPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.LIBRARY_UPDATES(payload.libraryId),
      'library:scan:progress',
      payload
    );

    // Also emit to general library channel
    await this.emit('library:scan', 'library:scan:progress', payload);
  }

  /**
   * Emit library scan started
   */
  public async emitLibraryScanStarted(libraryId: number, totalFiles?: number): Promise<void> {
    await this.emitLibraryScanProgress({
      libraryId,
      progress: 0,
      status: 'started',
      totalFiles,
    });
  }

  /**
   * Emit library scan completed
   */
  public async emitLibraryScanCompleted(
    libraryId: number,
    processedFiles: number
  ): Promise<void> {
    await this.emitLibraryScanProgress({
      libraryId,
      progress: 100,
      status: 'completed',
      processedFiles,
    });
  }

  // ==========================================================================
  // Manga Events
  // ==========================================================================

  /**
   * Emit manga update
   */
  public async emitMangaUpdate(payload: MangaUpdatePayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.MANGA_UPDATES(payload.mangaId),
      `manga:${payload.action}`,
      payload
    );

    // Also emit to general manga channel
    await this.emit('manga:updates', `manga:${payload.action}`, payload);
  }

  /**
   * Emit chapter update
   */
  public async emitChapterUpdate(payload: ChapterUpdatePayload): Promise<void> {
    const eventName = `chapter:${payload.action}`;
    await this.emit(CHANNEL_PATTERNS.MANGA_CHAPTERS(payload.mangaId), eventName, payload);
    await this.emit(CHANNEL_PATTERNS.MANGA_UPDATES(payload.mangaId), eventName, payload);
    // iter-LIVEBAR: library-wide fan-out for the progress-bar invalidation.
    await this.emit(CHANNEL_PATTERNS.LIBRARY_CHAPTER_UPDATES, eventName,
      { mangaId: payload.mangaId, action: payload.action });
  }

  // ==========================================================================
  // System Events
  // ==========================================================================

  /**
   * Emit system status update
   */
  public async emitSystemStatus(payload: SystemStatusPayload): Promise<void> {
    await this.emit('system:status', 'system:status', payload);
  }

  /**
   * Emit system maintenance notification
   */
  public async emitMaintenanceMode(enabled: boolean, message?: string): Promise<void> {
    await this.emit('system:status', 'system:maintenance', {
      enabled,
      message,
      timestamp: new Date().toISOString(),
    });

    // Also emit as notification
    await this.emitNotification({
      title: enabled ? 'Maintenance Mode' : 'Maintenance Complete',
      message: message ?? (enabled ? 'System is entering maintenance mode' : 'System is back online'),
      level: enabled ? 'warning' : 'info',
    });
  }

  // ==========================================================================
  // Volume Split Events
  // ==========================================================================

  /**
   * Emit volume split progress
   */
  public async emitVolumeSplitProgress(payload: VolumeSplitProgressPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.VOLUME_SPLIT_PROGRESS,
      'volume-split:progress',
      payload
    );
  }

  // ==========================================================================
  // Backup Events
  // ==========================================================================

  /**
   * Emit backup operation event
   */
  public async emitBackupOperation(payload: BackupOperationPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.BACKUP_OPERATIONS,
      `backup:${payload.operation}`,
      payload
    );

    // Also emit as notification for important events
    if (payload.operation === 'completed' || payload.operation === 'failed') {
      await this.emitNotification({
        title: payload.operation === 'completed' ? 'Backup Complete' : 'Backup Failed',
        message: payload.operation === 'completed'
          ? `Backup "${payload.name ?? 'System'}" completed successfully`
          : `Backup failed: ${payload.error ?? 'Unknown error'}`,
        level: payload.operation === 'completed' ? 'success' : 'error',
      });
    }
  }

  // ==========================================================================
  // Import Events
  // ==========================================================================

  /**
   * Emit import progress event
   */
  public async emitImportProgress(payload: ImportProgressPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.IMPORT_PROGRESS,
      `import:${payload.operation}`,
      payload
    );

    // Also emit to manga-specific channel if mangaId is provided
    if (payload.mangaId !== undefined) {
      await this.emit(
        CHANNEL_PATTERNS.MANGA_UPDATES(payload.mangaId),
        `import:${payload.operation}`,
        payload
      );
    }
  }

  // ==========================================================================
  // Calendar Events
  // ==========================================================================

  /**
   * Emit calendar sync event
   */
  public async emitCalendarSync(payload: CalendarSyncPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.CALENDAR_SYNC,
      `calendar:${payload.operation}`,
      payload
    );
  }

  // ==========================================================================
  // Reading Progress Events
  // ==========================================================================

  /**
   * Emit reading progress event
   */
  public async emitReadingProgress(payload: ReadingProgressPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.READING_PROGRESS,
      'reading:progress',
      payload
    );

    // Also emit to manga-specific channel
    await this.emit(
      CHANNEL_PATTERNS.MANGA_UPDATES(payload.mangaId),
      'reading:progress',
      payload
    );
  }

  // ==========================================================================
  // Bookmark Events
  // ==========================================================================

  /**
   * Emit bookmark change event
   */
  public async emitBookmarkChange(payload: BookmarkPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.READER_BOOKMARKS,
      `bookmark:${payload.action}`,
      payload
    );

    // Also emit to manga-specific channel if mangaId is provided
    if (payload.mangaId) {
      await this.emit(
        CHANNEL_PATTERNS.MANGA_UPDATES(payload.mangaId),
        `bookmark:${payload.action}`,
        payload
      );
    }
  }

  // ==========================================================================
  // System Events
  // ==========================================================================

  /**
   * Emit system event (for activity logging)
   */
  public async emitSystemEvent(payload: SystemEventPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.SYSTEM_EVENTS,
      `system:${payload.eventType}`,
      payload
    );
  }

  // ==========================================================================
  // Release Detection Events
  // ==========================================================================

  /**
   * Emit release detection event
   */
  public async emitReleaseDetected(payload: ReleaseDetectionPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.RELEASES_DETECTED,
      'release:detected',
      payload
    );

    // Also emit to manga-specific channel
    await this.emit(
      CHANNEL_PATTERNS.MANGA_UPDATES(payload.mangaId),
      'release:detected',
      payload
    );

    // Emit notification
    await this.emitNotification({
      title: 'New Release Detected',
      message: `New chapters available for ${payload.mangaTitle}`,
      level: 'info',
    });
  }

  // ==========================================================================
  // Conversion Job Events
  // ==========================================================================

  /**
   * Emit conversion job event
   */
  public async emitConversionJob(payload: ConversionJobPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.JOBS_CONVERSION,
      `conversion:${payload.status}`,
      payload
    );

    // Also emit to general jobs channel
    await this.emit('jobs:active', `conversion:${payload.status}`, payload);
  }

  // ==========================================================================
  // Sync Job Events
  // ==========================================================================

  /**
   * Emit sync job event
   */
  public async emitSyncJob(jobId: string, status: string, data?: Record<string, unknown>): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.JOBS_SYNC,
      `sync:${status}`,
      { jobId, status, ...data }
    );
  }

  // ==========================================================================
  // Scheduled Job Events
  // ==========================================================================

  /**
   * Emit scheduled job event
   */
  public async emitScheduledJob(jobId: string, status: string, data?: Record<string, unknown>): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.JOBS_SCHEDULED,
      `scheduled:${status}`,
      { jobId, status, ...data }
    );
  }

  // ==========================================================================
  // FlareSolverr Metrics Events
  // ==========================================================================

  /**
   * Emit FlareSolverr metrics update for real-time monitoring
   */
  public async emitFlareSolverrMetrics(payload: {
    timestamp: string;
    healthy: boolean;
    responseTimeMs?: number;
    sessionCount: number;
    requestType?: string;
    success?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.FLARESOLVERR_METRICS,
      'flaresolverr:metrics',
      payload
    );
  }

  // ==========================================================================
  // Metadata Refresh Events
  // ==========================================================================

  /**
   * Emit metadata refresh progress for a manga
   */
  public async emitMetadataRefreshProgress(payload: MetadataRefreshProgressPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.METADATA_REFRESH_PROGRESS(payload.mangaId),
      'metadata-refresh:progress',
      payload
    );
  }

  // ==========================================================================
  // Search Progress Events
  // ==========================================================================

  /**
   * Emit search progress event for the unified auto-search fan-out
   * (Prowlarr + MangaDex + Suwayomi + GetComics, mediaType-gated).
   */
  public async emitSearchProgress(payload: SearchProgressPayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.SEARCH_PROGRESS,
      `search:${payload.phase}`,
      payload
    );
  }

  // ==========================================================================
  // Tracked Download Events
  // ==========================================================================

  /**
   * Emit tracked download state change event
   */
  public async emitTrackedDownloadState(payload: TrackedDownloadStatePayload): Promise<void> {
    await this.emit(
      CHANNEL_PATTERNS.TRACKED_DOWNLOADS,
      'tracked-download:state-changed',
      payload
    );
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const realtimeEmitter = RealtimeEventEmitter.getInstance();

// Also export the class for testing
export { RealtimeEventEmitter };
