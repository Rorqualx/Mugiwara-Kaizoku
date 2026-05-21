/**
 * Library Search Component
 *
 * Provides advanced search capabilities including:
 * - Multi-field search (title, author, artist, genre, tag)
 * - Search suggestions from history
 * - Regex support
 * - Search field selection
 *
 * @module components/library/search/LibrarySearch
 */
import React, { useCallback, useState, useRef, useEffect } from 'react';

import { TextInput, Box, ActionIcon, Select, Checkbox, Group, Popover, Stack, Text, UnstyledButton, Badge, Tooltip, ScrollArea } from '@mantine/core';
import { IconSearch, IconX, IconAdjustments, IconClock, IconCode, IconTrash } from '@tabler/icons-react';

import { useLibraryViewStore } from '@/store/index';
import type { SearchField } from '@/store/libraryViewSlice';

import { getFieldValues } from './field-extractors';

import type { Prisma } from '@prisma/client';

// Type for Manga with metadata included
type MangaWithMetadata = Prisma.MangaGetPayload<{
    include: {
        Metadata: true;
        Chapter: true;
    };
}>;

/**
 * Props for EnhancedLibrarySearch component
 */
interface EnhancedLibrarySearchProps {
    /** All manga in the library */
    manga: MangaWithMetadata[];
    /** Callback when filtered manga list changes */
    onFilteredMangaChange: (filteredManga: MangaWithMetadata[]) => void;
}
/**
 * Enhanced library search component with advanced features
 *
 * @component
 */
