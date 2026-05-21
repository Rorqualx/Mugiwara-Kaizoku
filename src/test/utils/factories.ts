/**
 * Test Data Factories
 *
 * This file contains factory functions for creating test data.
 * Each factory returns an object with default values that can be overridden.
 */

import type { Manga as MangaEntity } from '@prisma/client';

import { createDataFactory } from './testHelpers.helpers';
import { MangaPublicationStatus as MangaStatus, MangaFileStatus, ChapterStatus } from '@prisma/client';
import { Chapter as ChapterEntity } from '@prisma/client';
import type { LibraryEntity } from '@/types/search.types';
import { JobStatus } from '@/utils/job-validation';
// Test-specific User type with numeric IDs for simplicity
// Not using TestUser from types/user as it has string IDs
interface User {
  id: number; // Test uses numeric IDs for simplicity
  name: string;
  email: string;
  avatar: string | null;
  password: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  libraries: unknown[];
  settings: Record<string, unknown> | null;
  events: unknown[];
  tasks: unknown[];
  metadata: Record<string, unknown> | null;
}

// Define a custom TestChapter interface to avoid conflicts with domain types
interface TestChapter {
  id: number;
  title: string;
  fileName: string;
  index: number;
  mangaId: number;
  size: number;
  pageCount: number;
  createdAt: Date;
  updatedAt: Date;
  downloadStatus: ChapterStatus;
  downloadUrl: string | null;
  hash: string | null;
  language: string;
  resolutionWidth: number;
  resolutionHeight: number;
  resolutionLabel: string;
  mimeType: string;
  manga: Partial<MangaEntity> | null;
  tasks: unknown[];
  // Add status field to satisfy ChapterEntity requirements
  status: ChapterStatus;
}

/**
 * Create a test user
 *
 * @example
 * const user = createTestUser({ name: 'Test User' });
 */
export const createTestUser = createDataFactory<User & Record<string, unknown>>({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  avatar: null,
  password: 'hashed_password',
  role: 'USER',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  libraries: [],
  settings: null,
  events: [],
  tasks: [],
  metadata: null,
});

/**
 * Create a test manga
 * 
 * @example
 * const manga = createTestManga({ title: 'One Piece' });
 */
export const createTestManga = createDataFactory<MangaEntity>({
  id: 1,
  title: 'Test Manga',
  source: 'test-source',
  sourceId: 'test-id',
  libraryId: 1,
  metadataId: null,
  lastChecked: null,
  libraryPath: '/path/to/manga',
  mangaTitle: 'Test Manga',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  errorMessage: null,
  lastErrorAt: null,
  lastSyncAt: null,
  summary: 'Test description for manga',
  syncCount: 0,
  publicationStatus: MangaStatus.ONGOING,
  fileStatus: MangaFileStatus.PENDING,
  libraryStatus: 'ACTIVE',
  searchProvider: 'anilist',
  providerMetadata: null,
  rawProviderData: null,
  monitoringConfig: null,
  mlCorrected: false,
  selectedSourceId: null,
  metadataConfidence: null,
  suwayomiPluginConfig: null,
  mediaType: 'MANGA',
});

/**
 * Create a test chapter
 *
 * @example
 * const chapter = createTestChapter({ title: 'Chapter 1' });
 */
export const createTestChapter = createDataFactory<TestChapter & Record<string, unknown>>({
  id: 1,
  title: 'Chapter 1',
  fileName: 'chapter-001.cbz',
  index: 1,
  mangaId: 1,
  size: 1024 * 1024, // 1MB
  pageCount: 22,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  downloadStatus: ChapterStatus.COMPLETED, // Using DOWNLOADED instead of COMPLETED as per ChapterStatus enum
  status: ChapterStatus.COMPLETED, // Added status field to satisfy ChapterEntity requirements
  downloadUrl: null,
  hash: null,
  language: 'en',
  resolutionWidth: 800,
  resolutionHeight: 1200,
  resolutionLabel: 'HD',
  mimeType: 'application/x-cbz',
  manga: null,
  tasks: [],
});

/**
 * Create a test library
 *
 * @example
 * const library = createTestLibrary({ name: 'My Library' });
 */
