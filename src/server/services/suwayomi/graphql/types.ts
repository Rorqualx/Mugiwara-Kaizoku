/**
 * Suwayomi GraphQL Types
 *
 * TypeScript type definitions matching the Suwayomi GraphQL schema.
 * These types are used by the urql client and throughout the application
 * for type-safe interactions with the Suwayomi server.
 *
 * @module suwayomi/graphql/types
 */

// =============================================================================
// Core Enums
// =============================================================================

/**
 * Download status enum
 */
export enum DownloaderState {
  STARTED = 'STARTED',
  STOPPED = 'STOPPED',
}

/**
 * Chapter download state
 */
export enum ChapterDownloadState {
  QUEUED = 'QUEUED',
  DOWNLOADING = 'DOWNLOADING',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR',
}

/**
 * Library update status
 */
export enum LibraryUpdateStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PENDING = 'PENDING',
  COMPLETE = 'COMPLETE',
}

/**
 * Manga status
 */
export enum MangaStatus {
  UNKNOWN = 'UNKNOWN',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  LICENSED = 'LICENSED',
  PUBLISHING_FINISHED = 'PUBLISHING_FINISHED',
  CANCELLED = 'CANCELLED',
  ON_HIATUS = 'ON_HIATUS',
}

/**
 * Update strategy
 */
export enum UpdateStrategy {
  ALWAYS_UPDATE = 'ALWAYS_UPDATE',
  ONLY_FETCH_ONCE = 'ONLY_FETCH_ONCE',
}

/**
 * Tracker status
 */
export enum TrackerStatus {
  READING = 'READING',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  DROPPED = 'DROPPED',
  PLAN_TO_READ = 'PLAN_TO_READ',
  REREADING = 'REREADING',
}

// =============================================================================
// Node Types (Base GraphQL Objects)
// =============================================================================

/**
 * Base node interface with ID
 */
export interface NodeType {
  id: number;
}

/**
 * Source/Extension information
 */
export interface SourceType extends NodeType {
  id: number;
  name: string;
  lang: string;
  iconUrl: string;
  supportsLatest: boolean;
  isConfigurable: boolean;
  isNsfw: boolean;
  displayName: string;
  extension: ExtensionType;
}

/**
 * Extension information
 */
export interface ExtensionType extends NodeType {
  pkgName: string;
  name: string;
  lang: string;
  versionCode: number;
  versionName: string;
  iconUrl: string;
  repo: string | null;
  isNsfw: boolean;
  isInstalled: boolean;
  hasUpdate: boolean;
  isObsolete: boolean;
}

/**
 * Manga information
 */
export interface MangaType extends NodeType {
  id: number;
  sourceId: string;
  url: string;
  title: string;
  thumbnailUrl: string | null;
  thumbnailUrlLastFetched: number;
  initialized: boolean;
  artist: string | null;
  author: string | null;
  description: string | null;
  genre: string[];
  status: MangaStatus;
  inLibrary: boolean;
  inLibraryAt: number;
  source: SourceType | null;
  realUrl: string | null;
  lastFetchedAt: number;
  chaptersLastFetchedAt: number;
  updateStrategy: UpdateStrategy;
  freshData: boolean;
  unreadCount: number;
  downloadCount: number;
  chapterCount: number;
  lastReadChapter: ChapterType | null;
  latestFetchedChapter: ChapterType | null;
  latestReadChapter: ChapterType | null;
  latestUploadedChapter: ChapterType | null;
  chapters: ChapterNodeList;
  age: number | null;
  trackRecords: TrackRecordNodeList;
  categories: CategoryNodeList;
}

/**
 * Chapter information
 */
export interface ChapterType extends NodeType {
  id: number;
  url: string;
  name: string;
  uploadDate: number;
  chapterNumber: number;
  scanlator: string | null;
  mangaId: number;
  isRead: boolean;
  isBookmarked: boolean;
  pageCount: number;
  lastPageRead: number;
  lastReadAt: number;
  sourceOrder: number;
  realUrl: string | null;
  fetchedAt: number;
  isDownloaded: boolean;
  manga: MangaType;
}

/**
 * Category information
 */
