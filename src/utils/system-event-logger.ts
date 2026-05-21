/**
 * System Event Logger
 *
 * Utility for logging system events to the database.
 * This creates entries that appear in the Events page.
 *
 * @module utils/system-event-logger
 */
import { randomUUID } from 'crypto';

import { EventType, EventSource, EventLevel } from '../server/services/events/eventTypes';

import { logger } from './logging';
// Dynamic import to prevent build issues
let prismaClient: unknown;
// Only import prisma on the server
if (typeof window === 'undefined') {
  import('@/server/db').then(({ prisma }) => {
    prismaClient = prisma;
  }).catch((error: unknown) => {
    logger.error('Failed to load Prisma client:', error);
  });
}
/**
 * Parameters for logging a system event
 */
interface LogSystemEventParams {
  type: EventType | string;
  source: EventSource | string;
  level: EventLevel;
  message: string;
  details?: unknown;
  relatedEntityId?: string;
  relatedEntityType?: string;
}
/**
 * Log a system event to the database
 *
 * This function creates a system event entry that will appear in the Events page.
 * It also logs the event to the file system for persistence.
 *
 * @param {LogSystemEventParams} params - Event parameters
 * @returns {Promise<void>}
 *
 * @example
 * ```typescript
 * await logSystemEvent({
 *   type: EventType.MANGA_ADDED,
 *   source: EventSource.MANGA,
 *   level: EventLevel.INFO,
 *   message: 'Added new manga: One Piece',
 *   relatedEntityId: '123',
 *   relatedEntityType: 'manga'
 * });
 * ```
 */
export async function logSystemEvent({ type, source, level, message, details, relatedEntityId, relatedEntityType }: LogSystemEventParams): Promise<void> {
  try {
    // Log to file system based on level
    const logDetails = {
      type,
      source,
      level,
      relatedEntityId,
      relatedEntityType,
      details
    };
    switch (level) {
      case EventLevel.ERROR:
      case EventLevel.CRITICAL:
        logger.error(message, logDetails);
        break;
      case EventLevel.WARNING:
        logger.warn(message, logDetails);
        break;
      case EventLevel.INFO:
        logger.info(message, logDetails);
        break;
      case EventLevel.DEBUG:
        logger.debug(message, logDetails);
        break;
      default:
        logger.info(message, logDetails);
        break;
    }
    // Create event in database only if prisma is available and we're on the server
    if (typeof window === 'undefined' && prismaClient) {
      interface PrismaClientWithSystemEvent {
        systemEvent: {
          create: (params: { data: Record<string, unknown> }) => Promise<unknown>;
        };
      }
      const client = prismaClient as unknown as PrismaClientWithSystemEvent;
      await client.systemEvent.create({
        data: {
          id: randomUUID(),
          type,
          source,
          level,
          message,
          details: details ? JSON.stringify(details) : undefined,
          relatedEntityId,
          relatedEntityType,
          timestamp: new Date()
        }
      });
    }
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to log system event:', errorMessage);
  }
}
/**
 * Log an error event
 * Convenience function for logging error-level events
 *
 * @param {string} message - Error message
 * @param {EventSource} source - Event source
 * @param {Error | any} error - Error object
 * @param {object} [options] - Additional options
 */
export async function logError(message: string, source: EventSource, error: Error | unknown, options?: {
  relatedEntityId?: string;
  relatedEntityType?: string;
  details?: unknown;
}): Promise<void> {
  const errorDetails: Record<string, unknown> = {
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error
  };
  if (options?.details && typeof options.details === 'object') {
    Object.assign(errorDetails, options.details);
  }
  const eventParams: LogSystemEventParams = {
    type: EventType.SYSTEM_ERROR,
    source,
    level: EventLevel.ERROR,
    message,
    details: errorDetails
  };
  if (options?.relatedEntityId) {
    eventParams.relatedEntityId = options.relatedEntityId;
  }
  if (options?.relatedEntityType) {
    eventParams.relatedEntityType = options.relatedEntityType;
  }
  await logSystemEvent(eventParams);
}
/**
 * Log a warning event
 * Convenience function for logging warning-level events
 *
 * @param {string} message - Warning message
 * @param {EventType} type - Event type
 * @param {EventSource} source - Event source
 * @param {object} [options] - Additional options
 */
export async function logWarning(message: string, type: EventType, source: EventSource, options?: {
  relatedEntityId?: string;
  relatedEntityType?: string;
  details?: unknown;
}): Promise<void> {
  const eventParams: LogSystemEventParams = {
    type,
    source,
    level: EventLevel.WARNING,
    message
  };
  if (options?.details) {
    eventParams.details = options.details;
  }
  if (options?.relatedEntityId) {
    eventParams.relatedEntityId = options.relatedEntityId;
  }
  if (options?.relatedEntityType) {
    eventParams.relatedEntityType = options.relatedEntityType;
  }
  await logSystemEvent(eventParams);
}
/**
 * Log an info event
 * Convenience function for logging info-level events
 *
 * @param {string} message - Info message
 * @param {EventType} type - Event type
 * @param {EventSource} source - Event source
 * @param {object} [options] - Additional options
 */
