/**
 * Type definitions for LibraryActionBar components
 */

import type { ViewType, SortOption, FilterOption, CoverSize } from '@/store/index';

import type { Prisma } from '@prisma/client';

// Define MangaEntity with relations to match BulkActionsModal expectations
export type MangaEntity = Prisma.MangaGetPayload<{
  include: {
    Metadata: true;
    Chapter: true;
  };
}>;

/**
 * Props for the main LibraryActionBar component
 */
export interface LibraryActionBarProps {
  libraryId?: number;
  libraryName?: string;
}

/**
 * Menu state type for tracking which menu is open
 */
export type MenuState = 'options' | 'view' | 'sort' | 'filter' | null;

/**
 * State returned by useLibraryActionBarState hook
 */
export interface LibraryActionBarState {
  // View state from store
  viewType: ViewType;
  sortBy: SortOption;
  filterBy: FilterOption[];
  showCovers: boolean;
  showProgress: boolean;
  coverSize: CoverSize;

  // Advanced options from store
  autoDownloadNewChapters: boolean;
  sendUpdateNotifications: boolean;
  autoMarkAsRead: boolean;
  enableMetadataEnhancement: boolean;
  skipEmptyVolumes: boolean;

  // Actions from store
  setViewType: (viewType: ViewType) => void;
  setSortBy: (sortBy: SortOption) => void;
  toggleFilter: (filter: FilterOption) => void;
  toggleShowCovers: () => void;
  toggleShowProgress: () => void;
  setCoverSize: (size: CoverSize) => void;
  setAutoDownloadNewChapters: (value: boolean) => void;
  setSendUpdateNotifications: (value: boolean) => void;
  setAutoMarkAsRead: (value: boolean) => void;
  setEnableMetadataEnhancement: (value: boolean) => void;
  setSkipEmptyVolumes: (value: boolean) => void;
}

/**
 * Props for menu components
 */
export interface MenuComponentProps {
  opened: boolean;
  onToggle: (opened: boolean) => void;
}

/**
 * Props for OptionsMenu component
 */
export interface OptionsMenuProps extends MenuComponentProps {
  onEditLibrary: () => void;
  onAdvancedOptions: () => void;
}

/**
 * Props for ViewMenu component
 */
export interface ViewMenuProps extends MenuComponentProps {
  viewType: ViewType;
  showCovers: boolean;
  showProgress: boolean;
  onViewChange: (view: ViewType) => void;
  onToggleCovers: () => void;
  onToggleProgress: () => void;
}

/**
 * Props for SortMenu component
 */
export interface SortMenuProps extends MenuComponentProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

/**
 * Props for FilterMenu component
 */
export interface FilterMenuProps extends MenuComponentProps {
  filterBy: FilterOption[];
  onFilterChange: (filter: FilterOption) => void;
}

/**
 * Props for AlphabetNavigation component
 */
export interface AlphabetNavigationProps {
  onJumpToLetter: (letter: string) => void;
}

/**
 * Props for AdvancedOptionsModal component
 */
export interface AdvancedOptionsModalProps {
  opened: boolean;
  onClose: () => void;
  autoDownloadNewChapters: boolean;
  sendUpdateNotifications: boolean;
  autoMarkAsRead: boolean;
  onAutoDownloadChange: (value: boolean) => void;
  onNotificationsChange: (value: boolean) => void;
  onAutoMarkAsReadChange: (value: boolean) => void;
  onSave: () => void;
}

/**
 * Props for CoverSizeSelector component
 */
export interface CoverSizeSelectorProps {
  coverSize: CoverSize;
  onCoverSizeChange: (size: CoverSize) => void;
}
