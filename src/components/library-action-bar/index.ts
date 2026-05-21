/**
 * Library Action Bar module exports
 *
 * This module provides the LibraryActionBar component and its sub-components
 * for library detail pages.
 */

export { LibraryActionBar } from './LibraryActionBar';
export type {
  LibraryActionBarProps,
  MangaEntity,
  MenuState,
  LibraryActionBarState,
} from './types';

// Re-export sub-components for flexibility
export {
  OptionsMenu,
  ViewMenu,
  SortMenu,
  FilterMenu,
  AlphabetNavigation,
  AdvancedOptionsModal,
  CoverSizeSelector,
} from './components';

// Re-export hooks
export { useLibraryActionBarState } from './hooks';
