/**
 * System Event Logging Module - Main Aggregator
 *
 * This module aggregates all system event logging functions from their
 * specialized sub-modules. All functions are re-exported for backward
 * compatibility with existing imports.
 *
 * Architecture:
 * - core.ts - System startup, shutdown, errors, warnings, health (9 functions)
 * - database.ts - Database connection, errors, backups (7 functions)
 * - library.ts - Library CRUD and scan operations (5 functions)
 * - manga.ts - Manga operations and metadata events (13 functions)
 * - download.ts - Download lifecycle events (7 functions)
 * - integration.ts - External integration events (3 functions)
 * - task.ts - Background tasks and queue events (8 functions)
 * - calendar.ts - Calendar and release schedule events (14 functions)
 * - user.ts - User management events (8 functions)
 * - notification.ts - Notification events (3 functions)
 *
 * Total: 77 functions across 10 modules
 *
 * Original: systemEvents.ts (1956 lines) -> Refactored: ~100 lines aggregator
 */

// Core system events
export {
  logSystemStartup,
  logSystemShutdown,
  logSystemError,
  logSystemWarning,
  logSystemUpdate,
  logHealthChanged,
  logUpdateAvailable,
  logConfigurationChanged,
  logResourceWarning,
} from './core';

// Database events
export {
  logDatabaseConnection,
  logDatabaseError,
  logDatabaseBackup,
  logDatabaseDisconnected,
  logDatabaseReconnected,
  logBackupRestored,
  logBackupRetentionApplied,
} from './database';

// Library events
export {
  logLibraryCreated,
  logLibraryDeleted,
  logLibraryUpdated,
  logLibraryScan,
  logLibraryScanComplete,
} from './library';

// Manga and metadata events
export {
  logMangaAdded,
  logMangaRemoved,
  logMangaUpdated,
  logMangaError,
  logMetadataRefresh,
  logMetadataRefreshComplete,
  logMetadataError,
  logMangaTransferred,
  logMangaBoundToAnilist,
  logMetadataConflict,
  logMetadataRefreshed,
  logBulkOperation,
  logNewChapters,
} from './manga';

// Download events
export {
  logDownloadStarted,
  logDownloadComplete,
  logDownloadError,
  logDownloadCancelled,
  logDownloadQueued,
  logDownloadRetry,
  logDownloadMethodSelected,
} from './download';

// Integration events
export {
  logIntegrationConnected,
  logIntegrationDisconnected,
  logIntegrationError,
} from './integration';

// Task and queue events
export {
  logTaskStarted,
  logTaskCompleted,
  logTaskFailed,
  logTaskScheduled,
  logQueueStarted,
  logQueueStopped,
  logQueueCleanup,
  logQueueError,
} from './task';

// Calendar events
export {
  logReleaseDetected,
  logPatternUpdated,
  logCalendarSyncStart,
  logCalendarSyncComplete,
  logUpcomingRelease,
  logReleaseDelayed,
  logHiatusAnnounced,
  logCalendarEventCreated,
  logReleaseConfirmed,
  logOverdueDetected,
  logScheduleManualOverride,
  logCalendarProviderSync,
  logPatternDetectionFailed,
  logCalendarExported,
} from './calendar';

// User events
export {
  logUserCreated,
  logUserUpdated,
  logUserDeleted,
  logPasswordChanged,
  logRoleChanged,
  logLoginFailed,
  logSuspiciousActivity,
  logSessionExpired,
} from './user';

// Notification events
export {
  logNotificationSent,
  logNotificationFailed,
  logMaintenanceComplete,
} from './notification';
