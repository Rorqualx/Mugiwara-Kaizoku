/**
 * Reducer for Domain Search Hook
 */

import type { SearchResult } from '@/types/search.types';
import {
  createLoadingResult,
  createSuccessResult,
  createErrorResult,
  createIdleResult,
  isError
} from '@/utils/async-result';

import type { SearchState, SearchAction, ProviderSearchState } from './types';

/**
 * Initial provider state
 */
export const initialProviderState: ProviderSearchState = {
  results: createIdleResult<SearchResult[], Error>(),
  searchCompleted: false
};

/**
 * Creates initial search state with empty provider states
 */
export function createInitialState(providerIds: string[]): SearchState {
  return {
    providerStates: providerIds.reduce((acc, id) => ({
      ...acc,
      [id]: { ...initialProviderState }
    }), {} as Record<string, ProviderSearchState>),
    generalError: null
  };
}

/**
 * Reducer for managing search state with AsyncResult pattern
 */
export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'SEARCH_START': {
      const { providerId } = action.payload;
      return {
        ...state,
        providerStates: {
          ...state.providerStates,
          [providerId]: {
            ...(state.providerStates[providerId] ?? initialProviderState),
            results: createLoadingResult<SearchResult[], Error>(),
            searchCompleted: false
          }
        }
      };
    }

    case 'SEARCH_SUCCESS': {
      const { providerId, results } = action.payload;
      return {
        ...state,
        providerStates: {
          ...state.providerStates,
          [providerId]: {
            ...(state.providerStates[providerId] ?? initialProviderState),
            results: createSuccessResult<SearchResult[], Error>(results),
            searchCompleted: true
          }
        }
      };
    }

    case 'SEARCH_ERROR': {
      const { providerId, error } = action.payload;
      return {
        ...state,
        providerStates: {
          ...state.providerStates,
          [providerId]: {
            ...(state.providerStates[providerId] ?? initialProviderState),
            results: createErrorResult<SearchResult[], Error>(error),
            searchCompleted: true
          }
        }
      };
    }

    case 'SET_GENERAL_ERROR':
      return {
        ...state,
        generalError: action.payload.error
      };

    case 'CLEAR_ERRORS':
      // Reset all provider errors but keep successful results
      return {
        ...state,
        generalError: null,
        providerStates: Object.entries(state.providerStates).reduce((acc, [id, providerState]) => ({
          ...acc,
          [id]: isError(providerState.results)
            ? {
                ...providerState,
                results: createIdleResult<SearchResult[], Error>()
              }
            : providerState
        }), {} as Record<string, ProviderSearchState>)
      };

    case 'RESET_SEARCH_COMPLETED':
      return {
        ...state,
        providerStates: Object.entries(state.providerStates).reduce((acc, [id, providerState]) => ({
          ...acc,
          [id]: {
            ...providerState,
            searchCompleted: false
          }
        }), {} as Record<string, ProviderSearchState>)
      };

    default:
      return state;
  }
}
