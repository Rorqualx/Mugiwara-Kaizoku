/**
 * Table column definitions for PackSearchModal
 * Extracted to reduce file size and improve modularity
 */
import { Text, Badge, Button, Group, Anchor } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';

import { formatFileSize, formatChapterRange } from '@/utils/formatters';

import type { DataTableColumn } from 'mantine-datatable';



/**
 * Extended pack result type with calculated fields for table display
 */
export interface PackResultWithMetadata {
  id: string;
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  leechers: number;
  chapters: number[];
  publishDate?: string;
  coveragePercent: number;
  includedMissing: number[];
  relevanceScore?: number;
  infoUrl?: string;

  // Parsed metadata from releaseParser
  languages?: string[];
  audioLanguage?: string;
  isMultiLanguage?: boolean;
  isOfficial?: boolean;
  quality?: string;
  format?: string;
  publisher?: string;
}

/**
 * Column configuration parameters
 */
interface ColumnConfig {
  downloadingId: string | null;
  handleDownload: (record: PackResultWithMetadata) => void;
}

/**
 * Create table columns for pack search results
 */
export function createPackSearchColumns({ downloadingId, handleDownload }: ColumnConfig): DataTableColumn<PackResultWithMetadata>[] {
  return [
    {
      accessor: 'title',
      title: 'Title',
      sortable: true,
      width: '35%',
      render: (record: PackResultWithMetadata) => (
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
        )
      )
    },
    {
      accessor: 'indexer',
      title: 'Indexer',
      sortable: true,
      width: 120,
      render: (record: PackResultWithMetadata) => (
        <Badge size="sm" variant="dot">
          {record.indexer}
        </Badge>
      )
    },
    {
      accessor: 'size',
      title: 'Size',
      sortable: true,
      width: 100,
      render: (record: PackResultWithMetadata) => (
        <Badge size="sm" color="blue">
          {formatFileSize(record.size)}
        </Badge>
      )
    },
    {
      accessor: 'seeders',
      title: 'Seeders',
      sortable: true,
      width: 100,
      render: (record: PackResultWithMetadata) => (
        <Badge size="sm" color="green">
          {record.seeders}S/{record.leechers}L
        </Badge>
      )
    },
    {
      accessor: 'coveragePercent',
      title: 'Coverage',
      sortable: true,
      width: 120,
      render: (record: PackResultWithMetadata) => (
        record.includedMissing.length > 0 ? (
          <Badge size="sm" color="yellow">
            {record.coveragePercent}% ({record.includedMissing.length})
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">N/A</Text>
        )
      )
    },
    {
      accessor: 'chapters',
      title: 'Chapters',
      sortable: false,
      width: 150,
      render: (record: PackResultWithMetadata) => (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {record.chapters.length > 0
            ? formatChapterRange(record.chapters)
            : 'Unknown'}
        </Text>
      )
    },
    {
      accessor: 'publishDate',
      title: 'Published',
      sortable: true,
      width: 110,
      render: (record: PackResultWithMetadata) => (
        record.publishDate ? (
          <Text size="xs" c="dimmed">
            {new Date(record.publishDate).toLocaleDateString()}
          </Text>
        ) : (
          <Text size="xs" c="dimmed">-</Text>
        )
      )
    },
    {
      accessor: 'audioLanguage',
      title: 'Language',
      sortable: true,
      width: 120,
      render: (record: PackResultWithMetadata) => {
        if (!record.audioLanguage && (!record.languages || record.languages.length === 0)) {
          return <Text size="xs" c="dimmed">Unknown</Text>;
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
            {record.isOfficial && (
              <Badge size="sm" variant="dot" color="green">
                Official
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
      render: (record: PackResultWithMetadata) => {
        if (!record.format) {
          return <Text size="xs" c="dimmed">N/A</Text>;
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
      width: 100,
      render: (record: PackResultWithMetadata) => (
        <Button
          size="xs"
          onClick={() => {
            alert('🚨 DOWNLOAD BUTTON CLICKED! Check browser console (F12) now!');

            void handleDownload(record);
          }}
          loading={downloadingId === record.id}
          disabled={false}
          leftSection={<IconDownload size={14} />}
        >
          Download
        </Button>
      )
    }
  ];
}
