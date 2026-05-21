/**
 * Reducer for useProviderSearch hook state management
 *
 * Manages loading, success, and error states for each search provider.
 *
 * Extracted from: useProviderSearch.ts
 */

import type { SearchState, SearchAction } from './types';

/**
 * Reducer for managing search state across multiple providers
 *
 * @param {SearchState} state - Current search state
 * @param {SearchAction} action - Action to perform
 * @returns {SearchState} New search state
 */
export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'SEARCH_START':
      return {
        ...state,
        isLoading: {
          ...state.isLoading,
          [action.payload.providerId]: true
        },
        errors: {
          ...state.errors,
          [action.payload.providerId]: null
        },
        searchCompleted: {
          ...state.searchCompleted,
          [action.payload.providerId]: false
        }
      };
    case 'SEARCH_SUCCESS':
      return {
        ...state,
        results: {
          ...state.results,
          [action.payload.providerId]: action.payload.results
        },
        isLoading: {
          ...state.isLoading,
          [action.payload.providerId]: false
        },
        searchCompleted: {
          ...state.searchCompleted,
          [action.payload.providerId]: true
        }
      };
    case 'SEARCH_ERROR':
      return {
        ...state,
        isLoading: {
          ...state.isLoading,
          [action.payload.providerId]: false
        },
        errors: {
          ...state.errors,
          [action.payload.providerId]: action.payload.error
        },
        searchCompleted: {
          ...state.searchCompleted,
          [action.payload.providerId]: true // Mark as completed even on error
        }
      };
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: Object.keys(state.errors).reduce((acc, key) => ({
          ...acc,
          [key]: null
        }), {} as Record<string, string | null>)
      };
    case 'RESET_SEARCH_COMPLETED':
      return {
        ...state,
        searchCompleted: Object.keys(state.searchCompleted).reduce((acc, key) => ({
          ...acc,
          [key]: false
        }), {} as Record<string, boolean>)
      };
    case 'CLEAR_RESULTS':
      return {
        ...state,
        results: {},
        searchCompleted: {},
        errors: {}
      };
    default:
      return state;
  }
}
