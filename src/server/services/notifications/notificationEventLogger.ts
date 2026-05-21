/**
 * Notification Event Logger
 * 
 * Server-side utility for logging notification events through the event system.
 * This bridges notification events to the existing event infrastructure.
 */

import { NotificationEventType } from '@prisma/client';

import { eventLogger } from '../events/eventLogger';
import { EventType, EventSource } from '../events/eventTypes';

/**
 * Helper function to check if notification is an integration event
 */
function isIntegrationEvent(notificationEvent: NotificationEventType): boolean {
  return notificationEvent.includes('suwayomi_') ||
    notificationEvent.includes('prowlarr_') ||
    notificationEvent.includes('native_download_');
}

/**
 * Helper function to map integration events to event types
 */
function mapIntegrationEvent(notificationEvent: NotificationEventType): EventType | null {
  if (notificationEvent.includes('_connected') || notificationEvent.includes('_initialized')) {
    return EventType.INTEGRATION_CONNECTED;
  }
  if (notificationEvent.includes('_disconnected')) {
    return EventType.INTEGRATION_DISCONNECTED;
  }
  if (notificationEvent.includes('_error') || notificationEvent.includes('_failed')) {
    return EventType.INTEGRATION_ERROR;
  }
  return null;
}

/**
 * Helper function to map download events to event types
 */
function mapDownloadEvent(notificationEvent: NotificationEventType): EventType | null {
  if (notificationEvent.includes('_started') || notificationEvent.includes('_queued')) {
    return EventType.DOWNLOAD_STARTED;
  }
  if (notificationEvent.includes('_progress')) {
    return EventType.DOWNLOAD_PROGRESS;
  }
  if (notificationEvent.includes('_completed')) {
    return EventType.DOWNLOAD_COMPLETED;
  }
  if (notificationEvent.includes('_failed') || notificationEvent.includes('_error')) {
    return EventType.DOWNLOAD_ERROR;
  }
  return null;
}

/**
 * Helper function to map manga events to event types
 */
function mapMangaEvent(notificationEvent: NotificationEventType): EventType | null {
  if (notificationEvent.includes('_added')) {
    return EventType.MANGA_ADDED;
  }
  if (notificationEvent.includes('_updated')) {
    return EventType.MANGA_UPDATED;
  }
  if (notificationEvent.includes('_deleted')) {
    return EventType.MANGA_DELETED;
  }
  if (notificationEvent.includes('_metadata')) {
    return EventType.MANGA_METADATA_UPDATED;
  }
  return null;
}

/**
 * Maps notification event types to system event types
 */
function mapNotificationToEventType(notificationEvent: NotificationEventType): EventType {
  // Check for integration events
  if (isIntegrationEvent(notificationEvent)) {
    const eventType = mapIntegrationEvent(notificationEvent);
    if (eventType) return eventType;
  }

  // Check for download events
  if (notificationEvent.includes('_download_')) {
    const eventType = mapDownloadEvent(notificationEvent);
    if (eventType) return eventType;
  }

  // Check for manga events
  if (notificationEvent.includes('manga_')) {
    const eventType = mapMangaEvent(notificationEvent);
    if (eventType) return eventType;
  }

  // Default to system event
  return EventType.SYSTEM_ERROR;
}

/**
 * Maps notification event source to event source
 */
function mapNotificationToEventSource(notificationEvent: NotificationEventType): EventSource {
  if (notificationEvent.startsWith('suwayomi_')) {
    return EventSource.SUWAYOMI;
  }
  if (notificationEvent.startsWith('prowlarr_')) {
    return EventSource.PROWLARR;
  }
  if (notificationEvent.startsWith('native_download_')) {
    return EventSource.NATIVE_DOWNLOAD;
  }
  if (notificationEvent.includes('manga_')) {
    return EventSource.MANGA;
  }
  if (notificationEvent.includes('download_')) {
    return EventSource.DOWNLOAD;
  }
  if (notificationEvent.includes('auth_')) {
    return EventSource.USER;
  }

  return EventSource.SYSTEM;
}

/**
 * Log a notification event through the event system
 */
export async function logNotificationEvent(
notificationEvent: NotificationEventType,
message: string,
details?: Record<string, unknown>)
: Promise<void> {
  const eventType = mapNotificationToEventType(notificationEvent);
  const eventSource = mapNotificationToEventSource(notificationEvent);

  await eventLogger.logEvent(eventType, eventSource, message, {
    details: {
      notificationEvent,
      ...details
    }
  });
}

/**
 * Suwayomi notification loggers
 */
