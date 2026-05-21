/**
 * Chapter Detail Modal - Search Tab
 *
 * Displays Prowlarr search results in a DataTable with
 * sorting and download actions.
 *
 * Extracted from: ChapterDetailModal.tsx (lines 659-723)
 */

import React from 'react';

import {
  Stack,
  Text,
  Alert,
  Loader,
  Center,
  Paper,
  Box
} from '@mantine/core';
import { IconSearch, IconAlertCircle } from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';

import type { SearchResult, SortStatus } from './types';

// Column definition type - using the shape expected by DataTable
interface ColumnDefinition<T> {
  accessor: keyof T | string;
  title?: string;
  sortable?: boolean;
  width?: string | number;
  render?: (record: T) => React.ReactNode;
  [key: string]: unknown;
}

interface SearchTabProps {
  isLoading: boolean;
  error: { message: string } | null;
  sortedResults: SearchResult[];
  sortStatus: SortStatus<SearchResult>;
  onSortStatusChange: (status: SortStatus<SearchResult>) => void;
  searchColumns: ColumnDefinition<SearchResult>[];
  hasData: boolean;
}

export function SearchTab({
  isLoading,
  error,
  sortedResults,
  sortStatus,
  onSortStatusChange,
  searchColumns,
  hasData
}: SearchTabProps): JSX.Element {
  return (
    <Stack gap="md">
      {/* Loading State */}
      {isLoading && (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      )}

      {/* Results Table */}
      {!isLoading && sortedResults.length > 0 && (
        <Box style={{ position: 'relative', height: 'calc(100vh - 400px)', minHeight: '400px' }}>
          <DataTable
            columns={searchColumns}
            records={sortedResults}
            sortStatus={sortStatus}
            onSortStatusChange={onSortStatusChange}
            highlightOnHover
            striped
            minHeight={200}
            idAccessor="guid"
            styles={{
              table: {
                backgroundColor: 'var(--mantine-color-dark-7)'
              },
              header: {
                backgroundColor: 'var(--mantine-color-dark-6)',
                fontWeight: 600
              }
            }}
          />
        </Box>
      )}

      {/* Empty Results */}
      {!isLoading && hasData && sortedResults.length === 0 && (
        <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
          <IconSearch size={48} color="var(--mantine-color-dimmed)" />
          <Text size="lg" c="dimmed" mt="md">
            No results found
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            Try adjusting your search query
          </Text>
        </Paper>
      )}

      {/* Searching State */}
      {!isLoading && !hasData && !error && (
        <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
          <IconSearch size={48} color="var(--mantine-color-dimmed)" />
          <Text size="lg" c="dimmed" mt="md">
            Searching Prowlarr...
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            Looking for available downloads for this chapter
          </Text>
        </Paper>
      )}

      {/* Error State */}
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          <Text size="sm">
            Error searching Prowlarr: {error.message}
          </Text>
        </Alert>
      )}
    </Stack>
  );
}
