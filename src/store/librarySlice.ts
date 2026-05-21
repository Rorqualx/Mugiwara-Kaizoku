/**
 * Library Store Slice Module
 * 
 * This module manages the state for manga libraries and their scanning operations.
 * It handles:
 * - Library management (CRUD operations)
 * - Library selection
 * - Scanning operations and progress tracking
 * - Path management for scans
 * 
 * @module librarySlice
 */

import { createIdleResult } from '../utils/async-result';

import { createAppSlice } from './createStore';

import type { AsyncResult} from '../utils/async-result';
import type { Library, Prisma } from '@prisma/client';

type LibraryWithRelations = Prisma.LibraryGetPayload<{
  include: {
    Manga: true;
  };
}>;

/**
 * Scan progress tracking interface
 */
export interface ScanProgress {
  total: number;
  current: number;
  status: string;
}

/**
 * Library state data interface
 */
export type LibraryStateData = {
  libraries: Library[];
  selectedLibraryId: number | null;
  scanning: boolean;
  lastScanTime: Date | null;
  scanProgress: ScanProgress;
  scanPath: string;
  targetLibraryId: number | null;
  librariesResult: AsyncResult<Library[], Error>;
  libraryDetailResult: AsyncResult<LibraryWithRelations, Error>;
} & Record<string, unknown>;

/**
 * Library state actions interface
 */
export type LibraryActions = {
  // Synchronous actions
  setLibraries: (libraries: Library[]) => void;
  selectLibrary: (id: number | null) => void;
  addLibrary: (library: Library) => void;
  removeLibrary: (id: number) => void;
  updateLibrary: (id: number, updates: Partial<Library>) => void;
  setScanningStatus: (scanning: boolean, status?: string) => void;
  updateScanProgress: (progress: Partial<ScanProgress>) => void;
  resetScanProgress: () => void;
  setScanPath: (path: string) => void;
  setTargetLibraryId: (id: number | null) => void;
  setLastScanTime: (time: Date | null) => void;
  
  // Async result setters
  setLibrariesResult: (result: AsyncResult<Library[], Error>) => void;
  setLibraryDetailResult: (result: AsyncResult<LibraryWithRelations, Error>) => void;
} & Record<string, unknown>;

/**
 * Combined library state type
 */
export type LibraryState = LibraryStateData & LibraryActions;

/**
 * Initial library state
 * 
 * Provides default values for all library-related state:
 * - Empty libraries array
 * - No selected library
 * - No active scan
 * - Empty scan progress
 * - AsyncResult in idle state
 */
const initialState: LibraryStateData = {
  libraries: [],
  selectedLibraryId: null,
  scanning: false,
  lastScanTime: null,
  scanProgress: {
    total: 0,
    current: 0,
    status: '',
  },
  scanPath: '',
  targetLibraryId: null,
  librariesResult: createIdleResult<Library[], Error>(),
  libraryDetailResult: createIdleResult<LibraryWithRelations, Error>(),
};

/**
 * Library store slice
 * 
 * Creates a store slice with state and actions for managing libraries.
 * Uses immer for immutable state updates.
 * 
 * @example
 * // Add a new library
 * useLibraryStore.getState().addLibrary({
 *   id: 1,
 *   name: 'Manga Collection',
 *   path: '/path/to/manga'
 * });
 * 
 * // Update scan progress
 * useLibraryStore.getState().updateScanProgress({
 *   current: 50,
 *   total: 100,
 *   status: 'Scanning chapter files...'
 * });
 */
export const useLibraryStore = createAppSlice<
  LibraryStateData,
  LibraryActions
>(
  initialState,
  'library',
  {
    // Exclude large data fields from localStorage to prevent quota exceeded errors
    // These are fetched fresh from the server on each page load
    excludeFromPersist: [
      'libraries',           // Can contain hundreds of manga with metadata
      'librariesResult',     // AsyncResult wrapper - redundant with libraries
      'libraryDetailResult', // AsyncResult wrapper - fetched on demand
      'lastScanTime',        // Transient - derived from library data
      'scanProgress',        // Transient state - reset on page load
    ],
  }
)((set, _get) => ({
  ...initialState,
  setLibraries: (libraries: Library[]) =>
    set((state) => {
      // Direct assignment without comparison to avoid potential infinite loops
      state.libraries = libraries;
    }),
  selectLibrary: (id: number | null) =>
    set((state) => {
      state.selectedLibraryId = id;
    }),
  addLibrary: (library: Library) =>
    set((state) => {
      state.libraries.push(library);
    }),
  removeLibrary: (id: number) =>
    set((state) => {
      state.libraries = state.libraries.filter((lib) => lib["id"] !== id);
      if (state.selectedLibraryId === id) {
        state.selectedLibraryId = null;
      }
    }),
  updateLibrary: (id: number, updates: Partial<Library>) =>
    set((state) => {
      const index = state.libraries.findIndex((lib) => lib["id"] === id);
      if (index !== -1) {
        const currentLibrary = state.libraries[index];
        if (currentLibrary) {
          state.libraries[index] = {
            ...currentLibrary,
            ...updates,
          };
        }
      }
    }),
  setScanningStatus: (scanning: boolean, status = '') =>
    set((state) => {
      state.scanning = scanning;
      if (scanning) {
        state.scanProgress["status"] = status;
      } else {
        state.lastScanTime = new Date();
        state.scanProgress = initialState.scanProgress;
      }
    }),
  updateScanProgress: (progress: Partial<ScanProgress>) =>
    set((state) => {
      state.scanProgress = { ...state.scanProgress, ...progress };
    }),
  resetScanProgress: () =>
    set((state) => {
      state.scanProgress = initialState.scanProgress;
    }),
  setScanPath: (path: string) =>
    set((state) => {
      state.scanPath = path;
    }),
  setTargetLibraryId: (id: number | null) =>
    set((state) => {
      // Only update if the value is different to prevent unnecessary state updates
      if (state.targetLibraryId !== id) {
        state.targetLibraryId = id;
      }
    }),
  setLastScanTime: (time: Date | null) =>
    set((state) => {
      state.lastScanTime = time;
    }),
  setLibrariesResult: (result: AsyncResult<Library[], Error>) =>
    set((state) => {
      state.librariesResult = result;
    }),
  setLibraryDetailResult: (result: AsyncResult<LibraryWithRelations, Error>) =>
    set((state) => {
      state.libraryDetailResult = result;
    }),
}));