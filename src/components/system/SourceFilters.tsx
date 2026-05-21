/**
 * SourceFilters component for filtering and sorting manga sources
 * 
 * This component provides a comprehensive filtering interface for manga sources,
 * allowing users to search, filter, and sort sources based on various criteria.
 * It supports:
 * - Full-text search across name, description, and author
 * - Source type filtering (Mangal/Suwayomi)
 * - Language filtering
 * - Multiple sorting options
 * 
 * @remarks
 * Filter Criteria:
 * - Text Search: Matches against source name, description, and author
 * - Source Type: Filter by Mangal or Suwayomi sources
 * - Language: Filter by source language
 * 
 * Sort Options:
 * - Name (A-Z): Alphabetical ascending
 * - Name (Z-A): Alphabetical descending
 * - Enabled First: Show enabled sources before disabled ones
 * - Disabled First: Show disabled sources before enabled ones
 * 
 * @example
 * ```tsx
 * // Basic usage with source list
 * function SourcesPage() {
 *   const [filteredSources, setFilteredSources] = useState<UnifiedSource[]>([]);
 *   
 *   const sources = [
 *     {
 *       name: 'Manganelo',
 *       sourceType: 'mangal',
 *       enabled: true,
 *       lang: 'en',
 *       // ... other source properties
 *     },
 *     // ... more sources
 *   ];
 * 
 *   return (
 *     <SourceFilters
 *       sources={sources}
 *       onFilteredSourcesChange={setFilteredSources}
 *     />
 *   );
 * }
 * ```
 */

import React from "react";
import { useState, useEffect } from 'react';

import { Group, TextInput, SegmentedControl, Select, Box, Tooltip } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconSearch } from '@tabler/icons-react';
import { IconFilter } from '@tabler/icons-react';

import type { UnifiedSource } from '@/types/sources';

/**
 * Props for the SourceFilters component
 */
interface SourceFiltersProps {
  /** Array of all available sources to filter */
  sources: UnifiedSource[];
  /** Callback function that receives the filtered sources array */
  onFilteredSourcesChange: (filteredSources: UnifiedSource[]) => void;
}

/** Sort options for source ordering */
type SortOption = 'name-asc' | 'name-desc' | 'enabled-first' | 'disabled-first';

/** Filter options for source types */
type FilterType = 'all' | 'mangal' | 'suwayomi';

export function SourceFilters({ sources, onFilteredSourcesChange }: SourceFiltersProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceType, setSourceType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [languageFilter, setLanguageFilter] = useState<string>('all');

  // Get unique languages from sources
  const languages = ['all', ...Array.from(new Set(sources.
  filter((s) => s.lang).
  map((s) => s.lang?.toLowerCase() ?? '')))];


  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...sources];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((source) =>
      source["name"].toLowerCase().includes(query) ||
      source["description"].toLowerCase().includes(query) ||
      source.author.toLowerCase().includes(query)
      );
    }

    // Filter by source type
    if (sourceType !== 'all') {
      filtered = filtered.filter((source) => source.sourceType === sourceType);
    }

    // Filter by language
    if (languageFilter !== 'all') {
      filtered = filtered.filter((source) =>
      source.lang?.toLowerCase() === languageFilter.toLowerCase()
      );
    }

    // Sort sources
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a["name"].localeCompare(b["name"]);
        case 'name-desc':
          return b["name"].localeCompare(a["name"]);
        case 'enabled-first':
          return a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1;
        case 'disabled-first':
          return a.enabled === b.enabled ? 0 : a.enabled ? 1 : -1;
        default:
          return 0;
      }
    });

    onFilteredSourcesChange(filtered);
  }, [sources, searchQuery, sourceType, sortBy, languageFilter, onFilteredSourcesChange]);

  // Calculate stats for filters
  const totalSources = sources.length;
  const enabledSources = sources.filter((s) => s.enabled).length;
  const _mangalCount = 0; // Mangal is deprecated
  // All sources are suwayomi type, so just use totalSources
  const _suwayomiCount = totalSources;

  return (
    <Box mb="xl" bg="dark.7" p="lg" style={{ borderRadius: '8px' }}>
      <Group align="flex-end" mb="md">
        <TextInput
          label="Search Sources"
          placeholder="Search by name, description, or author..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          style={{ flex: 1 }}
          leftSection={<IconSearch size={16} />}
          description="Full-text search across all source fields" />

        
        <Tooltip label="Filter by language">
          <Select
            label="Language"
            value={languageFilter}
            onChange={(value) => setLanguageFilter(value ?? 'all')}
            data={languages.map((lang) => ({
              value: lang,
              label: lang === 'all' ? 'All Languages' : lang.toUpperCase()
            }))}
            style={{ width: 150 }}
            leftSection={<IconFilter size={16} />} />

        </Tooltip>
        
        <Tooltip label="Choose sorting method">
          <Select
            label="Sort By"
            value={sortBy}
            onChange={(value) => value && setSortBy(value as SortOption)}
            data={[
            { value: 'name-asc', label: 'Name (A-Z)' },
            { value: 'name-desc', label: 'Name (Z-A)' },
            { value: 'enabled-first', label: 'Enabled First' },
            { value: 'disabled-first', label: 'Disabled First' }]
            }
            style={{ width: 180 }} />

        </Tooltip>
      </Group>
      
      <SegmentedControl
        value={sourceType}
        onChange={(value) => setSourceType(value as FilterType)}
        data={[
        { label: `All Sources (${totalSources})`, value: 'all' },
        // Mangal option removed - deprecated
        { label: `Suwayomi (${_suwayomiCount})`, value: 'suwayomi' }]
        }
        fullWidth />


      <Group justify="space-between" mt="xs" style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>
        <span>{totalSources} total sources</span>
        <span>{enabledSources} enabled / {totalSources - enabledSources} disabled</span>
      </Group>
    </Box>);

}