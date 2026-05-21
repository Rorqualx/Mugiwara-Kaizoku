/**
 * Custom hook for managing HomeActionBar state
 */

import { useState, useCallback } from 'react';

import { useLibraryViewStore } from '@/store/index';
import { useUIStore } from '@/store/uiSlice';

import type { DisplayOptions, MenuState, ViewType, SortOption, FilterOption } from '../types';

/**
 * State and actions for the HomeActionBar component
 */
export interface HomeActionBarState {
  // View state
  viewType: ViewType;
  sortBy: SortOption;
  filterBy: FilterOption[];
  openedMenu: MenuState;
  options: DisplayOptions;
  deduplicateManga: boolean;

  // Actions
  setViewType: (view: ViewType) => void;
  setSortBy: (sort: SortOption) => void;
  setFilterBy: (filters: FilterOption[]) => void;
  handleMenuOpen: (menuName: 'view' | 'sort' | 'filter') => void;
  handleMenuClose: () => void;
  handleOptionToggle: (key: keyof DisplayOptions) => void;
  setDeduplicateManga: (value: boolean) => void;
}

/**
 * Hook to manage all HomeActionBar state in one place
 *
 * - viewType is shared with LibraryContent via Zustand store
 * - sortBy and filterBy are local state (home-specific filter options)
 */
export function useHomeActionBarState(): HomeActionBarState {
  // Zustand state - UI store
  const deduplicateManga = useUIStore((state) => state.deduplicateManga);
  const setDeduplicateMangaStore = useUIStore((state) => state.setDeduplicateManga);

  // Zustand state - Library view store (shared with LibraryContent)
  // Only viewType is shared - it controls poster/table/details view
  const storeViewType = useLibraryViewStore((state) => state.viewType);
  const setStoreViewType = useLibraryViewStore((state) => state.setViewType);

  // Local state for sort and filter (home-specific options that differ from store)
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');
  const [filterBy, setFilterBy] = useState<FilterOption[]>([]);

  // Local state (UI-only state that doesn't need to persist)
  const [openedMenu, setOpenedMenu] = useState<MenuState>(null);
  const [options, setOptions] = useState<DisplayOptions>({
    posterSize: 'medium',
    detailProgressBar: true,
    showName: true,
    showMonitored: true,
    showQualityProfile: true,
    showSearch: true,
  });

  // Handlers
  const handleMenuOpen = useCallback((menuName: 'view' | 'sort' | 'filter'): void => {
    setOpenedMenu(menuName);
  }, []);

  const handleMenuClose = useCallback((): void => {
    setOpenedMenu(null);
  }, []);

  const handleOptionToggle = useCallback((key: keyof DisplayOptions): void => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // Convert store viewType to local type (they are the same values)
  const viewType = storeViewType as ViewType;

  // Wrapper to set viewType in both local and store
  const setViewType = useCallback((view: ViewType): void => {
    setStoreViewType(view);
  }, [setStoreViewType]);

  return {
    // State
    viewType,
    sortBy,
    filterBy,
    openedMenu,
    options,
    deduplicateManga,

    // Actions
    setViewType,
    setSortBy,
    setFilterBy,
    handleMenuOpen,
    handleMenuClose,
    handleOptionToggle,
    setDeduplicateManga: setDeduplicateMangaStore,
  };
}
