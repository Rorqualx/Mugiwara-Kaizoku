/**
 * Unified Search Types for Frontend
 * Re-exports and extends search types for frontend components
 */

import type { 
  MangaSearchResult
} from '../search.types';
import type {
  ProviderCapability
} from '@prisma/client';

// Define types that don't exist in Prisma
export interface SearchOptions {
  query: string;
  providers?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  results: MangaSearchResult[];
  total: number;
  hasMore: boolean;
}

export type ProviderType = string;

// Frontend-specific search state
export interface SearchState {
  query: string;
  results: MangaSearchResult[];
  isLoading: boolean;
  error?: string;
  selectedProviders: ProviderType[];
  filters: SearchFilters;
}

export interface SearchFilters {
  status?: string;
  year?: number;
  genres?: string[];
  tags?: string[];
  rating?: number;
  sortBy?: 'relevance' | 'title' | 'year' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

// Provider search configuration
export interface ProviderSearchConfig {
  provider: ProviderType;
  enabled: boolean;
  priority: number;
  capabilities: ProviderCapability[];
  timeout?: number;
}

// Search result with UI metadata
export interface UISearchResult extends MangaSearchResult {
  isSelected?: boolean;
  isLoading?: boolean;
  isFavorite?: boolean;
  matchScore?: number;
  providerConfidence?: number;
}

// Aggregated search response
export interface AggregatedSearchResponse {
  results: UISearchResult[];
  totalCount: number;
  providers: {
    [key: string]: {
      count: number;
      responseTime: number;
      error?: string;
    };
  };
  searchTime: number;
}

// Search context for components
export interface SearchContext {
  state: SearchState;
  actions: {
    search: (query: string, options?: SearchOptions) => Promise<void>;
    clearResults: () => void;
    selectResult: (resultId: string) => void;
    toggleProvider: (provider: ProviderType) => void;
    updateFilters: (filters: Partial<SearchFilters>) => void;
  };
}