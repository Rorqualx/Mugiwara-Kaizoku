/**
 * Search Results Table Columns
 *
 * Column definitions for the DataTable in UnifiedSearchModal.
 *
 * @module SearchResultsColumns
 */

import * as React from 'react';
import { useMemo, useCallback } from 'react';

import { Group, Text, Badge, Button, Anchor } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';

import { formatFileSize, formatChapterRange } from '@/utils/formatters';

import type { EnrichedSearchResult } from './search-modal-types';
import type { DataTableColumn } from 'mantine-datatable';

/**
 * Props for useSearchResultsColumns hook
 */
export interface UseSearchResultsColumnsProps {
  /** Currently downloading result ID */
  downloadingId: string | null;
  /** Handler for download action */
  onDownload: (record: EnrichedSearchResult) => void;
  /** Whether download is available */
  canDownload: boolean;
}

/**
 * Hook that creates column definitions for search results DataTable
 */
export function useSearchResultsColumns({
  downloadingId,
  onDownload,
  canDownload,
}: UseSearchResultsColumnsProps): DataTableColumn<EnrichedSearchResult>[] {
  const handleDownload = useCallback(
    (record: EnrichedSearchResult) => {
      onDownload(record);
    },
    [onDownload]
  );

  return useMemo(
    () => [
      {
        accessor: 'title',
        title: 'Title',
        sortable: true,
        width: '30%',
        render: (record: EnrichedSearchResult) =>
          record.infoUrl ? (
            <Anchor
              href={record.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
              c="blue.4"
              underline="hover"
            >
              <Text size="sm" lineClamp={2} style={{ wordBreak: 'break-word' }}>
                {record.title}
              </Text>
            </Anchor>
          ) : (
            <Text size="sm" lineClamp={2} style={{ wordBreak: 'break-word' }}>
              {record.title}
            </Text>
          ),
      },
      {
        accessor: 'indexer',
        title: 'Source',
        sortable: true,
        width: 100,
        render: (record: EnrichedSearchResult) => (
          <Badge size="sm" variant="dot">
            {record.indexer}
          </Badge>
        ),
      },
      {
        accessor: 'size',
        title: 'Size',
        sortable: true,
        width: 90,
        render: (record: EnrichedSearchResult) => (
          <Badge size="sm" color="blue">
            {formatFileSize(record.size)}
          </Badge>
        ),
      },
      {
        accessor: 'seeders',
        title: 'Seeds',
        sortable: true,
        width: 80,
        render: (record: EnrichedSearchResult) => (
          <Badge size="sm" color={record.seeders > 10 ? 'green' : record.seeders > 0 ? 'yellow' : 'red'}>
            {record.seeders}
          </Badge>
        ),
      },
      {
        accessor: 'coveragePercent',
        title: 'Coverage',
        sortable: true,
        width: 100,
        render: (record: EnrichedSearchResult) =>
          record.includedMissing.length > 0 ? (
            <Badge
              size="sm"
              color={record.coveragePercent === 100 ? 'green' : record.coveragePercent > 50 ? 'yellow' : 'orange'}
            >
              {record.coveragePercent}%
            </Badge>
          ) : (
            <Text size="sm" c="dimmed">
              -
            </Text>
          ),
      },
      {
        accessor: 'chapters',
        title: 'Chapters',
        sortable: false,
        width: 120,
        render: (record: EnrichedSearchResult) => (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {record.chapters.length > 0 ? formatChapterRange(record.chapters) : '-'}
          </Text>
        ),
      },
      {
        accessor: 'format',
        title: 'Format',
        sortable: true,
        width: 80,
        render: (record: EnrichedSearchResult) => {
          if (!record.format) return <Text size="xs" c="dimmed">-</Text>;

          const formatColor =
            record.format === 'CBZ' || record.format === 'CBR'
              ? 'violet'
              : record.format === 'PDF'
                ? 'red'
                : record.format === 'EPUB'
                  ? 'teal'
                  : 'gray';

          return (
            <Badge size="sm" variant="filled" color={formatColor}>
              {record.format}
            </Badge>
          );
        },
      },
      {
        accessor: 'isOfficial',
        title: 'Quality',
        sortable: true,
        width: 90,
        render: (record: EnrichedSearchResult) => (
          <Group gap={4}>
            {record.isOfficial && (
              <Badge size="xs" color="green">
                Official
              </Badge>
            )}
            {record.isMultiLanguage && (
              <Badge size="xs" color="grape">
                Multi
              </Badge>
            )}
          </Group>
        ),
      },
      {
        accessor: 'actions',
        title: '',
        sortable: false,
        width: 100,
        render: (record: EnrichedSearchResult) => (
          <Button
            size="xs"
            onClick={() => handleDownload(record)}
            loading={downloadingId === record.id}
            leftSection={<IconDownload size={14} />}
            disabled={!canDownload}
          >
            Download
          </Button>
        ),
      },
    ],
    [downloadingId, handleDownload, canDownload]
  );
}
