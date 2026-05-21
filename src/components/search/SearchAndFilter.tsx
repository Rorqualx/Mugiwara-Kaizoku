/**
 * Component for manga search with advanced filtering options
 *
 * This component provides a search interface with multiple filtering capabilities,
 * including source filtering, status filtering, and optional AniList integration.
 * It uses debounced search and maintains filter state in the global store.
 *
 * @remarks
 * Features:
 * - Debounced search input
 * - Source and status filters
 * - Genre and tag chips
 * - AniList integration toggle
 * - Advanced search modal trigger
 *
 * Filter Categories:
 * - Sources: Manga sources (e.g., AniList, ComicVine, Fandom, Wikipedia)
 * - Status: Manga status (e.g., Ongoing, Completed)
 * - Genres: Manga genres from metadata
 * - Tags: Additional tags from metadata
 *
 * State Management:
 * - Local state for search term
 * - Global store for filters
 * - Debounced search updates
 * - Dynamic filter options based on manga list
 *
 * @example
 * ```tsx
 * // Basic usage without AniList integration
 * <SearchAndFilter />
 *
 * // With AniList integration
 * <SearchAndFilter
 *   anilistEnabled={true}
 *   anilistUseForMetadata={true}
 *   onToggleAnilist={(enabled) => handleAnilistToggle(enabled)}
 *   onToggleAnilistMetadata={(useForMeta) => handleMetadataToggle(useForMeta)}
 * />
 * ```
 */
import React from "react";
import { useEffect, useMemo, useState } from 'react';

import { Box, TextInput, MultiSelect, Group, ActionIcon, Chip, Switch, Text, Stack } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconSearch } from '@tabler/icons-react';
import { IconFilter } from '@tabler/icons-react';
import { IconX } from '@tabler/icons-react';

import type { FilterState } from '@/store/uiSlice';
import { useStoreActions } from '@/store/useStoreActions';
import { useStoreSelectors } from '@/store/useStoreSelectors';
import { logger } from '@/utils/logger';
import { isObject } from '@/utils/type-guards';


/**
 * Props for the SearchAndFilter component
 */
