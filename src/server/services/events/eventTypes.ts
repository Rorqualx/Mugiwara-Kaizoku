/**
 * Event Types and Enumerations
 * 
 * Defines the types and enumerations used by the event system,
 * including event types, sources, and severity levels.
 * 
 * @module server/services/events/eventTypes
 */

/**
 * Event types indicating the category of event
 */
export enum EventType {
  // System events
  SYSTEM_STARTUP = 'system.startup',
  SYSTEM_SHUTDOWN = 'system.shutdown',
  SYSTEM_ERROR = 'system.error',
  
  // Library events
  LIBRARY_SCAN_STARTED = 'library.scan.started',
  LIBRARY_SCAN_COMPLETED = 'library.scan.completed',
  LIBRARY_SCAN_ERROR = 'library.scan.error',
  
  // Manga events
  MANGA_ADDED = 'manga.added',
  MANGA_UPDATED = 'manga.updated',
  MANGA_DELETED = 'manga.deleted',
  MANGA_METADATA_UPDATED = 'manga["metadata"].updated',
  
  // Download events
  DOWNLOAD_STARTED = 'download.started',
  DOWNLOAD_PROGRESS = 'download.progress',
  DOWNLOAD_COMPLETED = 'download.completed',
  DOWNLOAD_ERROR = 'download.error',
  
  // Integration events
  INTEGRATION_CONNECTED = 'integration.connected',
  INTEGRATION_DISCONNECTED = 'integration.disconnected',
  INTEGRATION_ERROR = 'integration.error',
  
  // User events
  USER_LOGGED_IN = 'user.login',
  USER_LOGGED_OUT = 'user.logout',
  USER_ACTION = 'user.action',

  // Task events
  TASK_CREATED = 'task.created',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',

  // Backup events
  BACKUP_STARTED = 'backup.started',
  BACKUP_COMPLETED = 'backup.completed',
  BACKUP_FAILED = 'backup.failed',

  // Native Download events
  NATIVE_DOWNLOAD_SOURCES_FETCHED = 'native_download.sources.fetched',
  NATIVE_DOWNLOAD_SOURCE_ADDED = 'native_download.source.added',
  NATIVE_DOWNLOAD_SOURCE_UPDATED = 'native_download.source.updated',
  NATIVE_DOWNLOAD_SOURCE_DELETED = 'native_download.source.deleted',
  NATIVE_DOWNLOAD_WEBSITE_VALIDATED = 'native_download.website.validated',
  NATIVE_DOWNLOAD_SEARCH_COMPLETED = 'native_download.search.completed',
  NATIVE_DOWNLOAD_QUEUED = 'native_download.download.queued',
  NATIVE_DOWNLOAD_CANCELLED = 'native_download.download.cancelled',
  NATIVE_DOWNLOAD_RETRIED = 'native_download.download.retried',
  NATIVE_DOWNLOAD_ERROR = 'native_download.error',
  
  // Calendar events
  CALENDAR_EVENT_CREATED = 'calendar.event.created',
  CALENDAR_RELEASE_CONFIRMED = 'calendar.release.confirmed',
  CALENDAR_RELEASE_DELAYED = 'calendar.release.delayed',
  CALENDAR_OVERDUE_DETECTED = 'calendar.overdue.detected',
  CALENDAR_SCHEDULE_OVERRIDE = 'calendar.schedule.override',
  CALENDAR_PROVIDER_SYNC = 'calendar.provider.sync',
  CALENDAR_PATTERN_FAILED = 'calendar.pattern.failed',
  CALENDAR_EXPORTED = 'calendar.exported',
  
  // Additional manga events
  MANGA_TRANSFERRED = 'manga.transferred',
  MANGA_BOUND_TO_ANILIST = 'manga.bound.anilist',
  MANGA_METADATA_CONFLICT = 'manga["metadata"].conflict',
  MANGA_METADATA_REFRESHED = 'manga["metadata"].refreshed',
  MANGA_BULK_OPERATION = 'manga.bulk.operation',
  MANGA_NEW_CHAPTERS = 'manga.new["chapters"]',
  
  // Additional download events
  DOWNLOAD_QUEUED = 'download.queued',
  DOWNLOAD_FAILED_RETRY = 'download.failed.retry',
  DOWNLOAD_METHOD_SELECTED = 'download.method.selected',
  
  // Additional user events  
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_PASSWORD_CHANGED = 'user.password.changed',
  USER_ROLE_CHANGED = 'user.role.changed',
  USER_LOGIN_FAILED = 'user.login.failed',
  USER_SUSPICIOUS_ACTIVITY = 'user.suspicious.activity',
  USER_SESSION_EXPIRED = 'user.session.expired',
  
