/**
 * Component for searching manga across multiple providers
 * 
 * This component provides a search interface with real-time results,
 * loading states, and manga selection handling. It uses the useSearch
 * hook to manage search state and operations.
 * 
 * @remarks
 * Features:
 * - Real-time search with debouncing
 * - Loading state indication
 * - Search results display
 * - Manga selection handling
 * 
 * Search Flow:
 * 1. User enters search query
 * 2. Query is debounced (handled by useSearch)
 * 3. Loading state is shown
 * 4. Results are displayed
 * 5. User can select a manga
 * 
 * Visual States:
 * - Empty: Just search input
 * - Loading: Search with overlay
 * - Results: Search with results list
 * - No Results: Search with empty state
 * 
 * @example
 * ```tsx
 * // Basic usage in a page
 * function SearchPage() {
 *   return (
 *     <Container>
 *       <Title>Search Manga</Title>
 *       <Search />
 *     </Container>
 *   );
 * }
 * ```
 */
import React from "react";

import {
  TextInput,
  Stack,
  Paper,
  LoadingOverlay } from
'@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconSearch } from '@tabler/icons-react';

import { useSearch } from '@/hooks/useSearch';
import type { SearchResult } from '@/types/search.types';

import { SearchResults } from './SearchResults';

export function Search(): JSX.Element {
  /**
   * Hook for managing search state and operations
   * 
   * Provides:
   * - Query state management
   * - Results handling
   * - Loading state
   * - Manga selection
   */
  const {
    query,
    setQuery,
    results,
    handleMangaSelect, isLoading
  } = useSearch('main');

  /**
   * Handle manga selection from search results
   *
   * This handler:
   * 1. Processes the selected manga
   * 2. Triggers any necessary side effects
   * 3. Updates application state
   *
   * @param manga - The selected manga from search results
   */
  const handleSelect = (manga: unknown): void => {
    if (typeof handleMangaSelect === 'function' && isSearchResult(manga)) {
      handleMangaSelect(manga);
    }
  };

  // Type guard for SearchResult
  function isSearchResult(value: unknown): value is SearchResult {
    return typeof value === 'object' && value !== null && 'title' in value && 'id' in value && 'provider' in value;
  }

  /**
   * Handle search query changes with error handling
   *
   * @param value - The new query value
   */
  const handleQueryChange = (value: string): void => {
    if (typeof setQuery === 'function') {
      setQuery(value);
    }
  };

  return (
    <Stack gap="md" data-testid="mantine-stack" data-gap="md">
      <Paper p="md" pos="relative" data-testid="mantine-paper" data-padding="md" data-position="relative">
        {/* Loading overlay for search operations */}
        <LoadingOverlay
          visible={isLoading}
          data-testid="loading-overlay"
          data-visible={isLoading} />

        
        {/* Search input with icon */}
        <TextInput
          placeholder="Search manga..."
          value={query}
          onChange={(event) => handleQueryChange(event.currentTarget.value)}
          leftSection={
          <IconSearch
            size={16}
            data-testid="icon-search"
            data-size="16" />

          }
          data-autofocus
          aria-label="Search manga"
          data-testid="search-input" />

        
        {/* Results list - only shown when there's a query */}
        {query &&
        <SearchResults
          results={results}
          onSelect={handleSelect}
          isLoading={isLoading} />

        }
      </Paper>
    </Stack>);

}