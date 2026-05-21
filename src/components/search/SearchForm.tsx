/**
 * Search Form Component
 * 
 * This component provides a search form for searching manga across providers
 * using the new domain types and hooks with type-safe form state management.
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import type { ReactNode} from 'react';

import {
  TextInput,
  Button,
  Group,
  Box,
  Title,
  Divider,
  MultiSelect,
  Checkbox,
  Select,
  Accordion } from
'@mantine/core';
// Import CSS types
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconSearch } from '@tabler/icons-react';
import { IconAdjustments } from '@tabler/icons-react';

import { useDomainSearch, type ProviderInfo } from '@/hooks/useDomainSearch';
import { SortCriteria, SortOrder } from '@/types/search.types';
import type { SearchResult, SearchOptions , ProviderType } from '@/types/search.types';
import {
  createLoadingResult,
  createErrorResult,
  createSuccessResult,
  createIdleResult } from '@/utils/async-result';
import { trpc } from '@/utils/trpc-client';

import { SearchResultsGridAsync } from './SearchResultsGrid';

import type { MantineStyleProp } from '@mantine/core';

/**
 * Provider options for the form
 */
const PROVIDER_OPTIONS: Array<{value: string;label: string;}> = [
{ value: 'anilist', label: 'AniList' },
{ value: 'comicvine', label: 'ComicVine' },
{ value: 'fandom', label: 'Fandom' }];

/**
 * Sort options for the form
 */
const SORT_OPTIONS: Array<{value: string;label: string;}> = [
{ value: SortCriteria.RELEVANCE, label: 'Relevance' },
{ value: SortCriteria.POPULARITY, label: 'Popularity' },
{ value: SortCriteria.RATING, label: 'Rating' },
{ value: SortCriteria.TITLE, label: 'Title' },
{ value: SortCriteria.YEAR, label: 'Year' },
{ value: SortCriteria.UPDATED, label: 'Last Updated' }];

/**
 * Common genres for filtering
 */
const GENRE_OPTIONS: Array<{value: string;label: string;}> = [
{ value: 'Action', label: 'Action' },
{ value: 'Adventure', label: 'Adventure' },
{ value: 'Comedy', label: 'Comedy' },
{ value: 'Drama', label: 'Drama' },
{ value: 'Fantasy', label: 'Fantasy' },
{ value: 'Horror', label: 'Horror' },
{ value: 'Mystery', label: 'Mystery' },
{ value: 'Romance', label: 'Romance' },
{ value: 'Sci-Fi', label: 'Sci-Fi' },
{ value: 'Slice of Life', label: 'Slice of Life' },
{ value: 'Sports', label: 'Sports' },
{ value: 'Supernatural', label: 'Supernatural' },
{ value: 'Thriller', label: 'Thriller' }];

/**
 * Props for the SearchForm component
 */
interface SearchFormProps {
  /** Callback when a search result is selected */
  onSelectResult?: (result: SearchResult) => void;
  /** Currently selected search result */
  selectedResult?: SearchResult | null;
}

/**
 * Type-safe form state interface
 */
interface SearchFormState {
  /** Search query text */
  query: string;
  /** Selected provider IDs */
  selectedProviders: string[];
  /** Whether to include adult content in search */
  includeAdult: boolean;
  /** Selected genre filters */
  selectedGenres: string[];
  /** Sort criteria for results */
  sortBy: SortCriteria;
  /** Sort order (ascending/descending) */
  sortOrder: SortOrder;
}

/**
 * Input styles
 */
const inputStyles: MantineStyleProp = {
  flex: 1
};

/**
 * Search form component
 * 
 * Provides a form for searching manga with advanced options.
 * 
 * @param {SearchFormProps} props - Component props
 * @returns {ReactNode} Rendered component
 */
