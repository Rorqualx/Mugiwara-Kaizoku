/**
 * Native Download Notifications Module
 *
 * Notification helper functions for native download events.
 * Provides structured logging and WebSocket emissions for all download operations.
 */

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/utils/logger';

// ============================================================================
// Notification Helpers
// ============================================================================

/**
 * Native download event notification helpers
 *
 * Provides consistent structured logging for all native download operations
 * including source initialization, validation, downloads, and errors.
 */
export const nativeDownloadNotifications = {
    sourceInitialized: (sourceName: string, sourceId: string): void => {
        logger.info(`[NativeDownload] Source initialized: ${sourceName} (${sourceId})`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:source:initialized',
            source: 'native-download-notifications',
            message: `Source initialized: ${sourceName}`,
            data: { sourceName, sourceId }
        });
    },

    sourceValidationStarted: (sourceName: string): void => {
        logger.info(`[NativeDownload] Source validation started: ${sourceName}`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:source:validation:started',
            source: 'native-download-notifications',
            message: `Source validation started: ${sourceName}`,
            data: { sourceName }
        });
    },

    sourceValidationCompleted: (sourceName: string): void => {
        logger.info(`[NativeDownload] Source validation completed: ${sourceName}`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:source:validation:completed',
            source: 'native-download-notifications',
            message: `Source validation completed: ${sourceName}`,
            data: { sourceName }
        });
    },

    sourceValidationFailed: (sourceName: string, error: string): void => {
        logger.error(`[NativeDownload] Source validation failed: ${sourceName} - ${error}`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:source:validation:failed',
            source: 'native-download-notifications',
            message: `Source validation failed: ${sourceName}`,
            data: { sourceName, error }
        });
    },

    sourceError: (sourceName: string, sourceId: string, error: string): void => {
        logger.error(`[NativeDownload] Source error: ${sourceName} (${sourceId}) - ${error}`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:source:error',
            source: 'native-download-notifications',
            message: `Source error: ${sourceName}`,
            data: { sourceName, sourceId, error }
        });
    },

    downloadQueued: (chapterTitle: string, chapterId: string): void => {
        logger.info(`[NativeDownload] Download queued: ${chapterTitle} (${chapterId})`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:download:queued',
            source: 'native-download-notifications',
            message: `Download queued: ${chapterTitle}`,
            data: { chapterTitle, chapterId }
        });
    },

    downloadStarted: (chapterTitle: string, sourceName: string, downloadId: string): void => {
        logger.info(`[NativeDownload] Download started: ${chapterTitle} from ${sourceName} (${downloadId})`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:download:started',
            source: 'native-download-notifications',
            message: `Download started: ${chapterTitle} from ${sourceName}`,
            data: { chapterTitle, sourceName, downloadId }
        });
    },

    downloadProgress: (downloadId: string, progress: number, chapterId: string): void => {
        logger.debug(`[NativeDownload] Download progress: ${progress}% for ${chapterId} (${downloadId})`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:download:progress',
            source: 'native-download-notifications',
            message: `Download progress: ${progress}%`,
            data: { downloadId, progress, chapterId }
        });
    },

    downloadCompleted: (chapterTitle: string, downloadId: string): void => {
        logger.info(`[NativeDownload] Download completed: ${chapterTitle} (${downloadId})`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:download:completed',
            source: 'native-download-notifications',
            message: `Download completed: ${chapterTitle}`,
            data: { chapterTitle, downloadId }
        });
    },

    downloadFailed: (chapterTitle: string, downloadId: string, chapterId: string, error: string): void => {
        logger.error(`[NativeDownload] Download failed: ${chapterTitle} (${downloadId}) - ${error}`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:download:failed',
            source: 'native-download-notifications',
            message: `Download failed: ${chapterTitle}`,
            data: { chapterTitle, downloadId, chapterId, error }
        });
    },

    managerInitialized: (adapterCount: number): void => {
        logger.info(`[NativeDownload] Manager initialized with ${adapterCount} adapters`);
        void realtimeEmitter.emitSystemEvent({
            eventType: 'nativeDownload:manager:initialized',
            source: 'native-download-notifications',
            message: `Native download manager initialized with ${adapterCount} adapters`,
            data: { adapterCount }
        });
    }
} as const;

// Backward compatibility alias
/** @deprecated Use nativeDownloadNotifications instead */
export const nativeDownloadNotificationsAlias = nativeDownloadNotifications;
