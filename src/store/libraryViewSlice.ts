/**
 * Library View Store Slice Module
 *
 * This module manages the view state for the library display.
 * It handles:
 * - View type selection (posters, table, details)
 * - Sorting options
 * - Filtering options
 * - Search queries
 * - Selected items for bulk actions
 * - View preferences (covers, progress)
 *
 * State is persisted to localStorage for a consistent user experience.
 *
 * @module libraryViewSlice
 */

 
// Note: no-param-reassign is disabled for this file because we're using Immer
// via Zustand's createAppSlice, which safely handles draft state mutations.
// All state.property = value assignments are operating on Immer draft proxies,
// not the actual state object, making them safe and the recommended pattern.

import { createAppSlice } from './createStore';

/**
 * Sort options for library display
 */
export type SortOption = 
  | 'alphabetical' 
  | 'alphabetical-desc' 
  | 'date-added' 
  | 'date-added-desc' 
  | 'last-read' 
  | 'progress' 
  | 'rating';

/**
 * Filter options for library display
 */
export type FilterOption = 
  | 'read' 
  | 'unread' 
  | 'in-progress' 
  | 'completed' 
  | 'downloaded' 
  | 'has-issues';

/**
 * View type options for library display
 */
export type ViewType = 'posters' | 'table' | 'details';

/**
 * Cover size options for poster view
 */
export type CoverSize = 'small' | 'medium' | 'large';

/**
 * Advanced filter interface for complex filtering
 */
export interface AdvancedFilter {
  dateAddedFrom?: Date | null;
  dateAddedTo?: Date | null;
  lastReadFrom?: Date | null;
  lastReadTo?: Date | null;
  chaptersMin?: number | null;
  chaptersMax?: number | null;
  genres?: string[];
  tags?: string[];
  excludeGenres?: string[];
  excludeTags?: string[];
  publicationStatus?: string[];
  readingStatus?: ('has-chapters' | 'no-chapters' | 'has-downloaded' | 'fully-read' | 'partially-read' | 'not-started')[];
  ratingMin?: number | null;
  ratingMax?: number | null;
  monitored?: boolean | null;
  countryOfOrigin?: string[];
}

/**
 * Filter preset for saving common filter combinations
 */
export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterOption[];
  advancedFilters?: AdvancedFilter | undefined;
  sortBy?: SortOption | undefined;
}

export const BUILT_IN_PRESETS: FilterPreset[] = [
  {
    id: 'builtin-ready-to-read',
    name: 'Ready to Read',
    filters: [],
    advancedFilters: { readingStatus: ['has-downloaded'], chaptersMin: 1 },
    sortBy: 'last-read',
  },
  {
    id: 'builtin-ongoing-unread',
    name: 'Ongoing & Unread',
    filters: ['unread'],
    advancedFilters: { publicationStatus: ['ONGOING'] },
    sortBy: 'date-added',
  },
  {
    id: 'builtin-completed-series',
    name: 'Completed Series',
    filters: [],
    advancedFilters: { publicationStatus: ['COMPLETED'] },
    sortBy: 'rating',
  },
  {
    id: 'builtin-in-progress',
    name: 'Currently Reading',
    filters: ['in-progress'],
    advancedFilters: {},
    sortBy: 'last-read',
  },
  {
    id: 'builtin-needs-attention',
    name: 'Needs Attention',
    filters: ['has-issues'],
    advancedFilters: {},
  },
  {
    id: 'builtin-highly-rated',
    name: 'Highly Rated (70+)',
    filters: [],
    advancedFilters: { ratingMin: 70 },
    sortBy: 'rating',
  },
  {
    id: 'builtin-no-chapters',
    name: 'Empty (No Chapters)',
    filters: [],
    advancedFilters: { readingStatus: ['no-chapters'] },
    sortBy: 'alphabetical',
  },
];

/**
 * Search fields for multi-field search
 */
export type SearchField = 'title' | 'author' | 'artist' | 'genre' | 'tag' | 'all';

