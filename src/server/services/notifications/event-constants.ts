/**
 * Notification Event Constants
 * 
 * Centralized constants for notification event types, emojis, titles, and colors.
 * Uses Prisma's NotificationEventType enum as the source of truth.
 */

import type { NotificationEventType } from '@prisma/client';

// Event emojis mapping
export const EVENT_EMOJIS: Record<NotificationEventType, string> = {
  MANGA_ADDED: '📘',
  MANGA_UPDATED: '✏️',
  MANGA_DELETED: '🗑️',
  CHAPTER_ADDED: '📄',
  CHAPTER_DOWNLOADED: '✅',
  CHAPTER_FAILED: '❌',
  VOLUME_ADDED: '📚',
  VOLUME_DOWNLOADED: '📦',
  METADATA_UPDATED: '🔄',
  SYNC_STARTED: '🔄',
  SYNC_COMPLETED: '✔️',
  SYNC_FAILED: '⚠️',
  BACKUP_STARTED: '💾',
  BACKUP_COMPLETED: '✅',
  BACKUP_FAILED: '❌',
  SYSTEM_ERROR: '🚨',
  SYSTEM_WARNING: '⚠️',
  SYSTEM_INFO: 'ℹ️',
  USER_ACTION: '👤',
  // Suwayomi events
  SUWAYOMI_SERVER_CONNECTED: '🔗',
  SUWAYOMI_SERVER_DISCONNECTED: '🔌',
  SUWAYOMI_SERVER_HEALTH_CHECK_FAILED: '❤️‍🩹',
  SUWAYOMI_SOURCE_INSTALLED: '➕',
  SUWAYOMI_SOURCE_UNINSTALLED: '➖',
  SUWAYOMI_SEARCH_STARTED: '🔍',
  SUWAYOMI_SEARCH_COMPLETED: '✔️',
  SUWAYOMI_SEARCH_FAILED: '❌',
  SUWAYOMI_CHAPTER_DOWNLOAD_STARTED: '⬇️',
  SUWAYOMI_CHAPTER_DOWNLOAD_COMPLETED: '✅',
  SUWAYOMI_CHAPTER_DOWNLOAD_FAILED: '❌',
  SUWAYOMI_MANGA_FETCHED: '📖',
  SUWAYOMI_CHAPTERS_FETCHED: '📑',
  // Native Download events
  NATIVE_DOWNLOAD_SOURCE_INITIALIZED: '🚀',
  NATIVE_DOWNLOAD_SOURCE_VALIDATION_STARTED: '🔍',
  NATIVE_DOWNLOAD_SOURCE_VALIDATION_COMPLETED: '✅',
  NATIVE_DOWNLOAD_SOURCE_VALIDATION_FAILED: '❌',
  NATIVE_DOWNLOAD_SOURCE_ERROR: '⚠️',
  NATIVE_DOWNLOAD_QUEUED: '📥',
  NATIVE_DOWNLOAD_STARTED: '⬇️',
  NATIVE_DOWNLOAD_PROGRESS: '📊',
  NATIVE_DOWNLOAD_COMPLETED: '✅',
  NATIVE_DOWNLOAD_FAILED: '❌',
  NATIVE_DOWNLOAD_MANAGER_INITIALIZED: '🎯',
  // Prowlarr events
  PROWLARR_CONNECTED: '🔗',
  PROWLARR_DISCONNECTED: '🔌',
  PROWLARR_CONNECTION_TEST_SUCCESSFUL: '✅',
  PROWLARR_CONNECTION_TEST_FAILED: '❌',
  PROWLARR_INDEXER_TEST_FAILED: '⚠️',
  PROWLARR_SEARCH_STARTED: '🔍',
  PROWLARR_SEARCH_COMPLETED: '✅',
  PROWLARR_SEARCH_FAILED: '❌',
  SUWAYOMI_EXTENSION_UPDATED: '🔄',
  SUWAYOMI_EXTENSION_INSTALLED: '📦',
  SUWAYOMI_EXTENSION_UNINSTALLED: '🗑️',
  SUWAYOMI_BACKUP_CREATED: '💾',
  SUWAYOMI_BACKUP_RESTORED: '📂',
  SUWAYOMI_BACKUP_FAILED: '❌',
  SUWAYOMI_LIBRARY_UPDATED: '📚',
  SUWAYOMI_UPDATE_CHECK_STARTED: '🔍',
  SUWAYOMI_UPDATE_CHECK_COMPLETED: '✅',
  SUWAYOMI_UPDATE_CHECK_FAILED: '❌',
  SUWAYOMI_DOWNLOAD_QUEUE_UPDATED: '📊',
  SUWAYOMI_SETTING_CHANGED: '⚙️',
  SUWAYOMI_CATEGORY_CREATED: '📁',
  SUWAYOMI_CATEGORY_DELETED: '🗑️',
  SUWAYOMI_CATEGORY_UPDATED: '✏️',
  SUWAYOMI_MANGA_MIGRATED: '➡️',
  SUWAYOMI_TRACKER_LOGIN_SUCCESS: '🔑',
  SUWAYOMI_TRACKER_LOGIN_FAILED: '🚫',
  SUWAYOMI_TRACKER_UPDATE_SUCCESS: '✅',
  SUWAYOMI_TRACKER_UPDATE_FAILED: '❌',
  // Task events
  TASK_STARTED: '▶️',
  TASK_COMPLETED: '✅',
  TASK_FAILED: '❌',
  // Download events
  DOWNLOAD_STARTED: '⬇️',
  DOWNLOAD_COMPLETED: '✅',
  DOWNLOAD_FAILED: '❌',
  UPDATE_AVAILABLE: '🆕',
  UPDATE_INSTALLED: '✅',
  UPDATE_FAILED: '❌',
  LIBRARY_SCAN_STARTED: '🔍',
  LIBRARY_SCAN_COMPLETED: '✅',
  LIBRARY_SCAN_FAILED: '❌',
  USER_LOGIN: '🔑',
  USER_LOGOUT: '🚪',
  USER_REGISTERED: '👤',
  SETTINGS_CHANGED: '⚙️',
  API_ERROR: '🚨',
  API_WARNING: '⚠️'
};

