/**
 * Realtime Bridge Handler
 *
 * Bridges pipeline events to the WebSocket layer (RealtimeEventEmitter).
 * Listens to pipeline events and forwards relevant data to connected
 * WebSocket clients for real-time UI updates.
 *
 * This is a one-way bridge: pipeline -> WebSocket.
 * Pipeline events are internal; WebSocket events are client-facing.
 *
 * @module server/services/pipeline/handlers/realtime-bridge-handler
 */

import { pipelineEventBus } from '@/server/services/pipeline/pipeline-event-bus';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { PIPELINE_EVENTS } from '@/types/domain/pipeline-events';
import { logger } from '@/utils/logger';

const TAG = '[RealtimeBridge]';

/**
 * Register handlers that forward pipeline events to WebSocket clients
 */
export function registerRealtimeBridgeHandler(): void {
  // Forward download progress events
  pipelineEventBus.on(PIPELINE_EVENTS.DOWNLOAD_GRABBED, (event) => {
    void realtimeEmitter.emitDownloadProgress({
      taskId: event.downloadId,
      mangaId: event.mangaId,
      progress: 0,
      status: 'queued',
      filename: event.releaseTitle,
    });
  });

  // Forward download completion
  pipelineEventBus.on(PIPELINE_EVENTS.DOWNLOAD_COMPLETED, (event) => {
    void realtimeEmitter.emitDownloadProgress({
      taskId: event.downloadId,
      mangaId: event.mangaId,
      progress: 100,
      status: 'completed',
    });
  });

  // Forward download failure
  pipelineEventBus.on(PIPELINE_EVENTS.DOWNLOAD_FAILED, (event) => {
    void realtimeEmitter.emitDownloadProgress({
      taskId: event.downloadId,
      mangaId: event.mangaId,
      progress: 0,
      status: 'failed',
    });
  });

  // Forward import events
  pipelineEventBus.on(PIPELINE_EVENTS.IMPORT_COMPLETED, (event) => {
    void realtimeEmitter.emitImportProgress({
      operation: 'completed',
      mangaId: event.mangaId,
      packDownloadId: event.packDownloadId,
      chaptersCreated: event.chaptersCreated,
      chapterIds: event.chapterIds,
    });
  });

  pipelineEventBus.on(PIPELINE_EVENTS.IMPORT_FAILED, (event) => {
    void realtimeEmitter.emitImportProgress({
      operation: 'failed',
      mangaId: event.mangaId,
      packDownloadId: event.packDownloadId,
      error: event.error,
    });
  });

  pipelineEventBus.on(PIPELINE_EVENTS.IMPORT_STARTED, (event) => {
    void realtimeEmitter.emitImportProgress({
      operation: 'started',
      mangaId: event.mangaId,
      packDownloadId: event.packDownloadId,
    });
  });

  // Forward search failure events
  pipelineEventBus.on(PIPELINE_EVENTS.SEARCH_FAILED, (event) => {
    void realtimeEmitter.emitSearchProgress({
      mangaId: event.mangaId,
      mangaTitle: event.mangaTitle,
      phase: 'error',
      message: `${event.mangaTitle}: ${event.failedQueries} search queries failed`,
      errorDetails: event.errors,
      failedQueryCount: event.failedQueries,
      totalQueryCount: event.totalQueries,
    });
  });

  logger.debug(`${TAG} Realtime bridge handlers registered`);
}