/**
 * Library view state data interface
 */
export type LibraryViewStateData = {
  // View options
  viewType: ViewType;
  sortBy: SortOption;
  filterBy: FilterOption[];
  searchQuery: string;
  searchField: SearchField;
  searchHistory: string[];
  enableRegexSearch: boolean;
  
  // Advanced filters
  advancedFilters: AdvancedFilter;
  filterPresets: FilterPreset[];
  activePresetId: string | null;
  
  // Selection for bulk actions (stored as array for persistence)
  selectedItems: string[];
  selectionMode: boolean;
  
  // View preferences
  showCovers: boolean;
  showProgress: boolean;
  coverSize: CoverSize;
  animatedCovers: boolean;
  
  // Advanced options
  autoDownloadNewChapters: boolean;
  sendUpdateNotifications: boolean;
  autoMarkAsRead: boolean;
  enableMetadataEnhancement: boolean;
  skipEmptyVolumes: boolean;
} & Record<string, unknown>;

/**
 * Library view state actions interface
 */
export type LibraryViewActions = {
  // View controls
  setViewType: (viewType: ViewType) => void;
  setSortBy: (sortBy: SortOption) => void;
  setFilterBy: (filterBy: FilterOption[]) => void;
  toggleFilter: (filter: FilterOption) => void;
  setSearchQuery: (query: string) => void;
  setSearchField: (field: SearchField) => void;
  setEnableRegexSearch: (enable: boolean) => void;
  
  // Search history
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  removeFromSearchHistory: (query: string) => void;
  
  // Advanced filters
  setAdvancedFilters: (filters: AdvancedFilter) => void;
  updateAdvancedFilter: <K extends keyof AdvancedFilter>(key: K, value: AdvancedFilter[K]) => void;
  clearAdvancedFilters: () => void;
  
  // Filter presets
  saveFilterPreset: (preset: Omit<FilterPreset, 'id'>) => void;
  deleteFilterPreset: (id: string) => void;
  applyFilterPreset: (id: string) => void;
  clearActivePreset: () => void;
  updateFilterPreset: (id: string, preset: Partial<FilterPreset>) => void;
  setActivePresetId: (id: string | null) => void;
  
  // Selection management
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  toggleItemSelection: (id: string) => void;
  setSelectionMode: (enabled: boolean) => void;
  
  // View preferences
  setShowCovers: (show: boolean) => void;
  setShowProgress: (show: boolean) => void;
  setCoverSize: (size: CoverSize) => void;
  setAnimatedCovers: (enabled: boolean) => void;
  toggleShowCovers: () => void;
  toggleShowProgress: () => void;
  toggleAnimatedCovers: () => void;
  
  // Advanced options
  setAutoDownloadNewChapters: (enabled: boolean) => void;
  setSendUpdateNotifications: (enabled: boolean) => void;
  setAutoMarkAsRead: (enabled: boolean) => void;
  setEnableMetadataEnhancement: (enabled: boolean) => void;
  setSkipEmptyVolumes: (enabled: boolean) => void;
  
  // Bulk operations
  getSelectedItemsArray: () => string[];
  
  // Reset functions
  resetFilters: () => void;
  resetView: () => void;
} & Record<string, unknown>;

/**
 * Combined library view state type
 */
export type LibraryViewState = LibraryViewStateData & LibraryViewActions;

/**
 * Initial library view state
 * 
 * Provides default values for all view-related state:
 * - Poster view by default
 * - Alphabetical sorting
 * - No active filters
 * - Empty search
 * - Show covers and progress enabled
 */
const initialState: LibraryViewStateData = {
  viewType: 'posters',
  sortBy: 'alphabetical',
  filterBy: [],
  searchQuery: '',
  searchField: 'all',
  searchHistory: [],
  enableRegexSearch: false,
  advancedFilters: {},
  filterPresets: [],
  activePresetId: null,
  selectedItems: [], // Using array instead of Set for persistence
  selectionMode: false,
  showCovers: true,
  showProgress: true,
  coverSize: 'medium',
  animatedCovers: true,
  autoDownloadNewChapters: false,
  sendUpdateNotifications: false,
  autoMarkAsRead: false,
  enableMetadataEnhancement: false,
  skipEmptyVolumes: false,
};