export interface CategoryType extends NodeType {
  id: number;
  order: number;
  name: string;
  default: boolean;
  includeInUpdate: boolean;
  includeInDownload: boolean;
  mangas: MangaNodeList;
}

/**
 * Track record information
 */
export interface TrackRecordType extends NodeType {
  id: number;
  mangaId: number;
  trackerId: number;
  remoteId: number;
  libraryId: number | null;
  title: string;
  lastChapterRead: number;
  totalChapters: number;
  score: number;
  status: TrackerStatus;
  startDate: string;
  finishDate: string;
  displayScore: string;
  tracker: TrackerType;
}

/**
 * Tracker information
 */
export interface TrackerType extends NodeType {
  id: number;
  name: string;
  icon: string;
  isLoggedIn: boolean;
  authUrl: string | null;
  scores: string[];
  statuses: TrackStatusType[];
}

/**
 * Tracker status type
 */
export interface TrackStatusType {
  value: TrackerStatus;
  name: string;
}

// =============================================================================
// Download Types
// =============================================================================

/**
 * Download status information
 */
export interface DownloadStatus {
  state: DownloaderState;
  queue: DownloadType[];
}

/**
 * Single download item
 */
export interface DownloadType {
  chapter: ChapterType;
  progress: number;
  state: ChapterDownloadState;
  tries: number;
}

// =============================================================================
// Node List Types (Paginated Collections)
// =============================================================================

/**
 * Page info for pagination
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

/**
 * Edge type for cursor-based pagination
 */
export interface Edge<T> {
  cursor: string;
  node: T;
}

/**
 * Generic node list with pagination
 */
export interface NodeList<T> {
  nodes: T[];
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
}

// Specific node list types
export type MangaNodeList = NodeList<MangaType>;
export type ChapterNodeList = NodeList<ChapterType>;
export type SourceNodeList = NodeList<SourceType>;
export type ExtensionNodeList = NodeList<ExtensionType>;
export type CategoryNodeList = NodeList<CategoryType>;
export type TrackRecordNodeList = NodeList<TrackRecordType>;

// =============================================================================
// Query Response Types
// =============================================================================

/**
 * Single manga query response
 */
export interface MangaQueryResponse {
  manga: MangaType;
}

/**
 * Manga list query response
 */
export interface MangasQueryResponse {
  mangas: MangaNodeList;
}

/**
 * Chapters query response
 */
export interface ChaptersQueryResponse {
  chapters: ChapterNodeList;
}

/**
 * Single chapter query response
 */
export interface ChapterQueryResponse {
  chapter: ChapterType;
}

/**
 * Sources query response
 */
export interface SourcesQueryResponse {
  sources: SourceNodeList;
}

/**
 * Extensions query response
 */
export interface ExtensionsQueryResponse {
  extensions: ExtensionNodeList;
}

/**
 * Categories query response
 */
export interface CategoriesQueryResponse {
  categories: CategoryNodeList;
}

/**
 * Download status query response
 */
export interface DownloadStatusQueryResponse {
  downloadStatus: DownloadStatus;
}

/**
 * Source search result
 */
export interface SourceSearchResult {
  fetchSourceManga: {
    mangas: MangaType[];
    hasNextPage: boolean;
  };
}

/**
 * Trackers query response
 */
export interface TrackersQueryResponse {
  trackers: {
    nodes: TrackerType[];
  };
}

// =============================================================================
// Mutation Response Types
// =============================================================================

/**
 * Enqueue chapter downloads response
 */
export interface EnqueueChapterDownloadsResponse {
  enqueueChapterDownloads: {
    downloadStatus: DownloadStatus;
  };
}

/**
 * Dequeue chapter downloads response
 */
export interface DequeueChapterDownloadsResponse {
  dequeueChapterDownloads: {
    downloadStatus: DownloadStatus;
  };
}

/**
 * Start downloader response
 */
export interface StartDownloaderResponse {
  startDownloader: {
    downloadStatus: DownloadStatus;
  };
}

/**
 * Stop downloader response
 */
export interface StopDownloaderResponse {
  stopDownloader: {
    downloadStatus: DownloadStatus;
  };
}