  // Additional system events
  SYSTEM_HEALTH_CHANGED = 'system.health.changed',
  SYSTEM_UPDATE_AVAILABLE = 'system.update.available',
  SYSTEM_CONFIGURATION_CHANGED = 'system.configuration.changed',
  SYSTEM_RESOURCE_WARNING = 'system.resource.warning',
  
  // Additional backup events
  BACKUP_RESTORED = 'backup.restored',
  BACKUP_RETENTION_APPLIED = 'backup.retention.applied',
  
  // Additional database events  
  DATABASE_CONNECTED = 'database.connected',
  DATABASE_DISCONNECTED = 'database.disconnected',
  DATABASE_ERROR = 'database.error',
  
  // Queue events
  QUEUE_STARTED = 'queue.started',
  QUEUE_STOPPED = 'queue.stopped',
  QUEUE_CLEANUP_COMPLETED = 'queue.cleanup.completed',
  QUEUE_ERROR = 'queue.error'
}

/**
 * Event sources indicating the component that generated the event
 */
export enum EventSource {
  SYSTEM = 'system',
  LIBRARY = 'library',
  MANGA = 'manga',
  DOWNLOAD = 'download',
  ANILIST = 'anilist',
  MANGADEX = 'mangadex',
  COMICVINE = 'comicvine',
  SUWAYOMI = 'suwayomi',
  PROWLARR = 'prowlarr',
  USER = 'user',
  TASK = 'task',
  BACKUP = 'backup',
  DATABASE = 'database',
  METADATA = 'metadata',
  NATIVE_DOWNLOAD = 'native_download',
  BACKEND = 'backend',
  CALENDAR = 'calendar',
  QUEUE = 'queue'
}

/**
 * Event severity levels
 * Updated to match project standards (UPPERCASE values)
 */
export enum EventLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

/**
 * Map EventType to EventLevel for convenient lookup
 */
