// Consolidated onto UnifiedSearchContext (re-exported via the barrel). The former
// per-context files (MainSearchContext.tsx / ModalSearchContext.tsx) were duplicate
// implementations with their own React context objects — mounting the wrong one
// silently left the header search on its no-op default. One context now backs both.
import { useMainSearch, useModalSearch } from '../contexts/search';

import type { SearchResult } from '../types/search.types';

/**
 * Interface defining the return type for the useSearch hook
 */
export interface UseSearchResult {
  /** Current search query string */
  query: string;
  /** Function to update the search query */
  setQuery: (query: string) => void;
  /** Array of search results from the query */
  results: SearchResult[];
  /** Loading state indicator for the search operation */
  isLoading: boolean;
  /** Error message if search fails, null otherwise */
  error: string | null;
  /** Currently selected manga from search results */
  selectedManga: SearchResult | null;
  /** Function to set the selected manga */
  handleMangaSelect: (manga: SearchResult) => void;
}

/**
 * Hook for accessing manga search functionality in different contexts
 * 
 * This hook provides access to either the main search context (used in the main UI)
 * or the modal search context (used in modals/dialogs). Both contexts provide similar
 * functionality but with different behaviors - the modal context includes additional
 * timeout handling for search requests.
 * 
 * @param {string} [context='main'] - Which search context to use ('main' or 'modal')
 * @param {string|null} [_selectedSource] - Deprecated parameter, source is handled internally
 * @returns {UseSearchResult} Search context state and functions
 * 
 * @example
 * ```tsx
 * // In main UI
 * const { query, setQuery, results } = useSearch();
 * 
 * // In a modal
 * const { query, setQuery, results } = useSearch('modal');
 * ```
 */
export function useSearch(context: 'main' | 'modal' = 'main', _selectedSource?: string | null): UseSearchResult {
  const mainSearch = useMainSearch();
  const modalSearch = useModalSearch();
  
  // We don't need to pass selectedSource to the context hooks
  // as they will handle the source internally
  return context === 'modal' ? modalSearch : mainSearch;
}