interface SearchAndFilterProps {
    /** Whether AniList integration is enabled */
    anilistEnabled?: boolean;
    /** Whether to use AniList for metadata enrichment */
    anilistUseForMetadata?: boolean;
    /** Handler for toggling AniList integration */
    onToggleAnilist?: (enabled: boolean) => void;
    /** Handler for toggling AniList metadata usage */
    onToggleAnilistMetadata?: (useForMetadata: boolean) => void;
}
export function SearchAndFilter({ anilistEnabled = true, anilistUseForMetadata = true, onToggleAnilist, onToggleAnilistMetadata }: SearchAndFilterProps = {}): React.ReactElement {
    /** Get manga list and current filters from store */
    const { mangaList, filters } = useStoreSelectors();
    /** Get store actions for updating filters and modals */
    const storeActions = useStoreActions();
    const setFilters = storeActions['setFilters'] as (updates: Partial<FilterState>) => void;
    const setModal = storeActions['setModal'] as (modalId: string | null) => void;
    /** Local state for search term with debouncing */
    const [searchTerm, setSearchTerm] = useState(filters.searchTerm);
    const [debouncedSearch] = useDebouncedValue(searchTerm, 300);
    /**
     * Compute available filter options from manga list
     *
     * This memo:
     * 1. Extracts unique sources
     * 2. Extracts unique status values
     * 3. Extracts unique genres from metadata
     * 4. Extracts unique tags from metadata
     */
    const availableFilters = useMemo(() => {
        return {
            sources: [...new Set(mangaList.map((m) => m["source"]).filter(Boolean))].map((source) => ({ value: String(source), label: String(source) })),
            status: [...new Set(mangaList.map((m) => m.publicationStatus).filter(Boolean))].map((status) => ({ value: String(status), label: String(status) })),
            genres: [...new Set(mangaList.flatMap((m) => {
              const metadata = isObject(m) && 'metadata' in m ? (m as Record<string, unknown>)['metadata'] : null;
              return isObject(metadata) && 'genres' in metadata && Array.isArray((metadata as Record<string, unknown>)['genres']) ? (metadata as Record<string, unknown>)['genres'] : [];
            }).filter(Boolean))].map((genre) => ({ value: String(genre), label: String(genre) })),
            tags: [...new Set(mangaList.flatMap((m) => {
              const metadata = isObject(m) && 'metadata' in m ? (m as Record<string, unknown>)['metadata'] : null;
              return isObject(metadata) && 'tags' in metadata && Array.isArray((metadata as Record<string, unknown>)['tags']) ? (metadata as Record<string, unknown>)['tags'] : [];
            }).filter(Boolean))].map((tag) => ({ value: String(tag), label: String(tag) }))
        };
    }, [mangaList]);
    /**
     * Update global filters when search term changes
     * Uses debounced value to prevent excessive updates
     */
    useEffect(() => {
        try {
            setFilters({ searchTerm: debouncedSearch });
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.warn('Failed to update search filters:', errorMessage);
        }
    }, [debouncedSearch, setFilters]);
    return (<Box data-testid="search-container">
      {/* AniList Integration Section */}
      {onToggleAnilist &&
            <Stack mb="md" data-testid="anilist-integration-section">
          <Group justify="space-between">
            <Text size="sm" fw={500} data-testid="anilist-integration-title">AniList Integration</Text>
            <Switch label="Enabled" checked={anilistEnabled} onChange={(event) => onToggleAnilist(event.currentTarget.checked)} data-testid="anilist-enabled-switch"/>

          </Group>
          
          {anilistEnabled && onToggleAnilistMetadata &&
                    <Group justify="space-between" pl="md" data-testid="anilist-metadata-section">
              <Text size="sm" data-testid="anilist-metadata-label">Use for metadata</Text>
              <Switch checked={anilistUseForMetadata} onChange={(event) => onToggleAnilistMetadata(event.currentTarget.checked)} data-testid="anilist-metadata-switch"/>

            </Group>}
        </Stack>}

      {/* Search Bar with Clear Button */}
      <Group justify="space-between" mb="md">
        <TextInput data-testid="search-input" placeholder="Search manga..." value={searchTerm} onChange={(e) => setSearchTerm(e.currentTarget.value)} leftSection={<IconSearch size={16} data-testid="icon-search"/>} rightSection={searchTerm &&
            <ActionIcon onClick={() => {
                    setSearchTerm('');
                    try {
                        setFilters({ searchTerm: '' });
                    }
                    catch (error: unknown) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        logger.warn('Failed to clear search filters:', errorMessage);
                    }
                }} variant="subtle" color="gray" title="Clear search" data-testid="clear-search-button">

                <IconX size={16}/>
              </ActionIcon>} w="100%"/>

        <ActionIcon variant="light" onClick={() => {
            try {
                setModal('advancedSearch');
            }
            catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.warn('Failed to open advanced search modal:', errorMessage);
            }
        }} title="Advanced search options" data-testid="advanced-search-button">

          <IconFilter size={16} data-testid="icon-filter"/>
        </ActionIcon>
      </Group>

      {/* Source and Status Filters */}
      <Group gap="xs" mb="md" data-testid="filter-group">
        <MultiSelect data-testid="filter-sources" data={availableFilters.sources} value={filters.sources} onChange={(value) => {
            try {
                setFilters({ sources: value });
            }
            catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.warn('Failed to update source filters:', errorMessage);
            }
        }} placeholder="Sources" searchable clearable size="xs"/>

        <MultiSelect data-testid="filter-status" data={availableFilters["status"]} value={filters.status} onChange={(value) => {
            try {
                setFilters({ status: value });
            }
            catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.warn('Failed to update status filters:', errorMessage);
            }
        }} placeholder="Status" searchable clearable size="xs"/>

      </Group>

      {/* Active Genre and Tag Filters */}
      {(filters.genres.length > 0 || filters.tags.length > 0) &&
            <Group gap="xs" data-testid="filter-chips-group">
          {/* Genre chips - filled variant */}
          {filters.genres.map((genre) => <Chip key={genre} defaultChecked onChange={() => {
                        try {
                            setFilters({
                                genres: filters.genres.filter((g) => g !== genre)
                            });
                        }
                        catch (error: unknown) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            logger.warn('Failed to update genre filters:', errorMessage);
                        }
                    }} size="xs" variant="filled" data-testid="filter-chip" data-type="genre" data-value={genre}>

              {genre}
            </Chip>)}
          {/* Tag chips - light variant */}
          {filters.tags.map((tag) => <Chip key={tag} defaultChecked onChange={() => {
                        try {
                            setFilters({
                                tags: filters.tags.filter((t) => t !== tag)
                            });
                        }
                        catch (error: unknown) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            logger.warn('Failed to update tag filters:', errorMessage);
                        }
                    }} size="xs" variant="light" data-testid="filter-chip" data-type="tag" data-value={tag}>

              {tag}
            </Chip>)}
        </Group>}
    </Box>);
}
