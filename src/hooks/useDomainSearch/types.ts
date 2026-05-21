/**
 * Types for Domain Search Hook
 */

import type { SearchResult } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';

/**
 * Provider search state containing AsyncResult
 */
export interface ProviderSearchState {
  results: AsyncResult<SearchResult[], Error>;
  searchCompleted: boolean;
}

/**
 * Complete search state across all providers
 */
export interface SearchState {
  providerStates: Record<string, ProviderSearchState>;
  generalError: Error | null;
}

/**
 * Actions for updating search state
 */
export type SearchAction =
  | { type: 'SEARCH_START'; payload: { providerId: string } }
  | { type: 'SEARCH_SUCCESS'; payload: { providerId: string; results: SearchResult[] } }
  | { type: 'SEARCH_ERROR'; payload: { providerId: string; error: Error } }
  | { type: 'SET_GENERAL_ERROR'; payload: { error: Error } }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'RESET_SEARCH_COMPLETED' };
