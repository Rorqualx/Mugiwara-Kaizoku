/**
 * CorePlugins Component
 *
 * Manages the core manga source integrations (Suwayomi).
 * Provides source management and integration configuration.
 *
 * Features:
 * - Source filtering and management
 * - Integration configuration
 * - Status indicators and loading states
 *
 * @module components/system/plugins/CorePlugins
 */

import React from "react";

import { Box, Paper, Text, SimpleGrid, Loader } from "@mantine/core";

import type { UnifiedSource } from '@/types/sources';

import { SourceCard } from "../SourceCard";
import { SourceFilters } from "../SourceFilters";

interface CorePluginsProps {
  /** Array of all sources */
  sources: UnifiedSource[];
  /** Array of filtered sources based on current filters */
  filteredSources: UnifiedSource[];
  /** Handler for filtered sources change */
  onFilteredSourcesChange: (sources: UnifiedSource[]) => void;
  /** Handler for toggling source enabled state */
  toggleSource: (sourceId: string, enabled: boolean, sourceType: 'suwayomi') => void;
  /** Loading state tracker for source toggles */
  toggleLoading: Record<string, boolean>;
  /** Sources query object for loading/error states */
  sourcesQuery: {
    isLoading: boolean;
    isError: boolean;
    error?: unknown;
    data?: unknown;
  };
}

/**
 * Core Plugins Component
 *
 * Handles both integration settings and source management for
 * core manga integrations (Suwayomi).
 * 
 * @param {CorePluginsProps} props - Component props
 * @returns {JSX.Element} Core plugins interface
 */
export function CorePlugins({
  sources,
  filteredSources,
  onFilteredSourcesChange,
  toggleSource,
  toggleLoading,
  sourcesQuery
}: CorePluginsProps): React.ReactElement {
  return (
    <Box>
      {/* Sources Section */}
      <Box mb="xl">
        <Text fw={700} size="xl" mb="md">Sources</Text>
        
        {/* Source filters */}
        {!sourcesQuery.isLoading && !sourcesQuery.isError && sources.length > 0 &&
        <SourceFilters
          sources={sources}
          onFilteredSourcesChange={onFilteredSourcesChange} />

        }

        {/* Suwayomi-only alert removed - Mangal integration deprecated */}

        {sourcesQuery.isLoading ?
        <Box style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <Loader size="md" />
          </Box> :
        sourcesQuery.isError ?
        <Paper p="md" bg="dark.8" style={{ borderLeft: '4px solid #f44336' }}>
            <Text c="red">Error loading sources. Please try again later.</Text>
          </Paper> :
        filteredSources.length === 0 ?
        <Paper p="md" bg="dark.7">
            <Text ta="center">
              {sources.length === 0 ?
            "No sources found. Make sure Suwayomi is properly configured." :
            "No sources match your filter criteria. Try adjusting your filters."}
            </Text>
          </Paper> :

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {filteredSources.map((source) =>
          <SourceCard
            key={source["id"]}
            source={source}
            isLoading={toggleLoading[source["id"]] || false}
            onToggle={toggleSource} />

          )}
          </SimpleGrid>
        }
      </Box>

    </Box>);

}