/**
 * Library Filtering Utilities - Main Aggregator
 *
 * This module aggregates all filtering-related utilities into a single
 * unified export. All functions from the sub-modules are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - filtering-utils.ts - Shared types and imports (0 functions)
 * - filtering-advanced.ts - Advanced filtering (1 function)
 * - filtering-basic.ts - Basic filtering (1 function)
 * - filtering-search.ts - Search operations (2 functions)
 * - filtering-sort.ts - Sorting operations (1 function)
 * - filtering-progress.ts - Progress calculations (2 functions)
 * - filtering-navigation.ts - Alphabet navigation (1 function)
 *
 * Total: 8 functions across 7 modules
 * Original: 281 lines → Refactored: ~100 lines (65% reduction)
 *
 * Extracted from: filtering.ts (original 281-line monolithic file)
 */

// Re-export all functions from sub-modules
export {
  applyAdvancedFilters,
} from './filtering-advanced';

export {
  applyBasicFilters,
} from './filtering-basic';

export {
  getFieldValues,
  performSearch,
} from './filtering-search';

export {
  applySorting,
} from './filtering-sort';

export {
  getLastReadTime,
  getChapterProgress,
} from './filtering-progress';

export {
  getAlphabetDataLetter,
} from './filtering-navigation';

// Re-export types from foundation module
export type {
  MangaWithMetadata,
} from './filtering-utils';

// Re-export external types for convenience
export type {
  SortOption,
  FilterOption,
  SearchField,
  AdvancedFilter,
} from '@/store/libraryViewSlice';