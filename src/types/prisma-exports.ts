// Re-export Prisma types for use throughout the application
export { PrismaClient } from '@prisma/client';

export type {
  User,
  Session,
  Account,
  VerificationToken,
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
  NativeDownload,
  ConversionJob,
  ParserCache,
  BackupItem,
  Prisma,
} from '@prisma/client';

// Import Config separately for type alias
import type { Config } from '@prisma/client';

// Type aliases for removed models (backwards compatibility)
export type Settings = Config;
export type DownloadHistory = unknown;
export type ApiKey = unknown;
export type Webhook = unknown;
export type ReaderBookmark = unknown;
export type ReaderSettings = unknown;
export type ReadingAnalytics = unknown;
export type ReadingHistory = unknown;
export type ReadingProgress = unknown;

// Type aliases for removed models
export type Provider = unknown;
export type Wanted = unknown;
export type Integration = unknown;
export type Calendar = unknown;

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
  BackupContent,
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

// Re-export compatibility enums from clientTypes
export {
  NotificationChannel,
  NotificationStatus,
  NotificationTrigger,
  LibraryType,
  SystemStatus,
  CacheType,
  DownloadClientType,
  WantedType,
  EventType
} from './clientTypes';
