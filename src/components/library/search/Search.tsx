/**
 * Enhanced Search Component
 * 
 * Provides advanced search capabilities with:
 * - Multi-field search
 * - Search suggestions from history
 * - Regex support toggle
 * - Field selector
 * 
 * Note: This component doesn't directly filter manga, it manages search state
 * that other components can use for filtering.
 * 
 * @module components/library/search/Search
 */

import React, { useState, useCallback, useMemo } from 'react';

import {
  TextInput,
  ActionIcon,
  Menu,
  Select,
  Checkbox,
  Box,
  Text,
  Stack,
  Group,
  UnstyledButton,
  CloseButton,
  Paper } from
'@mantine/core';
import {
  IconSearch,
  IconX,
  IconChevronDown,
  IconClock,
  IconCode } from
'@tabler/icons-react';

import { useLibraryViewStore } from '@/store/index';
import type { SearchField } from '@/store/libraryViewSlice';

/**
 * Enhanced search component with advanced features
 */
export function Search(): React.ReactElement {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Get search state and actions from store
  const {
    searchQuery,
    searchField,
    searchHistory,
    enableRegexSearch,
    setSearchQuery,
    setSearchField,
    setEnableRegexSearch,
    addToSearchHistory,
    removeFromSearchHistory,
    clearSearchHistory
  } = useLibraryViewStore();

  // Search field options
  const searchFieldOptions = [
  { value: 'all', label: 'All Fields' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'artist', label: 'Artist' },
  { value: 'genre', label: 'Genre' },
  { value: 'tag', label: 'Tag' }];


  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!inputValue) return searchHistory.slice(0, 5);

    const query = inputValue.toLowerCase();
    return searchHistory.
    filter((item) => item.toLowerCase().includes(query)).
    slice(0, 5);
  }, [inputValue, searchHistory]);

  /**
   * Handle search submission
   */
  const handleSearch = useCallback((value: string) => {
    const trimmedValue = value.trim();
    setSearchQuery(trimmedValue);

    // Add to history if not empty
    if (trimmedValue) {
      addToSearchHistory(trimmedValue);
    }

    setShowSuggestions(false);
  }, [setSearchQuery, addToSearchHistory]);

  /**
   * Handle suggestion selection
   */
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion);
    handleSearch(suggestion);
  }, [handleSearch]);

  /**
   * Handle input change
   */
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    setInputValue(value);

    // Show suggestions when typing
    if (value || searchHistory.length > 0) {
      setShowSuggestions(true);
    }
  }, [searchHistory.length]);

  /**
   * Clear search
   */
  const handleClearSearch = useCallback(() => {
    setInputValue('');
    setSearchQuery('');
    setShowSuggestions(false);
  }, [setSearchQuery]);

  /**
   * Handle focus
   */
  const handleFocus = useCallback(() => {
    if (inputValue || searchHistory.length > 0) {
      setShowSuggestions(true);
    }
  }, [inputValue, searchHistory.length]);

  /**
   * Handle blur
   */
  const handleBlur = useCallback(() => {
    // Delay to allow clicking suggestions
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  // Sync input with store search query
  React.useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  return (
    <Box style={{ position: 'relative' }}>
      <Group gap="xs">
        {/* Field selector */}
        <Select
          value={searchField}
          onChange={(value) => setSearchField(value as SearchField)}
          data={searchFieldOptions}
          size="sm"
          w={130}
          styles={{
            input: {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)'
            }
          }} />

        
        {/* Search input */}
        <Box style={{ flex: 1, position: 'relative' }}>
          <TextInput
            placeholder={`Search ${searchField === 'all' ? 'manga' : `by ${searchField}`}...`}
            leftSection={<IconSearch size={16} />}
            rightSection={
            <Group gap={4}>
                {inputValue &&
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={handleClearSearch}>

                    <IconX size={14} />
                  </ActionIcon>
              }
                <Menu width={200} position="bottom-end">
                  <Menu.Target>
                    <ActionIcon size="sm" variant="subtle">
                      <IconChevronDown size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Search Options</Menu.Label>
                    <Menu.Item
                    leftSection={
                    <Checkbox
                      checked={enableRegexSearch}
                      onChange={() => {}}
                      size="xs" />

                    }
                    onClick={() => setEnableRegexSearch(!enableRegexSearch)}>

                      <Group gap="xs">
                        <IconCode size={14} />
                        <Text size="sm">Regex Search</Text>
                      </Group>
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                    color="red"
                    onClick={clearSearchHistory}
                    disabled={searchHistory.length === 0}>

                      Clear Search History
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            }
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSearch(inputValue);
              }
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            styles={{
              input: {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                paddingRight: inputValue ? 60 : 40
              }
            }} />

          
          {/* Search suggestions dropdown */}
          {showSuggestions && (searchHistory.length > 0 || inputValue) &&
          <Paper
            shadow="md"
            p="xs"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1000,
              marginTop: 4,
              maxHeight: 200,
              overflowY: 'auto'
            }}>

              <Stack gap={4}>
                {filteredSuggestions.length > 0 ?
              <>
                    <Text size="xs" c="dimmed" fw={500} px="xs">
                      Recent Searches
                    </Text>
                    {filteredSuggestions.map((suggestion, index) =>
                <Group
                  key={`${suggestion}-${index}`}
                  gap="xs"
                  style={{ position: 'relative' }}>

                        <UnstyledButton
                    onClick={() => handleSuggestionClick(suggestion)}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      borderRadius: 4,
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)'
                      }
                    }}>

                          <Group gap="xs">
                            <IconClock size={14} style={{ opacity: 0.5 }} />
                            <Text size="sm" style={{ flex: 1 }}>
                              {suggestion}
                            </Text>
                          </Group>
                        </UnstyledButton>
                        <CloseButton
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromSearchHistory(suggestion);
                    }}
                    style={{
                      position: 'absolute',
                      right: 4,
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }} />

                      </Group>
                )}
                  </> :
              inputValue ?
              <Text size="sm" c="dimmed" ta="center" py="xs">
                    No matching searches found
                  </Text> :
              null}
              </Stack>
            </Paper>
          }
        </Box>
      </Group>
    </Box>);

}