export async function logInfo(message: string, type: EventType, source: EventSource, options?: {
  relatedEntityId?: string;
  relatedEntityType?: string;
  details?: unknown;
}): Promise<void> {
  const eventParams: LogSystemEventParams = {
    type,
    source,
    level: EventLevel.INFO,
    message
  };
  if (options?.details) {
    eventParams.details = options.details;
  }
  if (options?.relatedEntityId) {
    eventParams.relatedEntityId = options.relatedEntityId;
  }
  if (options?.relatedEntityType) {
    eventParams.relatedEntityType = options.relatedEntityType;
  }
  await logSystemEvent(eventParams);
}
/**
 * Log application startup
 */
export async function logAppStartup(): Promise<void> {
  await logInfo('Application started', EventType.SYSTEM_STARTUP, EventSource.SYSTEM, {
    details: {
      nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
      platform: typeof process !== 'undefined' ? process.platform : 'unknown',
      arch: typeof process !== 'undefined' ? process.arch : 'unknown',
      env: typeof process !== 'undefined' ? process.env.NODE_ENV : 'unknown'
    }
  });
}
/**
 * Log application shutdown
 */
export async function logAppShutdown(): Promise<void> {
  await logInfo('Application shutting down', EventType.SYSTEM_SHUTDOWN, EventSource.SYSTEM);
}
// Export all event types and sources for convenience
export { EventType, EventSource, EventLevel };
/**
 * Kapowarr event logging helpers
 */
export interface KapowarrEventOptions {
  sourceId?: string;
  sourceName?: string;
  mangaId?: string;
  chapterId?: string;
  downloadId?: string;
  query?: string;
  resultsCount?: number;
  url?: string;
  isValid?: boolean;
  metadata?: unknown;
}
/**
 * Log a Kapowarr event
 */
export async function logKapowarrEvent(params: {
  action: 'SOURCE_ADDED' | 'SOURCE_UPDATED' | 'SOURCE_DELETED' | 'WEBSITE_VALIDATED' | 'SEARCH_COMPLETED' | 'DOWNLOAD_QUEUED' | 'DOWNLOAD_CANCELLED' | 'DOWNLOAD_RETRIED' | 'ERROR';
  message?: string;
  error?: unknown;
  sourceId?: string;
  metadata?: KapowarrEventOptions;
}): Promise<void> {
  const { action, message, error, sourceId, metadata } = params;
  const eventTypeMap = {
    SOURCE_ADDED: EventType.NATIVE_DOWNLOAD_SOURCE_ADDED,
    SOURCE_UPDATED: EventType.NATIVE_DOWNLOAD_SOURCE_UPDATED,
    SOURCE_DELETED: EventType.NATIVE_DOWNLOAD_SOURCE_DELETED,
    WEBSITE_VALIDATED: EventType.NATIVE_DOWNLOAD_WEBSITE_VALIDATED,
    SEARCH_COMPLETED: EventType.NATIVE_DOWNLOAD_SEARCH_COMPLETED,
    DOWNLOAD_QUEUED: EventType.NATIVE_DOWNLOAD_QUEUED,
    DOWNLOAD_CANCELLED: EventType.NATIVE_DOWNLOAD_CANCELLED,
    DOWNLOAD_RETRIED: EventType.NATIVE_DOWNLOAD_RETRIED,
    ERROR: EventType.NATIVE_DOWNLOAD_ERROR
  };
  const eventType = eventTypeMap[action];
  const defaultMessage = `Native Download ${action.toLowerCase().replace(/_/g, ' ')}`;
  if (error) {
    const errorOptions: { relatedEntityType: string; relatedEntityId?: string; details?: unknown } = {
      relatedEntityType: 'native_download_source'
    };
    if (sourceId !== undefined) {
      errorOptions.relatedEntityId = sourceId;
    }
    if (metadata !== undefined) {
      errorOptions.details = metadata;
    }
    await logError(message ?? defaultMessage, EventSource.NATIVE_DOWNLOAD, error, errorOptions);
  } else
  {
    const infoOptions: { relatedEntityType: string; relatedEntityId?: string; details?: unknown } = {
      relatedEntityType: 'native_download_source'
    };
    if (sourceId !== undefined) {
      infoOptions.relatedEntityId = sourceId;
    }
    if (metadata !== undefined) {
      infoOptions.details = metadata;
    }
    await logInfo(message ?? defaultMessage, eventType, EventSource.NATIVE_DOWNLOAD, infoOptions);
  }
}