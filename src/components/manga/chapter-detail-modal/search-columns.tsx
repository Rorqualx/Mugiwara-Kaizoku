/**
 * Chapter Detail Modal - Search Columns
 *
 * DataTable column definitions for Prowlarr search results.
 *
 * Extracted from: ChapterDetailModal.tsx (lines 352-520)
 */

import { useMemo } from 'react';

import { Text, Badge, Group, Button } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';

import { formatFileSize } from '@/utils/formatters';

import { formatAge } from './utils';

import type { SearchResult } from './types';

// ============================================================================
// Types
// ============================================================================

interface UseSearchColumnsParams {
  downloadingGuid: string | null;
  handleDownload: (result: SearchResult) => void;
}

interface ColumnDefinition {
  accessor: string;
  title: string;
  sortable: boolean;
  width: number | string;
  render: (record: SearchResult) => JSX.Element;
}

// ============================================================================
// Styles
// ============================================================================

const linkStyles = {
  color: 'var(--mantine-color-blue-4)',
  textDecoration: 'none'
};

const linkHoverStyles = {
  textDecoration: 'underline'
};

const linkDefaultStyles = {
  textDecoration: 'none'
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook that returns DataTable column definitions for search results
 *
 * @param params - Parameters including downloadingGuid and handleDownload callback
 * @returns Array of column definitions for mantine-datatable
 */
export function useSearchColumns({
  downloadingGuid,
  handleDownload
}: UseSearchColumnsParams): ColumnDefinition[] {
  return useMemo(() => [
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
      render: (record: SearchResult): JSX.Element => (
        record.infoUrl ? (
          <a
            href={record.infoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyles}
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>): void => {
              Object.assign(e.currentTarget.style, linkHoverStyles);
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>): void => {
              Object.assign(e.currentTarget.style, linkDefaultStyles);
            }}
          >
            <Text size="sm" lineClamp={2} style={{ wordBreak: 'break-word' }}>
              {record.title}
            </Text>
          </a>
        ) : (
          <Text size="sm" lineClamp={2} style={{ wordBreak: 'break-word' }}>
            {record.title}
          </Text>
        )
      )
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
              {record.seeders ?? 0}
            </Badge>
            <Badge size="sm" color="red" variant="light">
              {record.leechers ?? 0}
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
          onClick={(): void => handleDownload(record)}
          loading={downloadingGuid === record.guid}
        >
          Download
        </Button>
      )
    }
  ], [downloadingGuid, handleDownload]);
}