/**
 * Clear downloader response
 */
export interface ClearDownloaderResponse {
  clearDownloader: {
    downloadStatus: DownloadStatus;
  };
}

/**
 * Update chapter response
 */
export interface UpdateChapterResponse {
  updateChapter: {
    chapter: ChapterType;
  };
}

/**
 * Update chapters response
 */
export interface UpdateChaptersResponse {
  updateChapters: {
    chapters: ChapterType[];
  };
}

/**
 * Fetch chapters response
 */
export interface FetchChaptersResponse {
  fetchChapters: {
    chapters: ChapterType[];
  };
}

/**
 * Install extension response
 */
export interface InstallExtensionResponse {
  installExternalExtension: {
    extension: ExtensionType;
  };
}

/**
 * Update extension response
 */
export interface UpdateExtensionResponse {
  updateExtension: {
    extension: ExtensionType;
  };
}

/**
 * Uninstall extension response
 */
export interface UninstallExtensionResponse {
  uninstallExtension: {
    extension: ExtensionType;
  };
}

/**
 * Bind track response
 */
export interface BindTrackResponse {
  bindTrack: {
    trackRecord: TrackRecordType;
  };
}

/**
 * Update track response
 */
export interface UpdateTrackResponse {
  updateTrack: {
    trackRecord: TrackRecordType;
  };
}

// =============================================================================
// Subscription Payload Types
// =============================================================================

/**
 * Download status changed subscription payload
 */
export interface DownloadStatusChangedPayload {
  downloadChanged: DownloadStatus;
}

/**
 * Library update status changed payload
 */
export interface LibraryUpdateStatusChangedPayload {
  updateStatusChanged: {
    isRunning: boolean;
    completeJobs: {
      mangaId: number;
      status: LibraryUpdateStatus;
    }[];
    failedJobs: {
      mangaId: number;
      status: LibraryUpdateStatus;
    }[];
    pendingJobs: {
      mangaId: number;
      status: LibraryUpdateStatus;
    }[];
    runningJobs: {
      mangaId: number;
      status: LibraryUpdateStatus;
    }[];
    skippedJobs: {
      mangaId: number;
      status: LibraryUpdateStatus;
    }[];
  };
}

// =============================================================================
// Input Types
// =============================================================================

/**
 * Chapter filter input
 */
export interface ChapterFilterInput {
  isRead?: boolean;
  isBookmarked?: boolean;
  isDownloaded?: boolean;
}

/**
 * Manga filter input
 */
export interface MangaFilterInput {
  inLibrary?: boolean;
  hasUnreadChapters?: boolean;
  hasDownloadedChapters?: boolean;
  categoryId?: number;
}

/**
 * Chapter update input
 */
export interface ChapterUpdateInput {
  isRead?: boolean;
  isBookmarked?: boolean;
  lastPageRead?: number;
}

/**
 * Track record update input
 */
export interface TrackRecordUpdateInput {
  status?: TrackerStatus;
  score?: number;
  lastChapterRead?: number;
  startDate?: string;
  finishDate?: string;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * GraphQL variables for paginated queries
 */
export interface PaginationVariables {
  first?: number;
  last?: number;
  before?: string;
  after?: string;
  offset?: number;
}

/**
 * Order by input
 */
export interface OrderByInput {
  by: string;
  byType: 'ASC' | 'DESC';
}

/**
 * Connection arguments for paginated queries
 */
export interface ConnectionArguments extends PaginationVariables {
  filter?: Record<string, unknown>;
  orderBy?: OrderByInput;
}

// =============================================================================
// Client Configuration Types
// =============================================================================

/**
 * Suwayomi GraphQL client configuration
 */
export interface SuwayomiGraphQLConfig {
  /** HTTP endpoint URL */
  httpUrl: string;
  /** WebSocket endpoint URL */
  wsUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to enable debug logging */
  debug?: boolean;
  /** Authentication token (if required) */
  authToken?: string;
  /** Basic auth credentials */
  basicAuth?: {
    username: string;
    password: string;
  };
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect interval in milliseconds */
  reconnectInterval?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
}