export const suwayomiNotifications = {
  serverConnected: async (): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_SERVER_CONNECTED,
      'Successfully connected to Suwayomi server'
    );
  },

  serverDisconnected: async (): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_SERVER_DISCONNECTED,
      'Lost connection to Suwayomi server'
    );
  },

  healthCheckFailed: async (error: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_SERVER_HEALTH_CHECK_FAILED,
      `Suwayomi server health check failed: ${error}`,
      { error }
    );
  },

  sourceInstalled: async (sourceName: string, sourceId: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_SOURCE_INSTALLED,
      `${sourceName} has been installed in Suwayomi`,
      { sourceName, sourceId }
    );
  },

  sourceUninstalled: async (sourceName: string, sourceId: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_SOURCE_UNINSTALLED,
      `${sourceName} has been uninstalled from Suwayomi`,
      { sourceName, sourceId }
    );
  },

  searchStarted: async (query: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_SEARCH_STARTED,
      `Searching for "${query}" in Suwayomi`,
      { query }
    );
  },

  searchCompleted: async (query: string, resultCount: number): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_SEARCH_COMPLETED,
      `Found ${resultCount} results for "${query}"`,
      { query, resultCount }
    );
  },

  searchFailed: async (query: string, error: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_SEARCH_FAILED,
      `Search failed: ${error}`,
      { query, error }
    );
  },

  chapterDownloadStarted: async (chapterTitle: string, mangaTitle: string, chapterId: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_CHAPTER_DOWNLOAD_STARTED,
      `Downloading ${chapterTitle} via Suwayomi`,
      { chapterTitle, mangaTitle, chapterId }
    );
  },

  chapterDownloadCompleted: async (chapterTitle: string, mangaTitle: string, chapterId: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_CHAPTER_DOWNLOAD_COMPLETED,
      `${chapterTitle} of ${mangaTitle} downloaded via Suwayomi`,
      { chapterTitle, mangaTitle, chapterId }
    );
  },

  chapterDownloadFailed: async (chapterTitle: string, mangaTitle: string, chapterId: string, error: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_CHAPTER_DOWNLOAD_FAILED,
      `Failed to download ${chapterTitle}: ${error}`,
      { chapterTitle, mangaTitle, chapterId, error }
    );
  },

  mangaFetched: async (mangaTitle: string, mangaId: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_MANGA_FETCHED,
      `Fetched data for ${mangaTitle} from Suwayomi`,
      { mangaTitle, mangaId }
    );
  },

  chaptersFetched: async (mangaTitle: string, chapterCount: number): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.SUWAYOMI_CHAPTERS_FETCHED,
      `Fetched ${chapterCount} chapters for ${mangaTitle}`,
      { mangaTitle, chapterCount }
    );
  }
};

/**
 * Native Download notification loggers
 */
export const nativeDownloadNotifications = {
  sourceInitialized: async (sourceName: string, sourceId: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_SOURCE_INITIALIZED,
      `Initialized native download source: ${sourceName}`,
      { sourceName, sourceId }
    );
  },

  sourceValidationStarted: async (sourceName: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_SOURCE_VALIDATION_STARTED,
      `Validating native download source: ${sourceName}`,
      { sourceName }
    );
  },

  sourceValidationCompleted: async (sourceName: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_SOURCE_VALIDATION_COMPLETED,
      `Successfully validated ${sourceName}`,
      { sourceName }
    );
  },

  sourceValidationFailed: async (sourceName: string, error: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_SOURCE_VALIDATION_FAILED,
      `Failed to validate native download source: ${sourceName}`,
      { sourceName, error }
    );
  },

  sourceError: async (sourceName: string, sourceId: string, error: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_SOURCE_ERROR,
      `Error with source ${sourceName}: ${error}`,
      { sourceName, sourceId, error }
    );
  },

  downloadQueued: async (chapterTitle: string, chapterId: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_QUEUED,
      `${chapterTitle} queued for native download`,
      { chapterTitle, chapterId }
    );
  },

  downloadStarted: async (chapterTitle: string, sourceName: string, downloadId: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_STARTED,
      `Downloading ${chapterTitle} from ${sourceName}`,
      { chapterTitle, sourceName, downloadId }
    );
  },

  downloadProgress: async (downloadId: string, progress: number, chapterId: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_PROGRESS,
      `Native download ${progress}% complete`,
      { downloadId, progress, chapterId }
    );
  },

  downloadCompleted: async (chapterTitle: string, downloadId: string, chapterId: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_COMPLETED,
      `Successfully downloaded ${chapterTitle}`,
      { chapterTitle, downloadId, chapterId }
    );
  },

  downloadFailed: async (chapterTitle: string, downloadId: string, chapterId: string, error: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_FAILED,
      `Failed to download ${chapterTitle}: ${error}`,
      { chapterTitle, downloadId, chapterId, error }
    );
  },

  managerInitialized: async (adapterCount: number): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.NATIVE_DOWNLOAD_MANAGER_INITIALIZED,
      `Native Download Manager initialized with ${adapterCount} adapters`,
      { adapterCount }
    );
  }
};

/**
 * Prowlarr notification loggers
 */
export const prowlarrNotifications = {
  connected: async (version?: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.PROWLARR_CONNECTED,
      `Successfully connected to Prowlarr${version ? ` (v${version})` : ''}`,
      { version }
    );
  },

  disconnected: async (error?: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.PROWLARR_DISCONNECTED,
      'Lost connection to Prowlarr',
      { error }
    );
  },

  connectionTestSuccessful: async (version?: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.PROWLARR_CONNECTION_TEST_SUCCESSFUL,
      'Prowlarr connection test passed',
      { version }
    );
  },

  connectionTestFailed: async (error: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.PROWLARR_CONNECTION_TEST_FAILED,
      `Prowlarr connection test failed: ${error}`,
      { error }
    );
  },

  indexerTestFailed: async (indexerName: string, error: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.PROWLARR_INDEXER_TEST_FAILED,
      `${indexerName} test failed: ${error}`,
      { indexerName, error }
    );
  },

  searchStarted: async (query: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.PROWLARR_SEARCH_STARTED,
      `Searching for "${query}"`,
      { query }
    );
  },

  searchCompleted: async (query: string, resultCount: number): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.PROWLARR_SEARCH_COMPLETED,
      `Found ${resultCount} results for "${query}"`,
      { query, resultCount }
    );
  },

  searchFailed: async (query: string, error: string): Promise<void> => {
    await logNotificationEvent(
      NotificationEventType.PROWLARR_SEARCH_FAILED,
      `Prowlarr search failed: ${error}`,
      { query, error }
    );
  }
};