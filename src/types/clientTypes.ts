// Client-side type exports
// This file re-exports Prisma types for client-side use

import { JobType, JobStatus } from '../utils/job-validation';

export {
  UserRole,
  MangaPublicationStatus,
  ChapterStatus,
  EventStatus,
  IntegrationStatus,
  ProviderStatus,
  ProviderType,
  BackupStatus,
  BackupType,
  DownloadStatus,
  DownloadHistoryStatus,
  MangaFileStatus,
  MangaLibraryStatus,
  WantedPriority,
  WantedStatus,
  JobStatus,
  JobType,
  JobPriority,
} from '@prisma/client';

// Compatibility exports for removed/renamed enums
export enum NotificationChannel {
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
  DISCORD = 'DISCORD'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED'
}

export enum NotificationTrigger {
  CHAPTER_RELEASE = 'CHAPTER_RELEASE',
  CHAPTER_DELAYED = 'CHAPTER_DELAYED',
  PATTERN_CHANGED = 'PATTERN_CHANGED'
}

export enum LibraryType {
  LOCAL = 'LOCAL',
  REMOTE = 'REMOTE'
}

export enum SystemStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

export enum CacheType {
  METADATA = 'METADATA',
  IMAGE = 'IMAGE',
  SEARCH = 'SEARCH'
}

export enum DownloadClientType {
  QBITTORRENT = 'QBITTORRENT',
  TRANSMISSION = 'TRANSMISSION',
  SABNZBD = 'SABNZBD'
}

export enum WantedType {
  CHAPTER = 'CHAPTER',
  VOLUME = 'VOLUME'
}

export enum EventType {
  SYSTEM = 'SYSTEM',
  MANGA_UPDATE = 'MANGA_UPDATE',
  CHAPTER_DOWNLOAD = 'CHAPTER_DOWNLOAD',
  ERROR = 'ERROR'
}

export type {
  User,
  Library,
  Manga,
  Chapter,
  Metadata,
  jobs,
  SystemEvent,
  Notification,
  Backup,
  Config,
  CalendarEvent,
  ReleaseSchedule,
  ReleaseHistory,
  ReleaseBlocklist,
} from '@prisma/client';

// Import Config separately for type alias
import type { Config } from '@prisma/client';

// Type aliases for removed models (backwards compatibility)
export type Settings = Config;
export type DownloadHistory = unknown;
export type ReaderBookmark = unknown;
export type ReaderSettings = unknown;
export type ReadingAnalytics = unknown;
export type ReadingHistory = unknown;
export type ReadingProgress = unknown;

// Type aliases for renamed/removed models
export type Provider = unknown;
export type Wanted = unknown;
export type Integration = unknown;
export type Calendar = unknown;
export type UIStateAndActions = unknown;
export function asMangaStoreType(manga: unknown): unknown {
  return manga;
}

// Type aliases for backwards compatibility during migration


// Domain-specific types
export interface JobError {
  code: string;
  message: string;
  details?: unknown;
  jobId?: bigint;
  jobType?: JobType;
}

export interface DomainJob {
  id: bigint;
  jobType: JobType;
  status: JobStatus;
  priority: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  scheduledFor: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  attemptCount: number;
  maxAttempts: number;
  retryDelaySeconds: number;
  lastError?: Record<string, unknown> | null;
  mangaId?: number | null;
  chapterId?: number | null;
}
