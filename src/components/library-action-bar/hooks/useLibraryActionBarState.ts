/**
 * Custom hook to consolidate all library action bar state from Zustand store
 */

import { useLibraryViewStore } from '@/store/index';

import type { LibraryActionBarState } from '../types';

/**
 * Consolidates all Zustand store selectors for the LibraryActionBar component.
 * This reduces the number of individual hook calls in the main component.
 */
export function useLibraryActionBarState(): LibraryActionBarState {
  // View state from store
  const viewType = useLibraryViewStore((state) => state.viewType);
  const sortBy = useLibraryViewStore((state) => state.sortBy);
  const filterBy = useLibraryViewStore((state) => state.filterBy);
  const showCovers = useLibraryViewStore((state) => state.showCovers);
  const showProgress = useLibraryViewStore((state) => state.showProgress);
  const coverSize = useLibraryViewStore((state) => state.coverSize);

  // Advanced options from store
  const autoDownloadNewChapters = useLibraryViewStore((state) => state.autoDownloadNewChapters);
  const sendUpdateNotifications = useLibraryViewStore((state) => state.sendUpdateNotifications);
  const autoMarkAsRead = useLibraryViewStore((state) => state.autoMarkAsRead);
  const enableMetadataEnhancement = useLibraryViewStore((state) => state.enableMetadataEnhancement);
  const skipEmptyVolumes = useLibraryViewStore((state) => state.skipEmptyVolumes);

  // Actions from store
  const setViewType = useLibraryViewStore((state) => state.setViewType);
  const setSortBy = useLibraryViewStore((state) => state.setSortBy);
  const toggleFilter = useLibraryViewStore((state) => state.toggleFilter);
  const toggleShowCovers = useLibraryViewStore((state) => state.toggleShowCovers);
  const toggleShowProgress = useLibraryViewStore((state) => state.toggleShowProgress);
  const setCoverSize = useLibraryViewStore((state) => state.setCoverSize);
  const setAutoDownloadNewChapters = useLibraryViewStore((state) => state.setAutoDownloadNewChapters);
  const setSendUpdateNotifications = useLibraryViewStore((state) => state.setSendUpdateNotifications);
  const setAutoMarkAsRead = useLibraryViewStore((state) => state.setAutoMarkAsRead);
  const setEnableMetadataEnhancement = useLibraryViewStore((state) => state.setEnableMetadataEnhancement);
  const setSkipEmptyVolumes = useLibraryViewStore((state) => state.setSkipEmptyVolumes);

  return {
    // View state
    viewType,
    sortBy,
    filterBy,
    showCovers,
    showProgress,
    coverSize,

    // Advanced options
    autoDownloadNewChapters,
    sendUpdateNotifications,
    autoMarkAsRead,
    enableMetadataEnhancement,
    skipEmptyVolumes,

    // Actions
    setViewType,
    setSortBy,
    toggleFilter,
    toggleShowCovers,
    toggleShowProgress,
    setCoverSize,
    setAutoDownloadNewChapters,
    setSendUpdateNotifications,
    setAutoMarkAsRead,
    setEnableMetadataEnhancement,
    setSkipEmptyVolumes,
  };
}
