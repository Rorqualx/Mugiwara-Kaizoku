/**
 * Library Search & Filter Component
 * 
 * Provides search capabilities for manga within a library.
 * Now integrated with the unified library view store for consistent state management.
 * 
 * @module components/library/search/LibrarySearchFilter
 */

import React, { useEffect, useCallback } from 'react';

import {
  TextInput,
  Box,
  ActionIcon } from
'@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';

import { useLibraryViewStore } from '@/store/index';

import type { Prisma } from '@prisma/client';

// Type for Manga with metadata included
type MangaWithMetadata = Prisma.MangaGetPayload<{
  include: {
    Metadata: true;
  };
}>;

/**
 * Props for LibrarySearchFilter component
 */
interface LibrarySearchFilterProps {
  /** All manga in the library */
  manga: MangaWithMetadata[];
  /** Callback when filtered manga list changes */
  onFilteredMangaChange: (filteredManga: MangaWithMetadata[]) => void;
  /** Whether to show the filter panel initially (kept for compatibility) */
  initialShowFilters?: boolean;
}

/**
 * Library search filter component
 * 
 * Provides a search input that filters manga by title, author, and alternative titles.
 * Integrates with the unified library view store for persistent search state.
 * 
 * @component
 */
export function LibrarySearchFilter({
  manga,
  onFilteredMangaChange
}: LibrarySearchFilterProps): React.ReactElement {
  // Get search state and actions from store
  const searchQuery = useLibraryViewStore((state) => state.searchQuery);
  const setSearchQuery = useLibraryViewStore((state) => state.setSearchQuery);

  /**
   * Filter manga based on search query
   */
  useEffect(() => {
    if (!searchQuery) {
      // If no search query, return all manga
      onFilteredMangaChange(manga);
      return;
    }

    // Filter manga by search query
    const query = searchQuery.toLowerCase();
    const filtered = manga.filter((m) => {
      // Check title
      if (m["title"].toLowerCase().includes(query)) return true;

      // Check alternative titles (synonyms) in metadata
      const synonyms = m.Metadata?.synonyms;
      if (Array.isArray(synonyms) && synonyms.some((t) => t.toLowerCase().includes(query))) {
        return true;
      }

      // Check authors in metadata
      const authors = m.Metadata?.authors;
      if (Array.isArray(authors) && authors.some((a) => a.toLowerCase().includes(query))) {
        return true;
      }

      // Check artists in metadata
      const artists = m.Metadata?.artists;
      if (Array.isArray(artists) && artists.some((a) => a.toLowerCase().includes(query))) {
        return true;
      }

      return false;
    });

    onFilteredMangaChange(filtered);
  }, [manga, searchQuery, onFilteredMangaChange]);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, [setSearchQuery]);

  /**
   * Clear search query
   */
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  return (
    <Box mb="md">
      <TextInput
        placeholder="Search manga by title, author, or artist..."
        leftSection={<IconSearch size={16} />}
        rightSection={
        searchQuery &&
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={handleClearSearch}
          aria-label="Clear search">

              <IconX size={14} />
            </ActionIcon>

        }
        value={searchQuery}
        onChange={(event) => handleSearchChange(event.currentTarget.value)}
        styles={{
          input: {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            '&:focus': {
              borderColor: 'rgba(255, 255, 255, 0.3)'
            }
          }
        }} />

    </Box>);

}