// Event titles mapping
export const EVENT_TITLES: Record<NotificationEventType, string> = {
  MANGA_ADDED: 'Manga Added',
  MANGA_UPDATED: 'Manga Updated',
  MANGA_DELETED: 'Manga Deleted',
  CHAPTER_ADDED: 'Chapter Added',
  CHAPTER_DOWNLOADED: 'Chapter Downloaded',
  CHAPTER_FAILED: 'Chapter Download Failed',
  VOLUME_ADDED: 'Volume Added',
  VOLUME_DOWNLOADED: 'Volume Downloaded',
  METADATA_UPDATED: 'Metadata Updated',
  SYNC_STARTED: 'Sync Started',
  SYNC_COMPLETED: 'Sync Completed',
  SYNC_FAILED: 'Sync Failed',
  BACKUP_STARTED: 'Backup Started',
  BACKUP_COMPLETED: 'Backup Completed',
  BACKUP_FAILED: 'Backup Failed',
  SYSTEM_ERROR: 'System Error',
  SYSTEM_WARNING: 'System Warning',
  SYSTEM_INFO: 'System Information',
  USER_ACTION: 'User Action',
  // Suwayomi events
  SUWAYOMI_SERVER_CONNECTED: 'Suwayomi Connected',
  SUWAYOMI_SERVER_DISCONNECTED: 'Suwayomi Disconnected',
  SUWAYOMI_SERVER_HEALTH_CHECK_FAILED: 'Suwayomi Health Check Failed',
  SUWAYOMI_SOURCE_INSTALLED: 'Source Installed',
  SUWAYOMI_SOURCE_UNINSTALLED: 'Source Uninstalled',
  SUWAYOMI_SEARCH_STARTED: 'Search Started',
  SUWAYOMI_SEARCH_COMPLETED: 'Search Completed',
  SUWAYOMI_SEARCH_FAILED: 'Search Failed',
  SUWAYOMI_CHAPTER_DOWNLOAD_STARTED: 'Chapter Download Started',
  SUWAYOMI_CHAPTER_DOWNLOAD_COMPLETED: 'Chapter Download Completed',
  SUWAYOMI_CHAPTER_DOWNLOAD_FAILED: 'Chapter Download Failed',
  SUWAYOMI_MANGA_FETCHED: 'Manga Fetched',
  SUWAYOMI_CHAPTERS_FETCHED: 'Chapters Fetched',
  // Native Download events
  NATIVE_DOWNLOAD_SOURCE_INITIALIZED: 'Native Download Source Initialized',
  NATIVE_DOWNLOAD_SOURCE_VALIDATION_STARTED: 'Source Validation Started',
  NATIVE_DOWNLOAD_SOURCE_VALIDATION_COMPLETED: 'Source Validation Completed',
  NATIVE_DOWNLOAD_SOURCE_VALIDATION_FAILED: 'Source Validation Failed',
  NATIVE_DOWNLOAD_SOURCE_ERROR: 'Native Download Source Error',
  NATIVE_DOWNLOAD_QUEUED: 'Download Queued',
  NATIVE_DOWNLOAD_STARTED: 'Native Download Started',
  NATIVE_DOWNLOAD_PROGRESS: 'Download Progress',
  NATIVE_DOWNLOAD_COMPLETED: 'Native Download Completed',
  NATIVE_DOWNLOAD_FAILED: 'Native Download Failed',
  NATIVE_DOWNLOAD_MANAGER_INITIALIZED: 'Native Download Manager Initialized',
  // Prowlarr events
  PROWLARR_CONNECTED: 'Prowlarr Connected',
  PROWLARR_DISCONNECTED: 'Prowlarr Disconnected',
  PROWLARR_CONNECTION_TEST_SUCCESSFUL: 'Connection Test Successful',
  PROWLARR_CONNECTION_TEST_FAILED: 'Connection Test Failed',
  PROWLARR_INDEXER_TEST_FAILED: 'Indexer Test Failed',
  PROWLARR_SEARCH_STARTED: 'Prowlarr Search Started',
  PROWLARR_SEARCH_COMPLETED: 'Prowlarr Search Completed',
  PROWLARR_SEARCH_FAILED: 'Prowlarr Search Failed',
  SUWAYOMI_EXTENSION_UPDATED: 'Extension Updated',
  SUWAYOMI_EXTENSION_INSTALLED: 'Extension Installed',
  SUWAYOMI_EXTENSION_UNINSTALLED: 'Extension Uninstalled',
  SUWAYOMI_BACKUP_CREATED: 'Backup Created',
  SUWAYOMI_BACKUP_RESTORED: 'Backup Restored',
  SUWAYOMI_BACKUP_FAILED: 'Backup Failed',
  SUWAYOMI_LIBRARY_UPDATED: 'Library Updated',
  SUWAYOMI_UPDATE_CHECK_STARTED: 'Update Check Started',
  SUWAYOMI_UPDATE_CHECK_COMPLETED: 'Update Check Completed',
  SUWAYOMI_UPDATE_CHECK_FAILED: 'Update Check Failed',
  SUWAYOMI_DOWNLOAD_QUEUE_UPDATED: 'Download Queue Updated',
  SUWAYOMI_SETTING_CHANGED: 'Setting Changed',
  SUWAYOMI_CATEGORY_CREATED: 'Category Created',
  SUWAYOMI_CATEGORY_DELETED: 'Category Deleted',
  SUWAYOMI_CATEGORY_UPDATED: 'Category Updated',
  SUWAYOMI_MANGA_MIGRATED: 'Manga Migrated',
  SUWAYOMI_TRACKER_LOGIN_SUCCESS: 'Tracker Login Success',
  SUWAYOMI_TRACKER_LOGIN_FAILED: 'Tracker Login Failed',
  SUWAYOMI_TRACKER_UPDATE_SUCCESS: 'Tracker Update Success',
  SUWAYOMI_TRACKER_UPDATE_FAILED: 'Tracker Update Failed',
  // Additional events
  TASK_STARTED: 'Task Started',
  TASK_COMPLETED: 'Task Completed',
  TASK_FAILED: 'Task Failed',
  DOWNLOAD_STARTED: 'Download Started',
  DOWNLOAD_COMPLETED: 'Download Completed',
  DOWNLOAD_FAILED: 'Download Failed',
  UPDATE_AVAILABLE: 'Update Available',
  UPDATE_INSTALLED: 'Update Installed',
  UPDATE_FAILED: 'Update Failed',
  LIBRARY_SCAN_STARTED: 'Library Scan Started',
  LIBRARY_SCAN_COMPLETED: 'Library Scan Completed',
  LIBRARY_SCAN_FAILED: 'Library Scan Failed',
  USER_LOGIN: 'User Login',
  USER_LOGOUT: 'User Logout',
  USER_REGISTERED: 'User Registered',
  SETTINGS_CHANGED: 'Settings Changed',
  API_ERROR: 'API Error',
  API_WARNING: 'API Warning'
};

