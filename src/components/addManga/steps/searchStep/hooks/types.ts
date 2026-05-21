/**
 * Shared Types for Search Step Hooks
 *
 * Common type definitions used across all search step sub-hooks.
 * Prevents circular dependencies and provides a single source of truth.
 */

import type { ChangeEvent } from 'react';


import type { FormType } from '@/components/addManga/form';
import type { ExtendedMangaSearchResult } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';

import type { ParsedSearchQuery, MetadataProvider } from '../types';
import type { UseFormReturnType } from '@mantine/form';

// ============================================================================
// Hook Prop Types
// ============================================================================

/**
 * Props for useSearchStepState orchestrator hook
 */
export interface UseSearchStepStateProps {
  form: UseFormReturnType<FormType>;
  onSelect?: ((manga: ExtendedMangaSearchResult, allResults?: Record<string, unknown[]>) => void) | undefined;
  onQuickAdd?: ((manga: ExtendedMangaSearchResult, allResults?: Record<string, ExtendedMangaSearchResult[]>) => void) | undefined;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useSearchProviderState hook
 */
export interface UseSearchProviderStateReturn {
  metadataProviders: unknown;
  enabledSources: MetadataProvider[];
  defaultSource: string;
  setDefaultSource: (value: string) => void;
  allProviderIds: string[];
  shouldUseProviderSearch: (selectedProvider: string) => boolean;
}

/**
 * Return type for useAllProviderResults hook
 */
export interface UseAllProviderResultsReturn {
  allProviderResults: ExtendedMangaSearchResult[];
  fetchingAllProviders: boolean;
  fetchAllProviderResults: (query: string) => Promise<ExtendedMangaSearchResult[]>;
}

/**
 * Return type for useSearchQuery hook
 */
export interface UseSearchQueryReturn {
  query: string;
  parsedQuery: ParsedSearchQuery | null;
  handleQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  setFormQuery: (value: string) => void;
}

/**
 * Return type for useSearchExecution hook
 */
export interface UseSearchExecutionReturn {
  searchState: AsyncResult<ExtendedMangaSearchResult[], Error>;
  standardizedSearchCompleted: boolean;
  executeStandardizedSearch: (forceRefresh?: boolean) => Promise<void>;
  clearSearchState: () => void;
}

/**
 * Return type for useMangaSelection hook
 */
export interface UseMangaSelectionReturn {
  selectingMangaId: string | null;
  handleMangaSelect: (selected: ExtendedMangaSearchResult) => Promise<void>;
}

/**
 * Return type for useSearchErrors hook
 */
export interface UseSearchErrorsReturn {
  errors: Record<string, string>;
  handleErrorClose: () => void;
  setErrors: (errors: Record<string, string>) => void;
}

/**
 * Return type for useProviderSelection hook
 */
export interface UseProviderSelectionReturn {
  selectedProvider: string;
  handleProviderChange: (value: string | null) => void;
  setSelectedProvider: (value: string) => void;
}

/**
 * Complete return type for useSearchStepState orchestrator
 */
export interface UseSearchStepStateReturn {
  // State
  query: string;
  errors: Record<string, string>;
  searchState: AsyncResult<ExtendedMangaSearchResult[], Error>;
  selectedProvider: string;
  showSearchHelp: boolean;
  parsedQuery: ParsedSearchQuery | null;
  selectingMangaId: string | null;
  enabledSources: MetadataProvider[];
  filteredResults: ExtendedMangaSearchResult[];
  hookIsLoading: boolean;
  lastSearchedQuery: string;

  // Handlers
  handleQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleProviderChange: (value: string | null) => void;
  handleSearchClick: () => void;
  handleForceRefresh: () => void;
  handleErrorClose: () => void;
  handleMangaSelect: (selected: ExtendedMangaSearchResult) => Promise<void>;
  handleQuickAdd: (selected: ExtendedMangaSearchResult) => Promise<void>;
  setShowSearchHelp: (value: boolean) => void;
  setFormQuery: (value: string) => void;
}
