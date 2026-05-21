/**
 * Event Logger
 *
 * A utility for logging system events from server-side code.
 * This provides a simplified interface for creating events across the application.
 *
 * @module server/services/events/eventLogger
 */
import { logger } from '@/utils/logger';

import { eventService } from './eventService';
import { EventType, EventSource, EventTypeToLevel } from './eventTypes';

import type { JsonValue } from './eventService';
/**
 * Class that provides convenient methods for logging different types of events
 */
export class EventLogger {
    /**
     * Logs a system event
     *
     * @param {EventType} type - Type of event
     * @param {EventSource} source - Source of the event
     * @param {string} message - Human-readable message
     * @param {Object} [options] - Additional event options
     * @returns {Promise<void>}
     */
    async logEvent(type: EventType, source: EventSource, message: string, options?: {
        details?: Record<string, JsonValue>;
        relatedEntityId?: string;
        relatedEntityType?: string;
    }): Promise<void> {
        // Get the appropriate level for this event type
        const level = EventTypeToLevel[type];
        try {
            await eventService.createEvent(type, source, level, message, options);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Failed to log event to database:', errorMessage);
            logger.info(`[${level}] ${source} (${type}): ${message}`);
        }
    }
    /**
     * Logs a library-related event
     *
     * @param {EventType} type - Library event type
     * @param {string} message - Event message
     * @param {Object} [options] - Additional event options
     * @returns {Promise<void>}
     */
    async logLibraryEvent(type: EventType, message: string, options?: {
        details?: Record<string, JsonValue>;
        libraryId?: string;
        libraryName?: string;
    }): Promise<void> {
        const eventOptions: {
            details?: Record<string, JsonValue>;
            relatedEntityId?: string;
            relatedEntityType?: string;
        } = {
            relatedEntityType: 'library'
        };
        if (options?.details) {
            eventOptions.details = options.details;
        }
        if (options?.libraryId) {
            eventOptions.relatedEntityId = options.libraryId;
        }
        await this.logEvent(type, EventSource.LIBRARY, message, eventOptions);
    }
    /**
     * Logs a manga-related event
     *
     * @param {EventType} type - Manga event type
     * @param {string} message - Event message
     * @param {Object} [options] - Additional event options
     * @returns {Promise<void>}
     */
    async logMangaEvent(type: EventType, message: string, options?: {
        details?: Record<string, JsonValue>;
        mangaId?: string;
        mangaTitle?: string;
    }): Promise<void> {
        const eventOptions: {
            details?: Record<string, JsonValue>;
            relatedEntityId?: string;
            relatedEntityType?: string;
        } = {
            relatedEntityType: 'manga'
        };
        const details: Record<string, JsonValue> = {
            ...options?.details,
            mangaTitle: options?.mangaTitle ?? null
        };
        eventOptions.details = details;
        if (options?.mangaId) {
            eventOptions.relatedEntityId = options.mangaId;
        }
        await this.logEvent(type, EventSource.MANGA, message, eventOptions);
    }
    /**
     * Logs a download-related event
     *
     * @param {EventType} type - Download event type
     * @param {string} message - Event message
     * @param {Object} [options] - Additional event options
     * @returns {Promise<void>}
     */
    async logDownloadEvent(type: EventType, message: string, options?: {
        details?: Record<string, JsonValue>;
        mangaId?: string;
        chapterId?: string;
        mangaTitle?: string;
        chapterTitle?: string;
    }): Promise<void> {
        const eventOptions: {
            details?: Record<string, JsonValue>;
            relatedEntityId?: string;
            relatedEntityType?: string;
        } = {};
        const details: Record<string, JsonValue> = {
            ...options?.details,
            ...(options?.mangaTitle !== undefined ? { mangaTitle: options.mangaTitle } : {}),
            chapterTitle: options?.chapterTitle ?? null
        };
        eventOptions.details = details;
        const relatedId = options?.chapterId ?? options?.mangaId;
        if (relatedId) {
            eventOptions.relatedEntityId = relatedId;
            eventOptions.relatedEntityType = options?.chapterId ? 'chapter' : 'manga';
        }
        await this.logEvent(type, EventSource.DOWNLOAD, message, eventOptions);
    }
    /**
     * Logs a task-related event
     *
     * @param {EventType} type - Task event type
     * @param {string} message - Event message
     * @param {Object} [options] - Additional event options
     * @returns {Promise<void>}
     */
    async logTaskEvent(type: EventType, message: string, options?: {
        details?: Record<string, JsonValue>;
        taskId?: string;
        jobType?: string;
    }): Promise<void> {
        const eventOptions: {
            details?: Record<string, JsonValue>;
            relatedEntityId?: string;
            relatedEntityType?: string;
        } = {
            relatedEntityType: 'task'
        };
        const details: Record<string, JsonValue> = {
            ...options?.details,
            jobType: options?.jobType ?? null
        };
        eventOptions.details = details;
        if (options?.taskId) {
            eventOptions.relatedEntityId = options.taskId;
        }
        await this.logEvent(type, EventSource.TASK, message, eventOptions);
    }
    /**
     * Logs a system startup event
     *
     * @param {Object} [details] - Optional startup details
     * @returns {Promise<void>}
     */
    async logStartup(details?: Record<string, JsonValue>): Promise<void> {
        await this.logEvent(EventType.SYSTEM_STARTUP, EventSource.SYSTEM, 'Application started', {
            details: {
                version: process.env["APP_VERSION"] ?? 'unknown',
                nodeEnv: process.env.NODE_ENV,
                platform: process.platform,
                ...details
            }
        });
    }
    /**
     * Logs an error event
     *
     * @param {EventSource} source - Source of the error
     * @param {string} message - Error message
     * @param {Error} error - Error object
     * @param {Object} [options] - Additional error options
     * @returns {Promise<void>}
     */
    async logError(source: EventSource, message: string, error: Error, options?: {
        relatedEntityId?: string;
        relatedEntityType?: string;
        additionalDetails?: Record<string, JsonValue>;
    }): Promise<void> {
        // Determine event type based on source
        let type: EventType;
        switch (source) {
            case EventSource.LIBRARY:
                type = EventType.LIBRARY_SCAN_ERROR;
                break;
            case EventSource.MANGA:
                type = EventType.SYSTEM_ERROR;
                break;
            case EventSource.DOWNLOAD:
                type = EventType.DOWNLOAD_ERROR;
                break;
            case EventSource.TASK:
                type = EventType.TASK_FAILED;
                break;
            case EventSource.ANILIST:
            case EventSource.MANGADEX:
            case EventSource.COMICVINE:
            case EventSource.SUWAYOMI:
            case EventSource.PROWLARR:
                type = EventType.INTEGRATION_ERROR;
                break;
            default:
                type = EventType.SYSTEM_ERROR;
        }
        const eventOptions: {
            details?: Record<string, JsonValue>;
            relatedEntityId?: string;
            relatedEntityType?: string;
        } = {};
        const details: Record<string, JsonValue> = {
            error: (error instanceof Error ? error.message : String(error)),
            ...(error instanceof Error && error.stack !== undefined ? { stack: error.stack } : {}),
            ...options?.additionalDetails
        };
        eventOptions.details = details;
        if (options?.relatedEntityId) {
            eventOptions.relatedEntityId = options.relatedEntityId;
        }
        if (options?.relatedEntityType) {
            eventOptions.relatedEntityType = options.relatedEntityType;
        }
        await this.logEvent(type, source, message, eventOptions);
    }
    /**
     * Logs a Suwayomi-related event
     *
     * @param {EventType} type - Suwayomi event type
     * @param {string} message - Event message
     * @param {Record<string, JsonValue>} [data] - Event data
     * @returns {Promise<void>}
     */
    async logSuwayomiEvent(type: EventType, message: string, data?: Record<string, JsonValue>): Promise<void> {
        const eventOptions: {
            details?: Record<string, JsonValue>;
            relatedEntityId?: string;
            relatedEntityType?: string;
        } = {};
        if (data) {
            eventOptions.details = data;
        }
        await this.logEvent(type, EventSource.SUWAYOMI, message, eventOptions);
    }
    /**
     * Logs a Kapowarr-related event
     *
     * @param {EventType} type - Kapowarr event type
     * @param {string} message - Event message
     * @param {Record<string, JsonValue>} [data] - Event data
     * @returns {Promise<void>}
     */
    async logKapowarrEvent(type: EventType, message: string, data?: Record<string, JsonValue>): Promise<void> {
        const eventOptions: {
            details?: Record<string, JsonValue>;
            relatedEntityId?: string;
            relatedEntityType?: string;
        } = {};
        if (data) {
            eventOptions.details = data;
        }
        await this.logEvent(type, EventSource.NATIVE_DOWNLOAD, message, eventOptions);
    }
    /**
     * Logs a Prowlarr-related event
     *
     * @param {EventType} type - Prowlarr event type
     * @param {string} message - Event message
     * @param {Record<string, JsonValue>} [data] - Event data
     * @returns {Promise<void>}
     */
    async logProwlarrEvent(type: EventType, message: string, data?: Record<string, JsonValue>): Promise<void> {
        const eventOptions: {
            details?: Record<string, JsonValue>;
            relatedEntityId?: string;
            relatedEntityType?: string;
        } = {};
        if (data) {
            eventOptions.details = data;
        }
        await this.logEvent(type, EventSource.PROWLARR, message, eventOptions);
    }
}
// Export a singleton instance
export const eventLogger = new EventLogger();