export const EventTypeToLevel: Record<EventType, EventLevel> = {
  [EventType.SYSTEM_STARTUP]: EventLevel.INFO,
  [EventType.SYSTEM_SHUTDOWN]: EventLevel.INFO,
  [EventType.SYSTEM_ERROR]: EventLevel.ERROR,
  
  [EventType.LIBRARY_SCAN_STARTED]: EventLevel.INFO,
  [EventType.LIBRARY_SCAN_COMPLETED]: EventLevel.INFO,
  [EventType.LIBRARY_SCAN_ERROR]: EventLevel.ERROR,
  
  [EventType.MANGA_ADDED]: EventLevel.INFO,
  [EventType.MANGA_UPDATED]: EventLevel.INFO,
  [EventType.MANGA_DELETED]: EventLevel.INFO,
  [EventType.MANGA_METADATA_UPDATED]: EventLevel.INFO,
  
  [EventType.DOWNLOAD_STARTED]: EventLevel.INFO,
  [EventType.DOWNLOAD_PROGRESS]: EventLevel.DEBUG,
  [EventType.DOWNLOAD_COMPLETED]: EventLevel.INFO,
  [EventType.DOWNLOAD_ERROR]: EventLevel.ERROR,
  
  [EventType.INTEGRATION_CONNECTED]: EventLevel.INFO,
  [EventType.INTEGRATION_DISCONNECTED]: EventLevel.INFO,
  [EventType.INTEGRATION_ERROR]: EventLevel.ERROR,
  
  [EventType.USER_LOGGED_IN]: EventLevel.INFO,
  [EventType.USER_LOGGED_OUT]: EventLevel.INFO,
  [EventType.USER_ACTION]: EventLevel.INFO,

  [EventType.TASK_CREATED]: EventLevel.INFO,
  [EventType.TASK_STARTED]: EventLevel.INFO,
  [EventType.TASK_COMPLETED]: EventLevel.INFO,
  [EventType.TASK_FAILED]: EventLevel.ERROR,

  [EventType.BACKUP_STARTED]: EventLevel.INFO,
  [EventType.BACKUP_COMPLETED]: EventLevel.INFO,
  [EventType.BACKUP_FAILED]: EventLevel.ERROR,

  [EventType.NATIVE_DOWNLOAD_SOURCES_FETCHED]: EventLevel.INFO,
  [EventType.NATIVE_DOWNLOAD_SOURCE_ADDED]: EventLevel.INFO,
  [EventType.NATIVE_DOWNLOAD_SOURCE_UPDATED]: EventLevel.INFO,
  [EventType.NATIVE_DOWNLOAD_SOURCE_DELETED]: EventLevel.INFO,
  [EventType.NATIVE_DOWNLOAD_WEBSITE_VALIDATED]: EventLevel.INFO,
  [EventType.NATIVE_DOWNLOAD_SEARCH_COMPLETED]: EventLevel.INFO,
  [EventType.NATIVE_DOWNLOAD_QUEUED]: EventLevel.INFO,
  [EventType.NATIVE_DOWNLOAD_CANCELLED]: EventLevel.INFO,
  [EventType.NATIVE_DOWNLOAD_RETRIED]: EventLevel.INFO,
  [EventType.NATIVE_DOWNLOAD_ERROR]: EventLevel.ERROR,
  
  // Calendar events
  [EventType.CALENDAR_EVENT_CREATED]: EventLevel.INFO,
  [EventType.CALENDAR_RELEASE_CONFIRMED]: EventLevel.INFO,
  [EventType.CALENDAR_RELEASE_DELAYED]: EventLevel.WARNING,
  [EventType.CALENDAR_OVERDUE_DETECTED]: EventLevel.WARNING,
  [EventType.CALENDAR_SCHEDULE_OVERRIDE]: EventLevel.INFO,
  [EventType.CALENDAR_PROVIDER_SYNC]: EventLevel.INFO,
  [EventType.CALENDAR_PATTERN_FAILED]: EventLevel.WARNING,
  [EventType.CALENDAR_EXPORTED]: EventLevel.INFO,
  
  // Additional manga events
  [EventType.MANGA_TRANSFERRED]: EventLevel.INFO,
  [EventType.MANGA_BOUND_TO_ANILIST]: EventLevel.INFO,
  [EventType.MANGA_METADATA_CONFLICT]: EventLevel.WARNING,
  [EventType.MANGA_METADATA_REFRESHED]: EventLevel.INFO,
  [EventType.MANGA_BULK_OPERATION]: EventLevel.INFO,
  [EventType.MANGA_NEW_CHAPTERS]: EventLevel.INFO,
  
  // Additional download events
  [EventType.DOWNLOAD_QUEUED]: EventLevel.INFO,
  [EventType.DOWNLOAD_FAILED_RETRY]: EventLevel.WARNING,
  [EventType.DOWNLOAD_METHOD_SELECTED]: EventLevel.DEBUG,
  
  // Additional user events
  [EventType.USER_CREATED]: EventLevel.INFO,
  [EventType.USER_UPDATED]: EventLevel.INFO,
  [EventType.USER_DELETED]: EventLevel.INFO,
  [EventType.USER_PASSWORD_CHANGED]: EventLevel.INFO,
  [EventType.USER_ROLE_CHANGED]: EventLevel.INFO,
  [EventType.USER_LOGIN_FAILED]: EventLevel.WARNING,
  [EventType.USER_SUSPICIOUS_ACTIVITY]: EventLevel.WARNING,
  [EventType.USER_SESSION_EXPIRED]: EventLevel.INFO,
  
  // Additional system events
  [EventType.SYSTEM_HEALTH_CHANGED]: EventLevel.WARNING,
  [EventType.SYSTEM_UPDATE_AVAILABLE]: EventLevel.INFO,
  [EventType.SYSTEM_CONFIGURATION_CHANGED]: EventLevel.INFO,
  [EventType.SYSTEM_RESOURCE_WARNING]: EventLevel.WARNING,
  
  // Additional backup events
  [EventType.BACKUP_RESTORED]: EventLevel.INFO,
  [EventType.BACKUP_RETENTION_APPLIED]: EventLevel.INFO,
  
  // Additional database events
  [EventType.DATABASE_CONNECTED]: EventLevel.INFO,
  [EventType.DATABASE_DISCONNECTED]: EventLevel.WARNING,
  [EventType.DATABASE_ERROR]: EventLevel.ERROR,
  
  // Queue events
  [EventType.QUEUE_STARTED]: EventLevel.INFO,
  [EventType.QUEUE_STOPPED]: EventLevel.INFO,
  [EventType.QUEUE_CLEANUP_COMPLETED]: EventLevel.INFO,
  [EventType.QUEUE_ERROR]: EventLevel.ERROR
};

/**
 * Map EventLevel to UI display values
 */
