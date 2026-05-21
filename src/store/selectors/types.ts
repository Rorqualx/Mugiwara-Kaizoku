/**
 * Store Selector Type Definitions
 *
 * Core type definitions used across all store selector modules.
 * Provides type-safe interfaces for:
 * - Filter state configuration
 * - Library scanning
 * - Library-manga relationships
 * - Combined selector interface
 *
 * Extracted from: useStoreSelectors.ts (lines 24-201)
 *
 * @module store/selectors/types
 */

import type { DownloadQueueItem } from '../downloadQueueSlice';
import type { Library, Manga } from '@prisma/client';

/**
 * Filter state configuration
 *
 * Defines the structure of manga list filters including:
 * - Search term for text search
 * - Source filters for provider selection
 * - Status filters for manga status
 * - Genre and tag filters for categorization
 *
 * @interface FilterState
 *
 * @example
 * ```typescript
 * const filters: FilterState = {
 *   searchTerm: 'one piece',
 *   sources: ['anilist', 'comicvine'],
 *   status: ['ongoing'],
 *   genres: ['action', 'adventure'],
 *   tags: ['shounen']
 * };
 * ```
 */
export interface FilterState {
  searchTerm: string;
  sources: string[];
  status: string[];
  genres: string[];
  tags: string[];
}

/**
 * Library scan progress information
 *
 * Tracks the progress of library scanning operations:
 * - Current progress (number of items scanned)
 * - Total items to scan
 * - Current scanning status (idle/scanning)
 *
 * @interface ScanProgress
 *
 * @example
 * ```typescript
 * const progress: ScanProgress = {
 *   current: 45,
 *   total: 100,
 *   status: 'scanning'
 * };
 * ```
 */
export interface ScanProgress {
  current: number;
  total: number;
  status: string;
}

/**
 * Library scan configuration
 *
 * Defines settings for library scanning operations:
 * - Path to scan for manga files
 * - Target library ID for scanned items
 *
 * @interface ScanSettings
 *
 * @example
 * ```typescript
 * const settings: ScanSettings = {
 *   scanPath: '/mnt/manga',
 *   targetLibraryId: 1
 * };
 * ```
 */
export interface ScanSettings {
  scanPath: string;
  targetLibraryId: number | null;
}

/**
 * Extended library type with manga relationships
 *
 * Extends the base library type with:
 * - Array of contained manga with basic info
 * - Library metadata (id, name, path)
 * - Creation timestamp
 *
 * @interface LibraryWithMangas
 *
 * @example
 * ```typescript
 * const library: LibraryWithMangas = {
 *   id: 1,
 *   name: 'Main Library',
 *   path: '/mnt/manga',
 *   createdAt: new Date(),
 *   mangas: [
 *     { id: 1, title: 'One Piece' },
 *     { id: 2, title: 'Naruto' }
 *   ]
 * };
 * ```
 */
export interface LibraryWithMangas {
  id: number | string;
  name: string;
  path: string;
  createdAt?: Date | string;
  mangas: Array<{
    id: number | string;
    title: string;
  }>;
}

/**
 * Combined store selectors interface
 *
 * Provides a unified interface for accessing state from all stores:
 * - Manga state and selection
 * - Download queue state
 * - Library information
 * - Integration status
 * - UI state
 * - Theme configuration
 * - TRPC-like selectors for backward compatibility
 *
 * @interface StoreSelectors
 *
 * @example
 * ```typescript
 * const {
 *   selectedManga,
 *   filteredManga,
 *   downloadStats
 * } = useStoreSelectors();
 *
 * // Access selected manga
 * logger.info(selectedManga?.title);
 *
 * // Get filtered manga list
 * const mangaList = filteredManga;
 *
 * // Check download progress
 * const progress = downloadStats.completed / downloadStats.total;
 * ```
 */
export interface StoreSelectors {
  /** Currently selected manga */
  selectedManga: Manga | undefined;

  /** Active downloads currently in progress */
  activeDownloads: DownloadQueueItem[];

  /** Full download queue */
  queue: DownloadQueueItem[];

  /** Out of sync statistics */
  outOfSyncStats: {
    total: number;
    byManga: Record<string, number>;
  };

  /** Currently selected library with manga relationships */
  currentLibrary: LibraryWithMangas | null;

  /** All available libraries */
  libraries: Library[];

  /** Integration service status */
  integrationStatus: {
    komgaEnabled: boolean;
    kavitaEnabled: boolean;
    hasNotifications: boolean;
    isConfigured: boolean;
    syncStatus: {
      komga?: {
        syncing: boolean;
        error: string | null;
        lastSync: Date | null;
      };
      kavita?: {
        syncing: boolean;
        error: string | null;
        lastSync: Date | null;
      };
    };
  };

  /** Global loading state */
  isLoading: boolean;

  /** Global error states by feature */
  errors: Record<string, string | null>;

  /** Current theme mode */
  theme: 'light' | 'dark';

  /** Active filters for manga list */
  filters: FilterState;

  /** Number of queued downloads */
  queuedDownloads: number;

  /** Download statistics */
  downloadStats: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
  };

  /** Library scanning state */
  scanning: boolean;

  /** Library scan progress */
  scanProgress: ScanProgress;

  /** Library scan settings */
  scanSettings: ScanSettings;

  /** Full manga list */
  mangaList: Manga[];

  /** Filtered manga list based on active filters */
  filteredManga: Manga[];

  /** TRPC-like selectors for components that expect them */
  tasks: {
    getByStatus: {
      useQuery: () => {
        data: unknown[];
        isLoading: boolean;
        refetch: () => void;
      };
    };
    retry: {
      useMutation: (options?: unknown) => {
        mutate: (data?: unknown) => void;
        mutateAsync: (data?: unknown) => Promise<unknown>;
        isLoading: boolean;
      };
    };
  };

  /** Legacy TRPC selectors - manga operations */
  manga: unknown;

  /** Legacy TRPC selectors - library operations */
  library: unknown;

  /** Legacy TRPC selectors - source operations */
  sources: unknown;

  /** Legacy TRPC selectors - settings operations */
  settings: unknown;
}
