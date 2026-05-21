/**
 * Manga Store Slice Module
 * 
 * Manages the state for manga-related data and operations. This slice handles:
 * - Manga list management
 * - Selection state
 * - Filtering and search
 * - Manga metadata updates
 * 
 * Uses Immer for immutable state updates and includes persistence
 * for maintaining state across page reloads.
 * 
 * @module store/mangaSlice
 */

import { createIdleResult } from '../utils/async-result';

import { createAppSlice } from './createStore';

import type { AsyncResult } from '../utils/async-result';
import type { MangaPublicationStatus } from '@prisma/client';
import type { Manga as MangaEntity } from '@prisma/client';
import type { Prisma } from '@prisma/client';

type MangaWithRelations = Prisma.MangaGetPayload<{
  include: {
    library: true;
    Chapter: true;
    Metadata: true;
  };
}>;

/**
 * Manga filter interface
 * 
 * Defines the available filter criteria for manga lists
 */
export interface MangaFilters {
  source: string | null;
  status: MangaPublicationStatus | null;
  searchTerm: string;
}

/**
 * Manga state data interface
 * 
 * Defines the structure of manga-related state data including:
 * - List of manga with their relationships
 * - Currently selected manga
 * - Active filters and search criteria
 * - Async results for various operations
 */
export type MangaStateData = {
  mangaList: MangaEntity[];
  selectedMangaId: number | null;
  filters: MangaFilters;
  mangaListResult: AsyncResult<MangaEntity[], Error>;
  mangaDetailResult: AsyncResult<MangaWithRelations, Error>;
  refreshMetadataResult: AsyncResult<MangaEntity, Error>;
} & Record<string, unknown>;

/**
 * Manga state actions interface
 * 
 * Defines all available actions for manipulating manga state:
 * - List management (set, update, remove)
 * - Selection management
 * - Filter management
 * - Async result setters
 */
export type MangaActions = {
  // Synchronous actions
  setMangaList: (list: MangaEntity[]) => void;
  setSelectedManga: (id: number | null) => void;
  updateManga: (id: number, updates: Partial<MangaEntity>) => void;
  removeManga: (id: number) => void;
  setFilters: (filters: Partial<MangaFilters>) => void;
  resetFilters: () => void;
  
  // Async result setters
  setMangaListResult: (result: AsyncResult<MangaEntity[], Error>) => void;
  setMangaDetailResult: (result: AsyncResult<MangaWithRelations, Error>) => void;
  setRefreshMetadataResult: (result: AsyncResult<MangaEntity, Error>) => void;
} & Record<string, unknown>;

/**
 * Combined manga state type
 * 
 * Combines the data and actions interfaces into a single type
 * representing the complete manga store slice.
 */
export type MangaState = MangaStateData & MangaActions;

/**
 * Initial state for the manga store slice
 * 
 * Defines default values for all manga state properties:
 * - Empty manga list
 * - No selection
 * - Clear filters
 * - Idle async results
 */
const initialState: MangaStateData = {
  mangaList: [],
  selectedMangaId: null,
  filters: {
    source: null,
    status: null,
    searchTerm: '',
  },
  mangaListResult: createIdleResult<MangaEntity[], Error>(),
  mangaDetailResult: createIdleResult<MangaWithRelations, Error>(),
  refreshMetadataResult: createIdleResult<MangaEntity, Error>(),
};

/**
 * Creates the manga store slice with state and actions
 * 
 * Implements the store slice pattern with Immer-powered state updates.
 * Each action is implemented as an immutable state update.
 * 
 * State Updates:
 * - List updates preserve relationship data
 * - Selection changes trigger UI updates
 * - Filter updates affect manga list display
 * 
 * @example
 * ```typescript
 * const { mangaList, setMangaList, updateManga } = useMangaStore();
 * 
 * // Update manga list
 * setMangaList(newList);
 * 
 * // Update specific manga
 * updateManga(123, { title: 'New Title' });
 * ```
 */
 
// Immer draft state mutations are expected and required for Zustand state management
export const useMangaStore = createAppSlice<MangaStateData, MangaActions>(
  initialState,
  'manga'
)((set) => ({
  ...initialState,
  setMangaList: (list: MangaEntity[]) =>
    set((state) => {
      state.mangaList = list;
    }),
  setSelectedManga: (id: number | null) =>
    set((state) => {
      state.selectedMangaId = id;
    }),
  updateManga: (id: number, updates: Partial<MangaEntity>) =>
    set((state) => {
      const index = state.mangaList.findIndex((m) => m.id === id);
      if (index !== -1) {
        const manga = state.mangaList[index];
        if (manga) {
          state.mangaList[index] = {
            ...manga,
            ...updates,
          };
        }
      }
    }),
  removeManga: (id: number) =>
    set((state) => {
      state.mangaList = state.mangaList.filter((m) => m.id !== id);
      if (state.selectedMangaId === id) {
        state.selectedMangaId = null;
      }
    }),
  setFilters: (filters: Partial<MangaFilters>) =>
    set((state) => {
      state.filters = { ...state.filters, ...filters };
    }),
  resetFilters: () =>
    set((state) => {
      state.filters = initialState.filters;
    }),
  setMangaListResult: (result: AsyncResult<MangaEntity[], Error>) =>
    set((state) => {
      state.mangaListResult = result;
    }),
  setMangaDetailResult: (result: AsyncResult<MangaWithRelations, Error>) =>
    set((state) => {
      state.mangaDetailResult = result;
    }),
  setRefreshMetadataResult: (result: AsyncResult<MangaEntity, Error>) =>
    set((state) => {
      state.refreshMetadataResult = result;
    }),
}));
 
