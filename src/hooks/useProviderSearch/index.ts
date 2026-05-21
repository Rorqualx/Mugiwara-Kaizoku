/**
 * useProviderSearch Module
 *
 * Exports the main hook and all supporting types/utilities.
 *
 * Architecture:
 * - types.ts - Type definitions (EnhancedSearchResult, SearchState, SearchAction)
 * - transformers.ts - Result transformation utilities
 * - reducer.ts - State management reducer
 * - index.ts - Re-exports and main hook
 */

// Re-export types
export type { EnhancedSearchResult, SearchState, SearchAction } from './types';

// Re-export utilities
export { extractCoverUrl, transformSearchResult } from './transformers';
export { searchReducer } from './reducer';
export {
  getUserFriendlyErrorMessage,
  handleDisabledProviderErrors,
  processSearchResults,
  finalizeSearchResults
} from './search-helpers';

// Main hook is exported from the parent file
// Consumers should import from '@/hooks/useProviderSearch'