export function SearchForm({ onSelectResult, selectedResult }: SearchFormProps): ReactNode {
  // Initialize form state with proper types and explicit typing for enums
  const [searchAllProviders, setSearchAllProviders] = useState(false);
  const [formState, setFormState] = useState<SearchFormState>({
    query: '',
    selectedProviders: [
    'anilist'],

    includeAdult: false,
    selectedGenres: [],
    sortBy: SortCriteria.RELEVANCE,
    sortOrder: SortOrder.DESC
  });

  /**
   * Create a provider info array for the search hook
   */
  const providerInfo = useMemo<ProviderInfo[]>(() => {
    return PROVIDER_OPTIONS.map((option) => ({
      id: option.value,
      name: option.label,
      // Use enum value directly
      type: option.value as ProviderType,
      status: 'active' as const
    }));
  }, []);

  /**
   * Generate search options from form state
   */
  const searchOptions = useMemo<SearchOptions>(() => ({
    query: formState.query,
    providers: formState.selectedProviders,
    sort: formState.sortBy,
    order: formState.sortOrder,
    filters: {
      includeAdult: formState.includeAdult,
      genres: formState.selectedGenres.length > 0 ? formState.selectedGenres : undefined
    }
  }), [formState.query, formState.selectedProviders, formState.includeAdult, formState.selectedGenres, formState.sortBy, formState.sortOrder]);

  // Use our domain search hook with proper typing
  const {
    results,
    isLoading,
    errors,
    triggerSearch,
    searchCompleted
  } = useDomainSearch(
    formState.query,
    providerInfo,
    formState.selectedProviders,
    searchOptions
  );

  // Multi-provider search query using tRPC
  const multiProviderSearchQuery = trpc.search.all.useQuery(
    {
      query: formState.query,
      limit: 50
    },
    {
      enabled: searchAllProviders && formState.query.length >= 3,
      refetchOnWindowFocus: false
    }
  );

  /**
   * Handle text input change
   * 
   * @param {ChangeEvent<HTMLInputElement>} event - Input change event
   * @returns {void}
   */
  const handleQueryChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>((event) => {
    setFormState((prevState) => ({
      ...prevState,
      query: event.currentTarget.value
    }));
  }, []);

  /**
   * Handle provider selection change
   * 
   * @param {string[]} selectedValues - New selected provider values
   * @returns {void}
   */
  const handleProviderChange = useCallback((selectedValues: string[]) => {
    setFormState((prevState) => ({
      ...prevState,
      selectedProviders: selectedValues
    }));
  }, []);

  /**
   * Handle sort criteria change
   * 
   * @param {string | null} value - New sort criteria value
   * @returns {void}
   */
  const handleSortByChange = useCallback((value: string | null) => {
    setFormState((prevState) => ({
      ...prevState,
      sortBy: value ? value as SortCriteria : SortCriteria.RELEVANCE
    }));
  }, []);

  /**
   * Handle sort order change
   * 
   * @param {string | null} value - New sort order value
   * @returns {void}
   */
  const handleSortOrderChange = useCallback((value: string | null) => {
    setFormState((prevState) => ({
      ...prevState,
      sortOrder: value ? value as SortOrder : SortOrder.DESC
    }));
  }, []);

  /**
   * Handle genre selection change
   * 
   * @param {string[]} selectedValues - New selected genre values
   * @returns {void}
   */
  const handleGenreChange = useCallback((selectedValues: string[]) => {
    setFormState((prevState) => ({
      ...prevState,
      selectedGenres: selectedValues
    }));
  }, []);

  /**
   * Handle adult content checkbox change
   * 
   * @param {ChangeEvent<HTMLInputElement>} event - Checkbox change event
   * @returns {void}
   */
  const handleAdultContentChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>((event) => {
    setFormState((prevState) => ({
      ...prevState,
      includeAdult: event.currentTarget.checked
    }));
  }, []);

  /**
   * Handle form submission
   * 
   * @param {FormEvent} event - Form submit event
   * @returns {void}
   */
  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>((event) => {
    event.preventDefault();
    if (searchAllProviders) {
      // Trigger multi-provider search through tRPC
      void multiProviderSearchQuery.refetch();
    } else {
      // Use regular provider-specific search
      void triggerSearch();
    }
  }, [triggerSearch, searchAllProviders, multiProviderSearchQuery]);

  // Get error message for display
  const errorMessage = Object.values(errors)[0] ?? '';

  // Validate form
  const isFormValid = formState.query.length >= 3 && formState.selectedProviders.length > 0;

  return (
    <Box>
      <form onSubmit={handleSubmit}>
        <Title order={3} mb="md">Search Manga</Title>
        
        <Group align="flex-end" mb="md">
          <TextInput
            label="Search Query"
            placeholder="Enter manga title..."
            value={formState.query}
            onChange={handleQueryChange}
            style={inputStyles}
            required
            minLength={3} />

          
          <Button
            type="submit"
            leftSection={<IconSearch size={16} />}
            loading={isLoading}
            disabled={!isFormValid}
            onClick={(_e: React.MouseEvent<HTMLButtonElement>): void => {

              // Form already has a submit handler, this is just for extra type safety
            }}>
            Search
          </Button>
        </Group>
        
        <Accordion variant="separated" mb="md">
          <Accordion.Item value="options">
            <Accordion.Control icon={<IconAdjustments size={16} />}>
              Search Options
            </Accordion.Control>
            <Accordion.Panel>
              <Checkbox
                label="Search All Providers"
                checked={searchAllProviders}
                onChange={(event) => setSearchAllProviders(event.currentTarget.checked)}
                mb="md"
                description="Search across all available providers simultaneously" />

              
              <Group grow mb="md">
                <MultiSelect
                  label="Providers"
                  placeholder="Select providers..."
                  data={PROVIDER_OPTIONS}
                  value={formState.selectedProviders}
                  onChange={handleProviderChange}
                  required={!searchAllProviders}
                  disabled={searchAllProviders}
                  description={searchAllProviders ? "All providers will be searched" : undefined} />

                
                <Select
                  label="Sort By"
                  placeholder="Select sort order..."
                  data={SORT_OPTIONS}
                  value={formState.sortBy}
                  onChange={handleSortByChange} />

                
                <Select
                  label="Sort Order"
                  placeholder="Select sort direction..."
                  data={[
                  { value: SortOrder.ASC, label: 'Ascending' },
                  { value: SortOrder.DESC, label: 'Descending' }]
                  }
                  value={formState.sortOrder}
                  onChange={handleSortOrderChange} />

              </Group>
              
              <MultiSelect
                label="Genres"
                placeholder="Filter by genres..."
                data={GENRE_OPTIONS}
                value={formState.selectedGenres}
                onChange={handleGenreChange}
                searchable
                clearable
                mb="md" />

              
              <Checkbox
                label="Include adult content"
                checked={formState.includeAdult}
                onChange={handleAdultContentChange} />

            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </form>
      
      <Divider my="lg" />
      
      {/* Create a search status object with the AsyncResult pattern */}
      {(() => {
        // Determine which search results to use
        if (searchAllProviders) {
          // Use multi-provider search results
          const searchStatus = (() => {
            if (multiProviderSearchQuery.isLoading) {
              return createLoadingResult<SearchResult[], Error>();
            }

            if (multiProviderSearchQuery.error) {
              return createErrorResult<SearchResult[], Error>(
                new Error(multiProviderSearchQuery.error instanceof Error ? multiProviderSearchQuery.error.message : String(multiProviderSearchQuery.error) || 'Multi-provider search failed')
              );
            }

            if (multiProviderSearchQuery.data) {
              return createSuccessResult<SearchResult[], Error>(
                multiProviderSearchQuery.data as SearchResult[]
              );
            }

            return createIdleResult<SearchResult[], Error>();
          })();

          return (
            <SearchResultsGridAsync
              searchStatus={searchStatus}
              {...(onSelectResult !== undefined && { onSelectResult })}
              {...(selectedResult !== null && { selectedResult })}
              onRetry={() => { void multiProviderSearchQuery.refetch(); }}
              emptyMessage="No results found across all providers. Try a different search query."
              loadingMessage="Searching all providers..." />);

        } else {
          // Use regular provider-specific search
          const searchStatus = (() => {
            if (isLoading) {
              return createLoadingResult<SearchResult[], Error>();
            }

            if (errorMessage) {
              return createErrorResult<SearchResult[], Error>(new Error(errorMessage));
            }

            // searchCompleted = true means the search was successful (even if empty results)
            if (searchCompleted) {
              return createSuccessResult<SearchResult[], Error>(results);
            }

            // Default idle state
            return createIdleResult<SearchResult[], Error>();
          })();

          return (
            <SearchResultsGridAsync
              searchStatus={searchStatus}
              {...(onSelectResult !== undefined && { onSelectResult })}
              {...(selectedResult !== null && { selectedResult })}
              onRetry={triggerSearch}
              emptyMessage="No results found. Try a different search query or provider."
              loadingMessage="Searching manga..." />);

        }
      })()}
    </Box>);

}