export const EventLevelToDisplay: Record<EventLevel, { label: string, color: string }> = {
  [EventLevel.DEBUG]: { label: 'Debug', color: 'gray' },
  [EventLevel.INFO]: { label: 'Info', color: 'blue' },
  [EventLevel.WARNING]: { label: 'Warning', color: 'yellow' },
  [EventLevel.ERROR]: { label: 'Error', color: 'red' },
  [EventLevel.CRITICAL]: { label: 'Critical', color: 'purple' }
};

/**
 * Map EventType to display values
 */
export const EventTypeToDisplay: Record<EventType, { label: string, icon: string }> = {
  [EventType.SYSTEM_STARTUP]: { label: 'System Startup', icon: 'system' },
  [EventType.SYSTEM_SHUTDOWN]: { label: 'System Shutdown', icon: 'system' },
  [EventType.SYSTEM_ERROR]: { label: 'System Error', icon: 'alert' },
  
  [EventType.LIBRARY_SCAN_STARTED]: { label: 'Library Scan Started', icon: 'scan' },
  [EventType.LIBRARY_SCAN_COMPLETED]: { label: 'Library Scan Completed', icon: 'check' },
  [EventType.LIBRARY_SCAN_ERROR]: { label: 'Library Scan Error', icon: 'alert' },
  
  [EventType.MANGA_ADDED]: { label: 'Manga Added', icon: 'plus' },
  [EventType.MANGA_UPDATED]: { label: 'Manga Updated', icon: 'refresh' },
  [EventType.MANGA_DELETED]: { label: 'Manga Deleted', icon: 'trash' },
  [EventType.MANGA_METADATA_UPDATED]: { label: 'Metadata Updated', icon: 'info' },
  
  [EventType.DOWNLOAD_STARTED]: { label: 'Download Started', icon: 'download' },
  [EventType.DOWNLOAD_PROGRESS]: { label: 'Download Progress', icon: 'progress' },
  [EventType.DOWNLOAD_COMPLETED]: { label: 'Download Completed', icon: 'check' },
  [EventType.DOWNLOAD_ERROR]: { label: 'Download Error', icon: 'alert' },
  
  [EventType.INTEGRATION_CONNECTED]: { label: 'Integration Connected', icon: 'network' },
  [EventType.INTEGRATION_DISCONNECTED]: { label: 'Integration Disconnected', icon: 'network-off' },
  [EventType.INTEGRATION_ERROR]: { label: 'Integration Error', icon: 'alert' },
  
  [EventType.USER_LOGGED_IN]: { label: 'User Login', icon: 'USER' },
  [EventType.USER_LOGGED_OUT]: { label: 'User Logout', icon: 'USER' },
  [EventType.USER_ACTION]: { label: 'User Action', icon: 'USER' },

  [EventType.TASK_CREATED]: { label: 'Task Created', icon: 'plus' },
  [EventType.TASK_STARTED]: { label: 'Task Started', icon: 'play' },
  [EventType.TASK_COMPLETED]: { label: 'Task Completed', icon: 'check' },
  [EventType.TASK_FAILED]: { label: 'Task Failed', icon: 'alert' },

  [EventType.BACKUP_STARTED]: { label: 'Backup Started', icon: 'database' },
  [EventType.BACKUP_COMPLETED]: { label: 'Backup Completed', icon: 'check' },
  [EventType.BACKUP_FAILED]: { label: 'Backup Failed', icon: 'alert' },

  [EventType.NATIVE_DOWNLOAD_SOURCES_FETCHED]: { label: 'Native Download Sources Fetched', icon: 'list' },
  [EventType.NATIVE_DOWNLOAD_SOURCE_ADDED]: { label: 'Native Download Source Added', icon: 'plus' },
  [EventType.NATIVE_DOWNLOAD_SOURCE_UPDATED]: { label: 'Native Download Source Updated', icon: 'refresh' },
  [EventType.NATIVE_DOWNLOAD_SOURCE_DELETED]: { label: 'Native Download Source Deleted', icon: 'trash' },
  [EventType.NATIVE_DOWNLOAD_WEBSITE_VALIDATED]: { label: 'Website Validated', icon: 'check' },
  [EventType.NATIVE_DOWNLOAD_SEARCH_COMPLETED]: { label: 'Native Download Search Completed', icon: 'search' },
  [EventType.NATIVE_DOWNLOAD_QUEUED]: { label: 'Native Download Queued', icon: 'download' },
  [EventType.NATIVE_DOWNLOAD_CANCELLED]: { label: 'Native Download Cancelled', icon: 'x' },
  [EventType.NATIVE_DOWNLOAD_RETRIED]: { label: 'Native Download Retried', icon: 'refresh' },
  [EventType.NATIVE_DOWNLOAD_ERROR]: { label: 'Native Download Error', icon: 'alert' },
  
  // Calendar events
  [EventType.CALENDAR_EVENT_CREATED]: { label: 'Calendar Event Created', icon: 'calendar' },
  [EventType.CALENDAR_RELEASE_CONFIRMED]: { label: 'Release Confirmed', icon: 'check' },
  [EventType.CALENDAR_RELEASE_DELAYED]: { label: 'Release Delayed', icon: 'clock' },
  [EventType.CALENDAR_OVERDUE_DETECTED]: { label: 'Overdue Release', icon: 'alert' },
  [EventType.CALENDAR_SCHEDULE_OVERRIDE]: { label: 'Schedule Override', icon: 'edit' },
  [EventType.CALENDAR_PROVIDER_SYNC]: { label: 'Calendar Sync', icon: 'sync' },
  [EventType.CALENDAR_PATTERN_FAILED]: { label: 'Pattern Detection Failed', icon: 'alert' },
  [EventType.CALENDAR_EXPORTED]: { label: 'Calendar Exported', icon: 'download' },
  
  // Additional manga events
  [EventType.MANGA_TRANSFERRED]: { label: 'Manga Transferred', icon: 'move' },
  [EventType.MANGA_BOUND_TO_ANILIST]: { label: 'Bound to AniList', icon: 'link' },
  [EventType.MANGA_METADATA_CONFLICT]: { label: 'Metadata Conflict', icon: 'alert' },
  [EventType.MANGA_METADATA_REFRESHED]: { label: 'Metadata Refreshed', icon: 'refresh' },
  [EventType.MANGA_BULK_OPERATION]: { label: 'Bulk Operation', icon: 'list' },
  [EventType.MANGA_NEW_CHAPTERS]: { label: 'New Chapters', icon: 'plus' },
  
  // Additional download events
  [EventType.DOWNLOAD_QUEUED]: { label: 'Download Queued', icon: 'clock' },
  [EventType.DOWNLOAD_FAILED_RETRY]: { label: 'Download Retry', icon: 'refresh' },
  [EventType.DOWNLOAD_METHOD_SELECTED]: { label: 'Download Method', icon: 'settings' },
  
  // Additional user events
  [EventType.USER_CREATED]: { label: 'User Created', icon: 'user-plus' },
  [EventType.USER_UPDATED]: { label: 'User Updated', icon: 'user-edit' },
  [EventType.USER_DELETED]: { label: 'User Deleted', icon: 'user-minus' },
  [EventType.USER_PASSWORD_CHANGED]: { label: 'Password Changed', icon: 'key' },
  [EventType.USER_ROLE_CHANGED]: { label: 'Role Changed', icon: 'shield' },
  [EventType.USER_LOGIN_FAILED]: { label: 'Login Failed', icon: 'alert' },
  [EventType.USER_SUSPICIOUS_ACTIVITY]: { label: 'Suspicious Activity', icon: 'alert' },
  [EventType.USER_SESSION_EXPIRED]: { label: 'Session Expired', icon: 'clock' },
  
  // Additional system events
  [EventType.SYSTEM_HEALTH_CHANGED]: { label: 'Health Status Changed', icon: 'heart' },
  [EventType.SYSTEM_UPDATE_AVAILABLE]: { label: 'Update Available', icon: 'download' },
  [EventType.SYSTEM_CONFIGURATION_CHANGED]: { label: 'Configuration Changed', icon: 'settings' },
  [EventType.SYSTEM_RESOURCE_WARNING]: { label: 'Resource Warning', icon: 'alert' },
  
  // Additional backup events
  [EventType.BACKUP_RESTORED]: { label: 'Backup Restored', icon: 'upload' },
  [EventType.BACKUP_RETENTION_APPLIED]: { label: 'Retention Applied', icon: 'trash' },
  
  // Additional database events
  [EventType.DATABASE_CONNECTED]: { label: 'Database Connected', icon: 'database' },
  [EventType.DATABASE_DISCONNECTED]: { label: 'Database Disconnected', icon: 'database-off' },
  [EventType.DATABASE_ERROR]: { label: 'Database Error', icon: 'alert' },
  
  // Queue events
  [EventType.QUEUE_STARTED]: { label: 'Queue Started', icon: 'play' },
  [EventType.QUEUE_STOPPED]: { label: 'Queue Stopped', icon: 'stop' },
  [EventType.QUEUE_CLEANUP_COMPLETED]: { label: 'Queue Cleanup', icon: 'trash' },
  [EventType.QUEUE_ERROR]: { label: 'Queue Error', icon: 'alert' }
};