/**
 * Library view store slice with persistence
 * 
 * Creates a store slice with state and actions for managing library view.
 * Uses immer for immutable state updates and persists to localStorage.
 * 
 * @example
 * // Change view type
 * useLibraryViewStore.getState().setViewType('table');
 * 
 * // Toggle a filter
 * useLibraryViewStore.getState().toggleFilter('unread');
 * 
 * // Select items for bulk action
 * useLibraryViewStore.getState().selectItem('manga-123');
 */
export const useLibraryViewStore = createAppSlice<
  LibraryViewStateData, 
  LibraryViewActions
>(
  initialState,
  'library-view'
)((set, get) => ({
  ...initialState,
  
  // View controls
  setViewType: (viewType: ViewType) =>
    set((state) => {
      state.viewType = viewType;
    }),
    
  setSortBy: (sortBy: SortOption) =>
    set((state) => {
      state.sortBy = sortBy;
    }),
    
  setFilterBy: (filterBy: FilterOption[]) =>
    set((state) => {
      state.filterBy = filterBy;
    }),
    
  toggleFilter: (filter: FilterOption) =>
    set((state) => {
      const index = state.filterBy.indexOf(filter);
      if (index >= 0) {
        state.filterBy.splice(index, 1);
      } else {
        state.filterBy.push(filter);
      }
    }),
    
  setSearchQuery: (query: string) =>
    set((state) => {
      state.searchQuery = query;
    }),
    
  setSearchField: (field: SearchField) =>
    set((state) => {
      state.searchField = field;
    }),
    
  setEnableRegexSearch: (enable: boolean) =>
    set((state) => {
      state.enableRegexSearch = enable;
    }),
  
  // Search history
  addToSearchHistory: (query: string) =>
    set((state) => {
      // Remove duplicates and add to beginning
      const filtered = state.searchHistory.filter(q => q !== query);
      state.searchHistory = [query, ...filtered].slice(0, 10); // Keep last 10
    }),
    
  clearSearchHistory: () =>
    set((state) => {
      state.searchHistory = [];
    }),
    
  removeFromSearchHistory: (query: string) =>
    set((state) => {
      state.searchHistory = state.searchHistory.filter(q => q !== query);
    }),
  
  // Advanced filters
  setAdvancedFilters: (filters: AdvancedFilter) =>
    set((state) => {
      state.advancedFilters = filters;
    }),
    
  updateAdvancedFilter: <K extends keyof AdvancedFilter>(key: K, value: AdvancedFilter[K]) =>
    set((state) => {
      state.advancedFilters[key] = value;
    }),
    
  clearAdvancedFilters: () =>
    set((state) => {
      state.advancedFilters = {};
    }),
  
  // Filter presets
  saveFilterPreset: (preset: Omit<FilterPreset, 'id'>) =>
    set((state) => {
      const id = `preset-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      state.filterPresets.push({ ...preset, id });
    }),
    
  deleteFilterPreset: (id: string) =>
    set((state) => {
      state.filterPresets = state.filterPresets.filter(p => p["id"] !== id);
      if (state.activePresetId === id) {
        state.activePresetId = null;
      }
    }),
    
  applyFilterPreset: (id: string) =>
    set((state) => {
      const preset = state.filterPresets.find(p => p["id"] === id)
        ?? BUILT_IN_PRESETS.find(p => p.id === id);
      if (preset) {
        state.filterBy = preset.filters;
        if (preset.advancedFilters) {
          state.advancedFilters = preset.advancedFilters;
        }
        if (preset.sortBy) {
          state.sortBy = preset.sortBy;
        }
        state.activePresetId = id;
      }
    }),

  clearActivePreset: () =>
    set((state) => {
      state.filterBy = [];
      state.advancedFilters = {};
      state.activePresetId = null;
    }),


  updateFilterPreset: (id: string, updates: Partial<FilterPreset>) =>
    set((state) => {
      const index = state.filterPresets.findIndex(p => p["id"] === id);
      if (index >= 0) {
        const currentPreset = state.filterPresets[index];
        if (currentPreset) {
          state.filterPresets[index] = {
            ...currentPreset,
            ...updates,
            ...(updates.advancedFilters !== undefined ? { advancedFilters: updates.advancedFilters } : {}),
            ...(updates.sortBy !== undefined ? { sortBy: updates.sortBy } : {})
          };
        }
      }
    }),
    
  setActivePresetId: (id: string | null) =>
    set((state) => {
      state.activePresetId = id;
    }),
  
  // Selection management
  selectItem: (id: string) =>
    set((state) => {
      if (!state.selectedItems.includes(id)) {
        state.selectedItems.push(id);
      }
    }),
    
  deselectItem: (id: string) =>
    set((state) => {
      const index = state.selectedItems.indexOf(id);
      if (index >= 0) {
        state.selectedItems.splice(index, 1);
      }
    }),
    
  selectAll: (ids: string[]) =>
    set((state) => {
      state.selectedItems = ids;
    }),
    
  clearSelection: () =>
    set((state) => {
      state.selectedItems = [];
    }),
    
  toggleItemSelection: (id: string) =>
    set((state) => {
      const index = state.selectedItems.indexOf(id);
      if (index >= 0) {
        state.selectedItems.splice(index, 1);
      } else {
        state.selectedItems.push(id);
      }
    }),

  setSelectionMode: (enabled: boolean) =>
    set((state) => {
      state.selectionMode = enabled;
      if (!enabled) {
        state.selectedItems = [];
      }
    }),

  // View preferences
  setShowCovers: (show: boolean) =>
    set((state) => {
      state.showCovers = show;
    }),
    
  setShowProgress: (show: boolean) =>
    set((state) => {
      state.showProgress = show;
    }),
    
  toggleShowCovers: () =>
    set((state) => {
      state.showCovers = !state.showCovers;
    }),
    
  toggleShowProgress: () =>
    set((state) => {
      state.showProgress = !state.showProgress;
    }),
    
  setCoverSize: (size: CoverSize) =>
    set((state) => {
      state.coverSize = size;
    }),

  setAnimatedCovers: (enabled: boolean) =>
    set((state) => {
      state.animatedCovers = enabled;
    }),

  toggleAnimatedCovers: () =>
    set((state) => {
      state.animatedCovers = !state.animatedCovers;
    }),

  // Advanced options
  setAutoDownloadNewChapters: (enabled: boolean) =>
    set((state) => {
      state.autoDownloadNewChapters = enabled;
    }),
    
  setSendUpdateNotifications: (enabled: boolean) =>
    set((state) => {
      state.sendUpdateNotifications = enabled;
    }),
    
  setAutoMarkAsRead: (enabled: boolean) =>
    set((state) => {
      state.autoMarkAsRead = enabled;
    }),
    
  setEnableMetadataEnhancement: (enabled: boolean) =>
    set((state) => {
      state.enableMetadataEnhancement = enabled;
    }),
    
  setSkipEmptyVolumes: (enabled: boolean) =>
    set((state) => {
      state.skipEmptyVolumes = enabled;
    }),
  
  // Bulk operations
  getSelectedItemsArray: () => {
    return get().selectedItems;
  },
  
  // Reset functions
  resetFilters: () =>
    set((state) => {
      state.filterBy = [];
      state.searchQuery = '';
      state.searchField = 'all';
      state.advancedFilters = {};
      state.activePresetId = null;
    }),
    
  resetView: () =>
    set((state) => {
      Object.assign(state, initialState);
    }),
}));