// Event colors mapping (for Discord embeds)
export const EVENT_COLORS: Record<NotificationEventType, number> = {
  MANGA_ADDED: 0x4CAF50,
  MANGA_UPDATED: 0x2196F3,
  MANGA_DELETED: 0xF44336,
  CHAPTER_ADDED: 0x00BCD4,
  CHAPTER_DOWNLOADED: 0x4CAF50,
  CHAPTER_FAILED: 0xF44336,
  VOLUME_ADDED: 0x9C27B0,
  VOLUME_DOWNLOADED: 0x4CAF50,
  METADATA_UPDATED: 0xFF9800,
  SYNC_STARTED: 0x2196F3,
  SYNC_COMPLETED: 0x4CAF50,
  SYNC_FAILED: 0xF44336,
  BACKUP_STARTED: 0x2196F3,
  BACKUP_COMPLETED: 0x4CAF50,
  BACKUP_FAILED: 0xF44336,
  SYSTEM_ERROR: 0xF44336,
  SYSTEM_WARNING: 0xFF9800,
  SYSTEM_INFO: 0x2196F3,
  USER_ACTION: 0x607D8B,
  // Suwayomi events
  SUWAYOMI_SERVER_CONNECTED: 0x4CAF50,
  SUWAYOMI_SERVER_DISCONNECTED: 0xF44336,
  SUWAYOMI_SERVER_HEALTH_CHECK_FAILED: 0xFF9800,
  SUWAYOMI_SOURCE_INSTALLED: 0x4CAF50,
  SUWAYOMI_SOURCE_UNINSTALLED: 0x607D8B,
  SUWAYOMI_SEARCH_STARTED: 0x2196F3,
  SUWAYOMI_SEARCH_COMPLETED: 0x4CAF50,
  SUWAYOMI_SEARCH_FAILED: 0xF44336,
  SUWAYOMI_CHAPTER_DOWNLOAD_STARTED: 0x2196F3,
  SUWAYOMI_CHAPTER_DOWNLOAD_COMPLETED: 0x4CAF50,
  SUWAYOMI_CHAPTER_DOWNLOAD_FAILED: 0xF44336,
  SUWAYOMI_MANGA_FETCHED: 0x9C27B0,
  SUWAYOMI_CHAPTERS_FETCHED: 0x9C27B0,
  // Native Download events
  NATIVE_DOWNLOAD_SOURCE_INITIALIZED: 0x4CAF50,
  NATIVE_DOWNLOAD_SOURCE_VALIDATION_STARTED: 0x2196F3,
  NATIVE_DOWNLOAD_SOURCE_VALIDATION_COMPLETED: 0x4CAF50,
  NATIVE_DOWNLOAD_SOURCE_VALIDATION_FAILED: 0xF44336,
  NATIVE_DOWNLOAD_SOURCE_ERROR: 0xF44336,
  NATIVE_DOWNLOAD_QUEUED: 0x2196F3,
  NATIVE_DOWNLOAD_STARTED: 0x2196F3,
  NATIVE_DOWNLOAD_PROGRESS: 0xFF9800,
  NATIVE_DOWNLOAD_COMPLETED: 0x4CAF50,
  NATIVE_DOWNLOAD_FAILED: 0xF44336,
  NATIVE_DOWNLOAD_MANAGER_INITIALIZED: 0x4CAF50,
  // Prowlarr events
  PROWLARR_CONNECTED: 0x4CAF50,
  PROWLARR_DISCONNECTED: 0xF44336,
  PROWLARR_CONNECTION_TEST_SUCCESSFUL: 0x4CAF50,
  PROWLARR_CONNECTION_TEST_FAILED: 0xF44336,
  PROWLARR_INDEXER_TEST_FAILED: 0xFF9800,
  PROWLARR_SEARCH_STARTED: 0x2196F3,
  PROWLARR_SEARCH_COMPLETED: 0x4CAF50,
  PROWLARR_SEARCH_FAILED: 0xF44336,
  SUWAYOMI_EXTENSION_UPDATED: 0xFF9800,
  SUWAYOMI_EXTENSION_INSTALLED: 0x4CAF50,
  SUWAYOMI_EXTENSION_UNINSTALLED: 0x607D8B,
  SUWAYOMI_BACKUP_CREATED: 0x4CAF50,
  SUWAYOMI_BACKUP_RESTORED: 0x00BCD4,
  SUWAYOMI_BACKUP_FAILED: 0xF44336,
  SUWAYOMI_LIBRARY_UPDATED: 0x9C27B0,
  SUWAYOMI_UPDATE_CHECK_STARTED: 0x2196F3,
  SUWAYOMI_UPDATE_CHECK_COMPLETED: 0x4CAF50,
  SUWAYOMI_UPDATE_CHECK_FAILED: 0xF44336,
  SUWAYOMI_DOWNLOAD_QUEUE_UPDATED: 0x00BCD4,
  SUWAYOMI_SETTING_CHANGED: 0x607D8B,
  SUWAYOMI_CATEGORY_CREATED: 0x4CAF50,
  SUWAYOMI_CATEGORY_DELETED: 0xF44336,
  SUWAYOMI_CATEGORY_UPDATED: 0xFF9800,
  SUWAYOMI_MANGA_MIGRATED: 0x9C27B0,
  SUWAYOMI_TRACKER_LOGIN_SUCCESS: 0x4CAF50,
  SUWAYOMI_TRACKER_LOGIN_FAILED: 0xF44336,
  SUWAYOMI_TRACKER_UPDATE_SUCCESS: 0x4CAF50,
  SUWAYOMI_TRACKER_UPDATE_FAILED: 0xF44336,
  // Additional events
  TASK_STARTED: 0x2196F3,
  TASK_COMPLETED: 0x4CAF50,
  TASK_FAILED: 0xF44336,
  DOWNLOAD_STARTED: 0x2196F3,
  DOWNLOAD_COMPLETED: 0x4CAF50,
  DOWNLOAD_FAILED: 0xF44336,
  UPDATE_AVAILABLE: 0x00BCD4,
  UPDATE_INSTALLED: 0x4CAF50,
  UPDATE_FAILED: 0xF44336,
  LIBRARY_SCAN_STARTED: 0x2196F3,
  LIBRARY_SCAN_COMPLETED: 0x4CAF50,
  LIBRARY_SCAN_FAILED: 0xF44336,
  USER_LOGIN: 0x4CAF50,
  USER_LOGOUT: 0x607D8B,
  USER_REGISTERED: 0x00BCD4,
  SETTINGS_CHANGED: 0x607D8B,
  API_ERROR: 0xF44336,
  API_WARNING: 0xFF9800
};

