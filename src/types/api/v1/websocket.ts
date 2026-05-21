import type { WebSocketMessageType } from '@prisma/client';
/**
 * API v1 WebSocket Types
 * WebSocket message structures for API version 1
 */

// Re-export WebSocketMessageType from Prisma
export { WebSocketMessageType } from '@prisma/client';

/**
 * Base WebSocket message
 */
export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  id?: string;
  timestamp: string;
  data?: T;
}

/**
 * Auth message
 */
export interface AuthMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    token: string;
  };
}

/**
 * Subscribe message
 */
export interface SubscribeMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    channels: string[];
  };
}

/**
 * Event message
 */
export interface EventMessage<T = unknown> extends WebSocketMessage<{ event: string; payload: T }> {
  type: WebSocketMessageType;
}

/**
 * Download progress message
 */
export interface DownloadProgressMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    taskId: string;
    mangaId: string | number;
    chapterId: string | number;
    progress: number;
    speed?: number;
    eta?: number;
    status: string;
  };
}

/**
 * Task update message
 */
export interface TaskUpdateMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    taskId: string;
    status: string;
    progress?: number;
    result?: unknown;
    error?: string;
  };
}

/**
 * Error message
 */
export interface ErrorMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * WebSocket client state
 * Re-exported from Prisma
 */
export { WebSocketState } from '@prisma/client';

/**
 * WebSocket client options
 */
export interface WebSocketClientOptions {
  url: string;
  token?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  pongTimeout?: number;
}

/**
 * WebSocket event handler
 */
export type WebSocketEventHandler<T = unknown> = (data: T) => void;

/**
 * WebSocket event map
 * Uses separate types to avoid index signature conflicts with exactOptionalPropertyTypes
 */
export type WebSocketEventMap = {
  connect: () => void;
  disconnect: (reason?: string) => void;
  error: (error: Error) => void;
  message: (message: WebSocketMessage) => void;
} & {
  [event: string]: WebSocketEventHandler;
}

/**
 * Channel patterns for WebSocket subscriptions
 */
export const CHANNEL_PATTERNS = {
  // Manga-specific channels
  MANGA_UPDATES: (mangaId: number): string => `manga:${mangaId}:updates`,
  MANGA_CHAPTERS: (mangaId: number): string => `manga:${mangaId}:chapters`,
  LIBRARY_UPDATES: (libraryId: number): string => `library:${libraryId}:updates`,
  /**
   * iter-LIVEBAR: library-wide chapter-update broadcast. emitChapterUpdate
   * fans out to this in addition to the per-manga channels so the library
   * page can invalidate its progress-bar query without subscribing to N
   * per-manga channels.
   */
  LIBRARY_CHAPTER_UPDATES: 'library:chapter-updates',

  // Download channels
  DOWNLOAD_PROGRESS: 'downloads:progress',
  IMPORT_PROGRESS: 'import:progress',
  VOLUME_SPLIT_PROGRESS: 'volume-split:progress',
  METADATA_REFRESH_PROGRESS: (mangaId: number): string => `manga:${mangaId}:metadata-refresh`,

  // Job channels
  JOBS_SYNC: 'jobs:sync',
  JOBS_SCHEDULED: 'jobs:scheduled',
  JOBS_CONVERSION: 'jobs:conversion',

  // System channels
  BACKUP_OPERATIONS: 'backup:operations',
  CALENDAR_SYNC: 'calendar:sync',
  SYSTEM_NOTIFICATIONS: 'system:notifications',
  SYSTEM_EVENTS: 'system:events',

  // FlareSolverr channels
  FLARESOLVERR_METRICS: 'flaresolverr:metrics',

  // Reader channels
  READER_BOOKMARKS: 'reader:bookmarks',
  READER_HISTORY: 'reader:history',
  READING_PROGRESS: 'reading:progress',

  // Tracked download channels
  TRACKED_DOWNLOADS: 'tracked-downloads:state',

  // Search channels
  SEARCH_PROGRESS: 'search:progress',

  // Detection channels
  RELEASES_DETECTED: 'releases:detected',

  // User channels
  USER_NOTIFICATIONS: (userId: string): string => `user:${userId}:notifications`,
};

/**
 * WebSocket event types
 */
export const WS_EVENT_TYPES = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  ERROR: 'error',
  
  // Subscription events
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  
  // Data events
  MANGA_UPDATE: 'manga:update',
  CHAPTER_UPDATE: 'chapter:update',
  DOWNLOAD_PROGRESS: 'download:progress',
  LIBRARY_SCAN: 'library:scan',
  NOTIFICATION: 'notification',
  
  // System events
  PING: 'ping',
  PONG: 'pong',
};

/**
 * WebSocket client interface
 */
export interface WebSocketClient {
  id: string;
  userId?: string;
  channels: Set<string>;
  socket: unknown;
  lastActivity: Date;
}

/**
 * WebSocket event data
 */
export interface WebSocketEvent<T = unknown> {
  id: string;
  type: string;
  channel?: string;
  data: T;
  timestamp: string;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  channels: string[];
  filters?: Record<string, unknown>;
}

/**
 * Presence data for tracking online users
 */
export interface PresenceData {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Scan progress message
 */
export interface ScanProgressMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    libraryId: number;
    progress: number;
    status: string;
    currentFile?: string;
    totalFiles?: number;
  };
}

/**
 * Notification message
 */
export interface NotificationMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    title: string;
    message: string;
    level: string;
    timestamp?: string;
    action?: Record<string, unknown>;
  };
}

/**
 * System status message
 */
export interface SystemStatusMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    status: string;
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    activeJobs?: number;
    queuedJobs?: number;
  };
}

/**
 * Job status message
 */
export interface JobStatusMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    jobId: string;
    status: string;
    progress: number;
    result?: unknown;
    error?: string;
  };
}

/**
 * Manga update message
 */
export interface MangaUpdateMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    mangaId: number;
    action: string;
    data?: unknown;
  };
}

/**
 * Chapter update message
 */
export interface ChapterUpdateMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    chapterId: number;
    action: string;
    data?: unknown;
  };
}

/**
 * Volume update message
 */
export interface VolumeUpdateMessage extends WebSocketMessage {
  type: WebSocketMessageType;
  data: {
    volumeId: number;
    action: string;
    data?: unknown;
  };
}