export function LibrarySearch({ manga, onFilteredMangaChange }: EnhancedLibrarySearchProps): JSX.Element {
    // Get search state and actions from store
    const searchQuery = useLibraryViewStore((state) => state.searchQuery);
    const searchField = useLibraryViewStore((state) => state.searchField);
    const searchHistory = useLibraryViewStore((state) => state.searchHistory);
    const enableRegexSearch = useLibraryViewStore((state) => state.enableRegexSearch);
    const setSearchQuery = useLibraryViewStore((state) => state.setSearchQuery);
    const setSearchField = useLibraryViewStore((state) => state.setSearchField);
    const setEnableRegexSearch = useLibraryViewStore((state) => state.setEnableRegexSearch);
    const addToSearchHistory = useLibraryViewStore((state) => state.addToSearchHistory);
    const removeFromSearchHistory = useLibraryViewStore((state) => state.removeFromSearchHistory);
    const clearSearchHistory = useLibraryViewStore((state) => state.clearSearchHistory);
    // Local state
    const [showSettings, setShowSettings] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    /**
     * Get field-specific value from manga
     */
    const getFieldValue = useCallback((m: MangaWithMetadata, field: SearchField): string[] => {
        return getFieldValues(m, field);
    }, []);
    /**
     * Perform search with regex support
     */
    const performSearch = useCallback((query: string, values: string[]): boolean => {
        if (!query)
            return true;
        if (enableRegexSearch) {
            try {
                const regex = new RegExp(query, 'i');
                return values.some((value) => regex.test(value));
            }
            catch (_error: unknown) {
                // Invalid regex, fall back to normal search
                const lowerQuery = query.toLowerCase();
                return values.some((value) => value.toLowerCase().includes(lowerQuery));
            }
        }
        else {
            const lowerQuery = query.toLowerCase();
            return values.some((value) => value.toLowerCase().includes(lowerQuery));
        }
    }, [enableRegexSearch]);
    /**
     * Filter manga based on search settings
     */
    useEffect(() => {
        if (!searchQuery) {
            onFilteredMangaChange(manga);
            return;
        }
        const filtered = manga.filter((m) => {
            const values = getFieldValue(m, searchField);
            return performSearch(searchQuery, values);
        });
        onFilteredMangaChange(filtered);
    }, [manga, searchQuery, searchField, enableRegexSearch, onFilteredMangaChange, getFieldValue, performSearch]);
    /**
     * Handle search input change
     */
    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
        setShowSuggestions(value.length > 0);
    }, [setSearchQuery]);
    /**
     * Handle search submission (add to history)
     */
    const handleSearchSubmit = useCallback(() => {
        if (searchQuery.trim()) {
            addToSearchHistory(searchQuery.trim());
        }
    }, [searchQuery, addToSearchHistory]);
    /**
     * Clear search query
     */
    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
        setShowSuggestions(false);
    }, [setSearchQuery]);
    /**
     * Apply search from history
     */
    const handleApplyHistorySearch = useCallback((query: string) => {
        setSearchQuery(query);
        setShowSuggestions(false);
        inputRef.current?.focus();
    }, [setSearchQuery]);
    /**
     * Get matching suggestions from history
     */
    const getSuggestions = useCallback(() => {
        if (!searchQuery)
            return searchHistory;
        const query = searchQuery.toLowerCase();
        return searchHistory.filter((h) => h.toLowerCase().includes(query));
    }, [searchQuery, searchHistory]);
    const suggestions = getSuggestions();
    return (<Box mb="md">
      <Group gap="xs">
        <Box style={{ flex: 1 }}>
          <Popover opened={showSuggestions && suggestions.length > 0} position="bottom-start" width="target" shadow="md" onClose={() => setShowSuggestions(false)}>

            <Popover.Target>
              <TextInput ref={inputRef} placeholder={`Search by ${searchField === 'all' ? 'title, author, artist, genre, or tag' : searchField}...`} leftSection={<IconSearch size={16}/>} rightSectionWidth={80} rightSection={<Group gap={4} wrap="nowrap">
                    {enableRegexSearch &&
                <Badge size="xs" variant="filled" color="blue">
                        Regex
                      </Badge>}
                    {searchQuery &&
                <ActionIcon size="sm" variant="subtle" onClick={handleClearSearch} aria-label="Clear search">

                        <IconX size={14}/>
                      </ActionIcon>}
                  </Group>} value={searchQuery} onChange={(event) => handleSearchChange(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter') {
                handleSearchSubmit();
                setShowSuggestions(false);
            }
        }} onFocus={() => setShowSuggestions(true)} styles={{
            input: {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                '&:focus': {
                    borderColor: 'rgba(255, 255, 255, 0.3)'
                }
            }
        }}/>

            </Popover.Target>
            
            <Popover.Dropdown>
              <Stack gap={4}>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed" fw={500}>
                    <IconClock size={14} style={{ marginRight: 4, verticalAlign: 'middle' }}/>
                    Search History
                  </Text>
                  <ActionIcon size="xs" variant="subtle" onClick={clearSearchHistory} title="Clear history">

                    <IconTrash size={12}/>
                  </ActionIcon>
                </Group>
                
                <ScrollArea.Autosize mah={200}>
                  {suggestions.map((query, index) => <Group key={index} gap={4}>
                      <UnstyledButton onClick={() => handleApplyHistorySearch(query)} style={{
                display: 'block',
                width: '100%',
                padding: '4px 8px',
                borderRadius: 4,
                '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
            }}>

                        <Text size="sm">{query}</Text>
                      </UnstyledButton>
                      <ActionIcon size="xs" variant="subtle" onClick={() => removeFromSearchHistory(query)}>

                        <IconX size={12}/>
                      </ActionIcon>
                    </Group>)}
                </ScrollArea.Autosize>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Box>
        
        <Popover opened={showSettings} onClose={() => setShowSettings(false)} position="bottom-end" width={300}>

          <Popover.Target>
            <Tooltip label="Search settings">
              <ActionIcon variant={showSettings ? 'filled' : 'subtle'} onClick={() => setShowSettings(!showSettings)}>

                <IconAdjustments size={20}/>
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          
          <Popover.Dropdown>
            <Stack gap="md">
              <Text fw={500}>Search Settings</Text>
              
              <Select label="Search Field" value={searchField} onChange={(value) => setSearchField(value as SearchField)} data={[
            { value: 'all', label: 'All Fields' },
            { value: 'title', label: 'Title Only' },
            { value: 'author', label: 'Author Only' },
            { value: 'artist', label: 'Artist Only' },
            { value: 'genre', label: 'Genre Only' },
            { value: 'tag', label: 'Tag Only' }
        ]}/>

              
              <Checkbox label={<Group gap={4}>
                    <IconCode size={16}/>
                    <Text>Enable Regex Search</Text>
                  </Group>} checked={enableRegexSearch} onChange={(event) => setEnableRegexSearch(event.currentTarget.checked)}/>

              
              {enableRegexSearch &&
            <Text size="xs" c="dimmed">
                  Use regular expressions for advanced pattern matching.
                  Example: ^One.* to find titles starting with "One"
                </Text>}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
    </Box>);
}