// Default values
export const DEFAULT_EVENT_EMOJI = '📢';
export const DEFAULT_EVENT_TITLE = 'Notification';
export const DEFAULT_EVENT_COLOR = 0x607D8B;

// Legacy mappings for backward compatibility
export const LEGACY_EVENT_EMOJIS = EVENT_EMOJIS;
export const LEGACY_EVENT_TITLES = EVENT_TITLES;
export const LEGACY_EVENT_COLORS = EVENT_COLORS;

// Helper functions to categorize individual event types
function categorizeCoreEvents(event: NotificationEventType, categories: Record<string, NotificationEventType[]>): boolean {
  if (event.startsWith('MANGA_')) {
    categories["manga"]?.push(event);
    return true;
  }
  if (event.startsWith('CHAPTER_')) {
    categories["chapter"]?.push(event);
    return true;
  }
  if (event.startsWith('VOLUME_')) {
    categories["volume"]?.push(event);
    return true;
  }
  return false;
}

function categorizeSyncBackupEvents(event: NotificationEventType, categories: Record<string, NotificationEventType[]>): boolean {
  if (event.startsWith('SYNC_')) {
    categories["sync"]?.push(event);
    return true;
  }
  if (event.startsWith('BACKUP_')) {
    categories["backup"]?.push(event);
    return true;
  }
  return false;
}