export const createTestLibrary = createDataFactory<LibraryEntity & Record<string, unknown>>({
  id: 1,
  name: 'Test Library',
  path: '/path/to/library',
  lastScanAt: new Date('2025-01-01T00:00:00Z'),
  createdAt: new Date('2025-01-01T00:00:00Z'),
});

/**
 * Create a test task
 *
 * @example
 * const task = createTestTask({ status: JobStatus.completed });
 */
export const createTestTask = createDataFactory<Record<string, unknown>>({
  id: 1,
  type: 'DOWNLOAD',
  status: JobStatus.pending,
  title: 'Test Task',
  description: 'Test task description',
  progress: 0,
  result: null,
  error: null,
  userId: 1,
  mangaId: 1,
  priority: 'MEDIUM',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  startedAt: null,
  completedAt: null,
  user: null,
  manga: null,
});

/**
 * Create a test download queue item
 *
 * @example
 * const queueItem = createTestDownloadQueueItem({ progress: 75 });
 */
export const createTestDownloadQueueItem = createDataFactory<Record<string, unknown>>({
  id: '1',
  title: 'Test Chapter Download',
  status: 'DOWNLOADING',
  progress: 50,
  url: 'https://example.com/download',
  mangaId: 1,
  chapterId: 1,
  addedAt: new Date('2025-01-01T00:00:00Z'),
  startedAt: new Date('2025-01-01T00:00:01Z'),
  estimatedCompletionAt: new Date('2025-01-01T00:00:30Z'),
  error: null,
});

/**
 * Create a test metadata item
 *
 * @example
 * const metadata = createTestMetadata({ title: 'One Piece' });
 */
export const createTestMetadata = createDataFactory<Record<string, unknown>>({
  id: 1,
  title: 'Test Metadata Title',
  originalTitle: 'Original Title',
  alternativeTitles: ['Alt Title 1', 'Alt Title 2'],
  description: 'Test metadata description',
  genres: ['Action', 'Adventure'],
  status: 'ONGOING',
  year: 2025,
  authors: ['Test Author'],
  publishers: ['Test Publisher'],
  coverUrl: 'https://example.com/cover.jpg',
  bannerUrl: 'https://example.com/banner.jpg',
  score: 8.5,
  popularity: 95,
  source: 'test-provider',
  sourceId: 'test-id-123',
  mangaId: 1,
  manga: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
});

/**
 * Create a test search result
 *
 * @example
 * const searchResult = createTestSearchResult({ title: 'Found Manga' });
 */
export const createTestSearchResult = createDataFactory<Record<string, unknown>>({
  id: 'result-1',
  title: 'Search Result Manga',
  alternativeTitles: ['Alt Title 1', 'Alt Title 2'],
  description: 'Test search result description',
  coverImage: 'https://example.com/cover.jpg',
  score: 8.5,
  status: 'ONGOING',
  provider: 'test-provider',
  sourceId: 'test-id-123',
  year: 2025,
  authors: ['Test Author'],
  genres: ['Action', 'Adventure'],
});

/**
 * Create a test notification
 *
 * @example
 * const notification = createTestNotification({ type: 'error' });
 */
export const createTestNotification = createDataFactory<Record<string, unknown>>({
  id: 'notification-1',
  type: 'info',
  title: 'Test Notification',
  message: 'This is a test notification',
  duration: 5000,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  read: false,
  userId: 1,
});

/**
 * Create a test settings object
 *
 * @example
 * const settings = createTestSettings({ theme: 'dark' });
 */
export const createTestSettings = createDataFactory<Record<string, unknown>>({
  id: 1,
  userId: 1,
  theme: 'light',
  language: 'en',
  notificationsEnabled: true,
  autoScanEnabled: false,
  defaultMetadataProvider: 'anilist',
  downloadsEnabled: true,
  downloadPath: '/path/to/downloads',
  metadataProviders: {
    anilist: { enabled: true },
    comicvine: { enabled: false },
    fandom: { enabled: true },
  },
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  user: null,
});

/**
 * Create a test event
 *
 * @example
 * const event = createTestEvent({ type: 'DOWNLOAD_COMPLETED' });
 */
export const createTestEvent = createDataFactory<Record<string, unknown>>({
  id: 1,
  type: 'MANGA_ADDED',
  title: 'Test Event',
  description: 'Test event description',
  userId: 1,
  resourceId: 1,
  resourceType: 'MANGA',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  data: {},
  user: null,
});