/**
 * ChapterRow component for displaying individual chapter rows in ChapterList
 *
 * This component renders a table row for a single chapter with:
 * - Selection checkbox
 * - Chapter cover image and index
 * - Title and description
 * - File size
 * - Download status badge
 * - Download action menu
 *
 * @module ChapterRow
 */
import React from 'react';

import { Table, Button, Group, Checkbox, Text, Menu, Badge, Progress, Image, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ChapterStatus } from '@prisma/client';
import { IconDownload, IconSearch, IconPlayerPlay, IconCheck, IconX, IconChevronDown, IconFile } from '@tabler/icons-react';

import { useQuickDownloadToast } from '@/hooks/useQuickDownloadToast';
import type { QuickDownloadChapterResult, QuickDownloadResponse } from '@/types/quickDownload.types';
import type { MangaWithRelations } from '@/types/search.types';
import { formatFileSize } from '@/utils/formatters';
import { toNumberId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';


import type { Chapter as ChapterEntity } from '@prisma/client';

/**
 * Props for the ChapterRow component
 */
export interface ChapterRowProps {
  /** The chapter entity to display */
  chapter: ChapterEntity;
  /** Parent manga with relations */
  manga: MangaWithRelations;
  /** Whether this chapter is selected */
  selected: boolean;
  /** Callback when selection state changes */
  onSelect: (selected: boolean) => void;
  /** Whether Mangal can be used for this manga's source */
  canUseMangal: boolean;
  /** Whether this chapter is out of sync */
  isOutOfSync: boolean;
  /** Callback when user wants to see chapter detail */
  onShowDetail?: (chapter: ChapterEntity) => void;
}

/**
 * Chapter row component with selection and status display
 */
export function ChapterRow({
  chapter,
  manga,
  selected,
  onSelect,
  canUseMangal: _canUseMangal,
  isOutOfSync,
  onShowDetail
}: ChapterRowProps): React.ReactElement {
  // Live-update the per-chapter quick-download toast as the auto-search fan-out reports per-source results.
  useQuickDownloadToast(toNumberId(manga['id']), `quick-download-${chapter.id}`);

  // Quick Download with Auto-Search mutation
  const quickDownloadMutation = trpc.manga.quickDownloadWithSearch.useMutation({
    onSuccess: (data) => {
      const typedData = data as QuickDownloadResponse;
      const result: QuickDownloadChapterResult | undefined = typedData.results[0];
      if (result?.status === 'STARTED') {
        notify({ severity: 'SUCCESS', title: 'Quick Download Started', message: result.releaseTitle
            ? `Downloading: ${result.releaseTitle} (${result.indexer})`
            : 'Download started successfully' });
      } else if (result?.status === 'NO_RESULTS') {
        notify({ severity: 'WARNING', title: 'No Results Found', message: 'No matching releases found for this chapter' });
      } else if (result?.status === 'ALL_BLOCKED') {
        notify({ severity: 'WARNING', title: 'All Results Blocked', message: 'All matching releases are on the blocklist' });
      } else {
        notify({ severity: 'ERROR', title: 'Download Failed', message: result?.error ?? 'Failed to start download' });
      }
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Quick Download Failed', message: error.message });
    }
  });

  const getStatusBadge = (): React.ReactElement => {
    if (isOutOfSync) {
      return <Badge color="orange" leftSection={<IconX size={12} />}>Out of Sync</Badge>;
    }
    switch (chapter.downloadStatus) {
      case ChapterStatus.COMPLETED:
        return <Badge color="green" leftSection={<IconCheck size={12} />}>Available</Badge>;
      case ChapterStatus.DOWNLOADING:
        return <Badge color="blue" leftSection={<IconPlayerPlay size={12} />}>
            Downloading
          </Badge>;
      case ChapterStatus.ERROR:
        return <Badge color="red" leftSection={<IconX size={12} />}>Error</Badge>;
      case ChapterStatus.PENDING:
      default:
        return <Badge color="yellow">Missing</Badge>;
    }
  };

  const handleQuickDownload = (): void => {
    notifications.show({
      id: `quick-download-${chapter.id}`,
      title: 'Searching…',
      message: 'Searching enabled sources for best release…',
      loading: true,
      autoClose: false
    });

    quickDownloadMutation.mutate({
      mangaId: toNumberId(manga["id"]),
      chapterId: toNumberId(chapter["id"]),
      mode: 'SINGLE'
    }, {
      onSettled: () => {
        notifications.hide(`quick-download-${chapter.id}`);
      }
    });
  };

  const handleSearchDownloads = (): void => {
    onShowDetail?.(chapter);
  };

  const isDownloaded = chapter.downloadStatus === ChapterStatus.COMPLETED;
  const isDownloading = chapter.downloadStatus === ChapterStatus.DOWNLOADING;

  return <Table.Tr key={chapter["id"]} {...(selected && { bg: 'blue.0' })}>
      <Table.Td style={{
      width: 40
    }}>
        <Checkbox checked={selected} onChange={e => onSelect(e.currentTarget.checked)} aria-label={`Select chapter ${chapter.index}`} />

      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          {(chapter.coverImage ?? chapter.downloadUrl) && <Image src={chapter.coverImage ?? chapter.downloadUrl ?? '/cover-not-found.jpg'} alt={`Chapter ${chapter.index} cover`} width={40} height={60} fit="cover" radius="sm" fallbackSrc="/cover-not-found.jpg" />}
          <Text fw={500}>Chapter {chapter.index}</Text>
        </Group>
      </Table.Td>
      <Table.Td style={{
      cursor: 'pointer'
    }} onClick={() => onShowDetail?.(chapter)}>

        <Stack gap={2}>
          <Text size="sm" fw={500} style={{
          textDecoration: 'underline'
        }}>
            {chapter["title"] || `Chapter ${chapter.index}`}
          </Text>
          {chapter["description"] && <Text size="xs" c="dimmed" lineClamp={2}>{chapter["description"]}</Text>}
        </Stack>
      </Table.Td>
      <Table.Td>
        <Stack gap={0}>
          {chapter.size ? <Text size="sm" c="dimmed">
              {formatFileSize(chapter.size)}
            </Text> : <Text size="sm" c="dimmed">-</Text>}
          {chapter.pageCount !== null && chapter.pageCount > 0 && (
            <Group gap={4}>
              <IconFile size={10} color="gray" />
              <Text size="xs" c="dimmed">{chapter.pageCount}p</Text>
            </Group>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>{getStatusBadge()}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          {isDownloading ? (
            <Progress value={50} size="sm" style={{ width: 100 }} animated />
          ) : (
            <Menu shadow="md" width={220}>
              <Menu.Target>
                <Button
                  size="xs"
                  variant="light"
                  rightSection={<IconChevronDown size={12} />}
                  disabled={isDownloaded}
                  loading={quickDownloadMutation.isPending}
                >
                  Download
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconDownload size={14} />}
                  onClick={handleQuickDownload}
                >
                  <div>
                    <Text size="sm" fw={500}>Quick Download</Text>
                    <Text size="xs" c="dimmed">Auto-search & download</Text>
                  </div>
                </Menu.Item>

                <Menu.Item
                  leftSection={<IconSearch size={14} />}
                  onClick={handleSearchDownloads}
                >
                  <div>
                    <Text size="sm" fw={500}>Search Downloads...</Text>
                    <Text size="xs" c="dimmed">Pick from results</Text>
                  </div>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>;
}
