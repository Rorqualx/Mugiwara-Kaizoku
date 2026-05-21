/**
 * Store Types Module
 *
 * This module provides type definitions for the application's state management system.
 * It includes interfaces for store slices, actions, and selectors used by Zustand stores.
 *
 * Purpose:
 * - Centralizes store-related type definitions
 * - Ensures type safety across store operations
 * - Provides compatibility with model interfaces
 * - Simplifies maintenance of state management code
 */

import {
  Chapter as _ChapterEntity
} from '@prisma/client';

import type {
  Library as LibraryEntity,
  Manga as MangaEntity,
  ChapterStatus
} from '@prisma/client';


/**
 * Library State Slice
 * Manages libraries and library-related operations
 */
export interface LibraryState {
  libraries: LibraryEntity[];
  selectedLibraryId: number | null;
  scanning: boolean;
  lastScanTime: Date | null;
  scanProgress: {
    total: number;
    current: number;
    status: string;
  };
  scanPath: string;
  targetLibraryId: number | null;
}

/**
 * Library Actions Interface
 * Defines all actions that can be performed on the library state
 */
export interface LibraryActions {
  setLibraries: (libraries: LibraryEntity[]) => void;
  addLibrary: (library: LibraryEntity) => void;
  updateLibrary: (id: number, data: Partial<LibraryEntity>) => void;
  removeLibrary: (id: number) => void;
  selectLibrary: (id: number | null) => void;
  setScanningStatus: (scanning: boolean) => void;
  updateScanProgress: (progress: Partial<LibraryState['scanProgress']>) => void;
  setScanPath: (path: string) => void;
  setTargetLibraryId: (id: number | null) => void;
  resetScanProgress: () => void;
  setLastScanTime: (time: Date) => void;
}

/**
 * Complete Library Store Type
 * Combines state and actions for the library slice
 */
export type LibraryStore = LibraryState & LibraryActions;

/**
 * Manga State Slice
 * Manages manga and their metadata
 */
export interface MangaState {
  mangas: MangaEntity[];
  selectedMangaId: number | null;
  loading: boolean;
  error: string | null;
  filters: Record<string, unknown>;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
}

/**
 * Manga Actions Interface
 * Defines all actions that can be performed on the manga state
 */
export interface MangaActions {
  setMangas: (mangas: MangaEntity[]) => void;
  addManga: (manga: MangaEntity) => void;
  updateManga: (id: number, data: Partial<MangaEntity>) => void;
  removeManga: (id: number) => void;
  selectManga: (id: number | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Record<string, unknown>) => void;
  setSorting: (sortBy: string, direction: 'asc' | 'desc') => void;
  resetFilters: () => void;
}

/**
 * Complete Manga Store Type
 * Combines state and actions for the manga slice
 */
export type MangaStore = MangaState & MangaActions;

/**
 * UI State Slice
 * Manages user interface state like theme, sidebar, modals
 */
export interface UIState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  modalOpen: string | null;
  errors: Record<string, string>;
  notifications: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
    timeout?: number;
  }>;
  loading: boolean;
  filters: Record<string, unknown>;
  deduplicateManga: boolean;
}

/**
 * UI Actions Interface
 * Defines all actions that can be performed on the UI state
 */
export interface UIActions {
  setTheme: (theme: UIState['theme']) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setModalOpen: (modalId: string | null) => void;
  addError: (key: string, error: string) => void;
  clearError: (key: string) => void;
  clearAllErrors: () => void;
  addNotification: (notification: Omit<UIState['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setFilters: (filters: Record<string, unknown>) => void;
  resetFilters: () => void;
  setDeduplicateManga: (enabled: boolean) => void;
}

/**
 * Complete UI Store Type
 * Combines state and actions for the UI slice
 */
export type UIStore = UIState & UIActions;

/**
 * Download Queue State Slice
 * Manages download operations and their status
 */
export interface DownloadQueueState {
  queue: Array<{
    id: string;
    mangaId: number;
    chapterId: number;
    status: ChapterStatus;
    progress: number;
    error?: string;
    addedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
  }>;
  active: boolean;
  paused: boolean;
  concurrentDownloads: number;
}

/**
 * Download Queue Actions Interface
 * Defines all actions that can be performed on the download queue
 */
export interface DownloadQueueActions {
  addToQueue: (mangaId: number, chapterId: number) => void;
  removeFromQueue: (id: string) => void;
  updateQueueItem: (id: string, data: Partial<DownloadQueueState['queue'][0]>) => void;
  clearQueue: () => void;
  startQueue: () => void;
  pauseQueue: () => void;
  resumeQueue: () => void;
  setConcurrentDownloads: (count: number) => void;
}

/**
 * Complete Download Queue Store Type
 * Combines state and actions for the download queue slice
 */
export type DownloadQueueStore = DownloadQueueState & DownloadQueueActions;

/**
 * Integration State Slice
 * Manages external integration settings and status
 */
export interface IntegrationState {
  prowlarrEnabled: boolean;
  prowlarrUrl: string;
  prowlarrApiKey: string;
  prowlarrStatus: 'connected' | 'disconnected' | 'error';
  suwayomiEnabled: boolean;
  suwayomiUrl: string;
  suwayomiStatus: 'connected' | 'disconnected' | 'error';
}

/**
 * Integration Actions Interface
 * Defines all actions that can be performed on the integration state
 */
export interface IntegrationActions {
  setProwlarrEnabled: (enabled: boolean) => void;
  setProwlarrUrl: (url: string) => void;
  setProwlarrApiKey: (key: string) => void;
  setProwlarrStatus: (status: IntegrationState['prowlarrStatus']) => void;
  setSuwayomiEnabled: (enabled: boolean) => void;
  setSuwayomiUrl: (url: string) => void;
  setSuwayomiStatus: (status: IntegrationState['suwayomiStatus']) => void;
}

/**
 * Complete Integration Store Type
 * Combines state and actions for the integration slice
 */
export type IntegrationStore = IntegrationState & IntegrationActions;

/**
 * Type for all store slices
 * Combines all individual store types
 */
export interface RootState {
  library: LibraryState;
  manga: MangaState;
  ui: UIState;
  downloadQueue: DownloadQueueState;
  integration: IntegrationState;
}

export type StoreSlice<T> = (
set: <K extends keyof T>(
fn: (state: T) => Pick<T, K> | T | void)
=> void,
get: () => T,
api: {
  getState: () => T;
  setState: (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void;
})
=> T;