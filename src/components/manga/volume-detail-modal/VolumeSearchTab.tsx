/**
 * Volume Search Tab Component
 *
 * Displays Prowlarr search results with sortable DataTable.
 * Extracted from VolumeDetailModal.tsx (lines 391-560, 779-843)
 */

import React, { useMemo } from 'react';

import {
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Paper,
  Loader,
  Center,
  Box,
  Alert
} from '@mantine/core';
import {
  IconDownload,
  IconSearch,
  IconAlertCircle
} from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';

import { formatFileSize } from '@/utils/formatters';

import { formatAge } from './volume-detail-modal-utils';

import type { SearchResult, SortStatus } from './volume-detail-modal-types';

// ============================================================================
// Constants
// ============================================================================

/** CSS for link hover effect - defined once outside render */
const LINK_HOVER_STYLE = `
  .volume-search-link:hover {
    text-decoration: underline !important;
  }
`;

// ============================================================================
// Component Props
// ============================================================================

interface VolumeSearchTabProps {
  /** Whether search is currently loading */
  isLoading: boolean;
  /** Search results to display */
  results: SearchResult[];
  /** Error from search query */
  error?: { message: string } | null;
  /** Current sort status */
  sortStatus: SortStatus<SearchResult>;
  /** Callback when sort status changes */
  onSortStatusChange: (status: SortStatus<SearchResult>) => void;
  /** Callback when download button is clicked */
  onDownload: (result: SearchResult) => void;
  /** GUID of currently downloading result */
  downloadingGuid: string | null;
}

// ============================================================================
// Component
// ============================================================================

export function VolumeSearchTab({
  isLoading,
  results,
  error,
  sortStatus,
  onSortStatusChange,
  onDownload,
  downloadingGuid
}: VolumeSearchTabProps): JSX.Element {
  // Define table columns with sorting configuration
  const searchColumns = useMemo(() => [
    {
      accessor: 'protocol',
      title: 'Source',
      sortable: true,
      width: 100,
      render: (record: SearchResult): JSX.Element => {
        const isTorrent = record.protocol?.toLowerCase() === 'torrent';
        return (
          <Badge size="sm" color={isTorrent ? 'green' : 'blue'}>
            {record.protocol?.toUpperCase() ?? 'Unknown'}
          </Badge>
        );
      }
    },
    {
      accessor: 'publishDate',
      title: 'Age',
      sortable: true,
      width: 120,
      render: (record: SearchResult): JSX.Element => (
        <Text size="sm">{formatAge(record.publishDate)}</Text>
      )
    },
    {
      accessor: 'title',
      title: 'Title',
      sortable: true,
      width: '30%',
      render: (record: SearchResult): JSX.Element => {
        if (record.infoUrl) {
          return (
            <a
              href={record.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--mantine-color-blue-4)', textDecoration: 'none' }}
              className="volume-search-link"
            >
              <Text size="sm" lineClamp={2} style={{ wordBreak: 'break-word' }}>
                {record.title}
              </Text>
            </a>
          );
        }

        return (
          <Text size="sm" lineClamp={2} style={{ wordBreak: 'break-word' }}>
            {record.title}
          </Text>
        );
      }
    },
    {
      accessor: 'indexerName',
      title: 'Indexer',
      sortable: true,
      width: 120,
      render: (record: SearchResult): JSX.Element => (
        <Badge size="sm" variant="light">
          {record.indexerName}
        </Badge>
      )
    },
    {
      accessor: 'size',
      title: 'Size',
      sortable: true,
      width: 100,
      render: (record: SearchResult): JSX.Element => (
        <Text size="sm">{formatFileSize(record.size)}</Text>
      )
    },
    {
      accessor: 'seeders',
      title: 'Peers',
      sortable: true,
      width: 110,
      render: (record: SearchResult): JSX.Element => {
        // Only show peers for torrents, usenet uses direct server connections
        const isTorrent = record.protocol?.toLowerCase() === 'torrent';

        if (!isTorrent) {
          return <Text size="sm" c="dimmed">N/A</Text>;
        }

        return (
          <Group gap="xs">
            <Badge size="sm" color="green" variant="light">
              �{record.seeders ?? 0}
            </Badge>
            <Badge size="sm" color="red" variant="light">
              �{record.leechers ?? 0}
            </Badge>
          </Group>
        );
      }
    },
    {
      accessor: 'audioLanguage',
      title: 'Language',
      sortable: true,
      width: 120,
      render: (record: SearchResult): JSX.Element => {
        if (!record.audioLanguage && (!record.languages || record.languages.length === 0)) {
          return <Text size="sm" c="dimmed">Unknown</Text>;
        }

        return (
          <Group gap={4}>
            <Badge
              size="sm"
              variant="light"
              color={record.isOfficial ? 'green' : 'blue'}
            >
              {record.audioLanguage ?? record.languages?.[0] ?? 'Unknown'}
            </Badge>
            {record.isMultiLanguage && (
              <Badge size="sm" variant="dot" color="grape">
                MULTI
              </Badge>
            )}
          </Group>
        );
      }
    },
    {
      accessor: 'format',
      title: 'Format',
      sortable: true,
      width: 90,
      render: (record: SearchResult): JSX.Element => {
        if (!record.format) {
          return <Text size="sm" c="dimmed">N/A</Text>;
        }

        // Color-code based on format type
        const formatColor =
          record.format === 'CBZ' || record.format === 'CBR' ? 'violet' :
          record.format === 'PDF' ? 'red' :
          record.format === 'EPUB' ? 'teal' : 'gray';

        return (
          <Badge
            size="sm"
            variant="filled"
            color={formatColor}
          >
            {record.format}
          </Badge>
        );
      }
    },
    {
      accessor: 'actions',
      title: 'Actions',
      sortable: false,
      width: 110,
      render: (record: SearchResult): JSX.Element => (
        <Button
          size="xs"
          leftSection={<IconDownload size={14} />}
          onClick={() => onDownload(record)}
          loading={downloadingGuid === record.guid}
        >
          Download
        </Button>
      )
    }
  ], [downloadingGuid, onDownload]);

  return (
    <>
      {/* Global style for link hover - rendered once */}
      <style>{LINK_HOVER_STYLE}</style>

      <Stack gap="md">
        {/* Loading State */}
        {isLoading && (
          <Center p="xl">
            <Loader size="lg" />
          </Center>
        )}

        {/* Search Results Table */}
        {!isLoading && results.length > 0 && (
          <Box style={{ position: 'relative', height: 'calc(100vh - 400px)', minHeight: '400px' }}>
            <DataTable
              columns={searchColumns}
              records={results}
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

        {/* Empty State - No Results */}
        {!isLoading && results.length === 0 && !error && (
          <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
            <IconSearch size={48} color="var(--mantine-color-dimmed)" />
            <Text size="lg" c="dimmed" mt="md">
              No results found
            </Text>
            <Text size="sm" c="dimmed" mt="xs">
              Try adjusting your search or check Prowlarr indexers
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
    </>
  );
}
