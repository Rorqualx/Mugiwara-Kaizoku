/**
 * Type definitions for useProviderSearch hook
 *
 * Extracted from: useProviderSearch.ts
 */

import type { SearchResult } from '@/server/services/search/types';

/**
 * Search result from a specific provider, extending the base SearchResult type
 * with provider information
 *
 * @interface EnhancedSearchResult
 * @extends {SearchResult}
 * @property {string} provider - ID of the provider that returned this result
 * @property {string} [wikiUrl] - Optional Fandom wiki URL
 * @property {string} [url] - Optional generic URL
 * @property {unknown} [volumeCovers] - Optional volume covers for enhanced metadata
 * @property {unknown} [gallery] - Optional gallery images for enhanced metadata
 * @property {string} [sourceId] - Optional source-specific ID
 * @property {unknown[]} [volumeData] - Volume data array for detailed volume information
 */
export interface EnhancedSearchResult extends SearchResult {
  provider: string; // ID of the provider that returned this result
  // Provider-specific fields that may be present
  wikiUrl?: string;
  url?: string;
  volumeCovers?: unknown;
  gallery?: unknown;
  sourceId?: string;
  volumeData?: unknown[]; // Volume data array for detailed volume information
}

/**
 * State for managing search results across multiple providers
 *
 * @interface SearchState
 * @property {Record<string, EnhancedSearchResult[]>} results - Search results keyed by provider ID
 * @property {Record<string, boolean>} isLoading - Loading state for each provider
 * @property {Record<string, string | null>} errors - Error messages keyed by provider ID
 * @property {Record<string, boolean>} searchCompleted - Whether search has completed for each provider
 */
export interface SearchState {
  results: Record<string, EnhancedSearchResult[]>;
  isLoading: Record<string, boolean>;
  errors: Record<string, string | null>;
  searchCompleted: Record<string, boolean>; // Track if search has been completed for each provider
}

/**
 * Actions that can be dispatched to update the search state
 *
 * @type {SearchAction}
 */
export type SearchAction =
  | {
      type: 'SEARCH_START';
      payload: {
        providerId: string;
      };
    }
  | {
      type: 'SEARCH_SUCCESS';
      payload: {
        providerId: string;
        results: EnhancedSearchResult[];
      };
    }
  | {
      type: 'SEARCH_ERROR';
      payload: {
        providerId: string;
        error: string;
      };
    }
  | {
      type: 'CLEAR_ERRORS';
    }
  | {
      type: 'RESET_SEARCH_COMPLETED';
    }
  | {
      type: 'CLEAR_RESULTS';
    };
