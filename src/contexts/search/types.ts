/**
 * Search context types
 */

import type { MangaSearchResult } from '@/types/search.types';

export interface SearchState {
  query: string;
  results: MangaSearchResult[];
  loading: boolean;
  error: string | null;
  selectedProvider?: string;
  filters?: SearchFilters;
}

export interface SearchFilters {
  status?: string;
  genres?: string[];
  year?: number;
  rating?: number;
}

export interface SearchContextValue extends SearchState {
  search: (query: string) => Promise<void>;
  clearResults: () => void;
  setProvider: (provider: string) => void;
  setFilters: (filters: SearchFilters) => void;
}