function categorizeSystemEvents(event: NotificationEventType, categories: Record<string, NotificationEventType[]>): boolean {
  if (event.startsWith('SYSTEM_')) {
    categories["system"]?.push(event);
    return true;
  }
  if (event.startsWith('SUWAYOMI_')) {
    categories["suwayomi"]?.push(event);
    return true;
  }
  return false;
}

function categorizeTaskDownloadEvents(event: NotificationEventType, categories: Record<string, NotificationEventType[]>): boolean {
  if (event.startsWith('TASK_')) {
    categories["task"]?.push(event);
    return true;
  }
  if (event.startsWith('DOWNLOAD_')) {
    categories["download"]?.push(event);
    return true;
  }
  if (event.startsWith('UPDATE_')) {
    categories["update"]?.push(event);
    return true;
  }
  return false;
}

function categorizeUserApiEvents(event: NotificationEventType, categories: Record<string, NotificationEventType[]>): boolean {
  if (event.startsWith('LIBRARY_')) {
    categories["library"]?.push(event);
    return true;
  }
  if (event.startsWith('USER_')) {
    categories["user"]?.push(event);
    return true;
  }
  if (event.startsWith('API_')) {
    categories["api"]?.push(event);
    return true;
  }
  if (event.startsWith('SETTINGS_')) {
    categories["settings"]?.push(event);
    return true;
  }
  return false;
}

function categorizeEvent(event: NotificationEventType, categories: Record<string, NotificationEventType[]>): void {
  if (categorizeCoreEvents(event, categories)) return;
  if (categorizeSyncBackupEvents(event, categories)) return;
  if (categorizeSystemEvents(event, categories)) return;
  if (categorizeTaskDownloadEvents(event, categories)) return;
  if (categorizeUserApiEvents(event, categories)) return;

  // Default to system category for any unmapped events
  categories["system"]?.push(event);
}

// Helper function to group events by category
export function groupEventsByCategory(events: NotificationEventType[]): Record<string, NotificationEventType[]> {
  const categories: Record<string, NotificationEventType[]> = {
    manga: [],
    chapter: [],
    volume: [],
    sync: [],
    backup: [],
    system: [],
    suwayomi: [],
    task: [],
    download: [],
    update: [],
    library: [],
    user: [],
    api: [],
    settings: []
  };

  events.forEach(event => categorizeEvent(event, categories));

  return categories;
}