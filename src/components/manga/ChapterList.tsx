/**
 * Component for displaying a list of manga chapters with download functionality
 *
 * This component renders a table of chapters with selection controls, bulk operations,
 * and smart download features. It supports both direct downloads via Mangal and
 * downloads through Prowlarr/download clients.
 *
 * Features:
 * - Checkbox selection for individual and bulk operations
 * - Download method auto-detection (Mangal vs Prowlarr)
 * - Pack search functionality
 * - Auto-download configuration
 * - Progress tracking for downloads
 * - Out-of-sync chapter highlighting
 * - Accessible table structure
 *
 * @module ChapterList
 */
import React, { useState, useMemo } from 'react';

import { Stack, Table, Button, Group, Checkbox, Text, ActionIcon, Menu, Badge, Paper, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ChapterStatus } from '@prisma/client';
import { IconDownload, IconSearch, IconSettings, IconChevronDown } from '@tabler/icons-react';

import type { QuickDownloadResponse } from '@/types/quickDownload.types';
import type { MangaWithRelations } from '@/types/search.types';
import { toNumberId, toStringId } from '@/utils/id-converters';
// MANGAL_SUPPORTED_SOURCES removed - mangal is deprecated
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';


import { AutoDownloadModal } from './AutoDownloadModal';
import { BulkDownloadModal } from './BulkDownloadModal';
import { ChapterDetailModal } from './ChapterDetailModal';
import { ChapterRow } from './ChapterRow';
import { PackSearchModal } from './PackSearchModal';

import type { Chapter as ChapterEntity } from '@prisma/client';
/**
 * Props for the ChapterList component
 */
interface ChapterListProps {
  /**
   * Manga entity with chapters
   */
  manga: MangaWithRelations;

  /**
   * Array of chapter IDs that are out of sync
   */
  outOfSyncChapters?: (string | number)[];

  /**
   * Handler for chapter download
   */
  onDownload?: (mangaId: string | number, chapterIds: (string | number)[]) => void;

  /**
   * Callback when user toggles monitoring for a chapter
   */
  onToggleMonitoring?: (chapterId: string | number, monitored: boolean) => void;

  /**
   * Callback when user requests auto search for a chapter
   */
  onAutoSearch?: (chapterId: string | number) => void;

  /**
   * Callback when user requests manual search for a chapter
   */
  onManualSearch?: (chapterId: string | number) => void;

  /**
   * Loading state
   */
  isLoading?: boolean;
}

/**
 * Displays a table of manga chapters with download functionality
 */
export function ChapterList({
  manga,
  outOfSyncChapters = [],
  onDownload,
  onToggleMonitoring: _onToggleMonitoring,
  onAutoSearch: _onAutoSearch,
  onManualSearch: _onManualSearch,
  isLoading: _isLoading = false
}: ChapterListProps): React.ReactElement {
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [selectedChapterDetail, setSelectedChapterDetail] = useState<ChapterEntity | null>(null);

  // Bulk Quick Download mutation
  const bulkQuickDownloadMutation = trpc.manga.quickDownloadWithSearch.useMutation({
    onSuccess: (data) => {
      const typedData = data as QuickDownloadResponse;
      const { summary } = typedData;
      notifications.show({
        title: 'Bulk Quick Download Complete',
        message: `${summary.started} started, ${summary.failed} failed, ${summary.noResults} no results`,
        color: summary.started > 0 ? 'green' : 'yellow'
      });
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Bulk Quick Download Failed', message: error.message });
    }
  });

  // Check if source supports Mangal - Mangal is deprecated
  const canUseMangal = useMemo(() => false, []);

  // Calculate statistics
  const mangaChapters = manga['Chapter'];
  const stats = useMemo(() => {
    const chapters = mangaChapters;
    const downloaded = chapters.filter(ch => ch.downloadStatus === ChapterStatus.COMPLETED).length;
    const missing = chapters.length - downloaded;
    return {
      total: chapters.length,
      downloaded,
      missing,
      outOfSync: outOfSyncChapters.length
    };
  }, [mangaChapters, outOfSyncChapters]);

  // Handle select all
  const handleSelectAll = (checked: boolean): void => {
    if (checked) {
      setSelectedChapters(manga['Chapter'].map(ch => toNumberId(ch["id"])));
    } else {
      setSelectedChapters([]);
    }
  };

  // Quick Download Missing
  const handleQuickDownloadMissing = (): void => {
    const missingChapterIds = manga['Chapter'].filter(ch => ch.downloadStatus !== ChapterStatus.COMPLETED).map(ch => toNumberId(ch["id"]));

    if (missingChapterIds.length === 0) return;

    notifications.show({
      id: 'bulk-quick-download',
      title: 'Processing...',
      message: `Auto-searching for ${missingChapterIds.length} chapters...`,
      loading: true,
      autoClose: false
    });

    bulkQuickDownloadMutation.mutate({
      mangaId: toNumberId(manga["id"]),
      chapterIds: missingChapterIds,
      mode: 'BULK'
    }, {
      onSettled: () => {
        notifications.hide('bulk-quick-download');
      }
    });
  };

  // Quick Download All
  const handleQuickDownloadAll = (): void => {
    const allChapterIds = manga['Chapter'].map(ch => toNumberId(ch["id"]));

    if (allChapterIds.length === 0) return;

    notifications.show({
      id: 'bulk-quick-download',
      title: 'Processing...',
      message: `Auto-searching for ${allChapterIds.length} chapters...`,
      loading: true,
      autoClose: false
    });

    bulkQuickDownloadMutation.mutate({
      mangaId: toNumberId(manga["id"]),
      chapterIds: allChapterIds,
      mode: 'BULK'
    }, {
      onSettled: () => {
        notifications.hide('bulk-quick-download');
      }
    });
  };

  // Quick Download Selected
  const handleQuickDownloadSelected = (): void => {
    if (selectedChapters.length === 0) return;

    notifications.show({
      id: 'bulk-quick-download',
      title: 'Processing...',
      message: `Auto-searching for ${selectedChapters.length} chapters...`,
      loading: true,
      autoClose: false
    });

    bulkQuickDownloadMutation.mutate({
      mangaId: toNumberId(manga["id"]),
      chapterIds: selectedChapters,
      mode: 'BULK'
    }, {
      onSettled: () => {
        notifications.hide('bulk-quick-download');
      }
    });
  };

  // Check if chapter is out of sync
  const isChapterOutOfSync = (chapterId: string | number): boolean => {
    return outOfSyncChapters.some(id => toStringId(id) === toStringId(chapterId));
  };

  return <>
      <Stack>
        {/* Header Stats */}
        <Paper p="md" withBorder>
          <Group justify="space-between">
            <Group>
              <Text size="sm">
                <strong>{stats.total}</strong> chapters total
              </Text>
              <Badge color="green">{stats.downloaded} downloaded</Badge>
              {stats.missing > 0 && <Badge color="gray">{stats.missing} missing</Badge>}
              {stats.outOfSync > 0 && <Badge color="orange">{stats.outOfSync} out of sync</Badge>}
            </Group>

            <Tooltip label={'Download via Prowlarr/clients'}>
              <Badge variant="dot" color={'blue'}>
                {'Prowlarr'}
              </Badge>
            </Tooltip>
          </Group>
        </Paper>

        {/* Selection Controls */}
        <Group justify="space-between">
          <Group>
            <Checkbox label={`Select All (${manga['Chapter'].length})`} checked={selectedChapters.length === manga['Chapter'].length && selectedChapters.length > 0} indeterminate={selectedChapters.length > 0 && selectedChapters.length < manga['Chapter'].length} onChange={e => handleSelectAll(e.currentTarget.checked)} />

            {selectedChapters.length > 0 && <Text size="sm" c="dimmed">
                {selectedChapters.length} selected
              </Text>}
          </Group>

          <Group>
            {/* Quick Download Dropdown */}
            <Menu shadow="md" width={280}>
              <Menu.Target>
                <Button
                  leftSection={<IconDownload size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                  loading={bulkQuickDownloadMutation.isPending}
                >
                  Quick Download
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconDownload size={16} />}
                  onClick={handleQuickDownloadMissing}
                  disabled={stats.missing === 0}
                >
                  <div>
                    <Text size="sm" fw={500}>Download Missing ({stats.missing})</Text>
                    <Text size="xs" c="dimmed">Auto-search all sources</Text>
                  </div>
                </Menu.Item>

                <Menu.Item
                  leftSection={<IconDownload size={16} />}
                  onClick={handleQuickDownloadAll}
                  disabled={stats.total === 0}
                >
                  <div>
                    <Text size="sm" fw={500}>Download All ({stats.total})</Text>
                    <Text size="xs" c="dimmed">Auto-search all sources</Text>
                  </div>
                </Menu.Item>

                {selectedChapters.length > 0 && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconDownload size={16} />}
                      onClick={handleQuickDownloadSelected}
                    >
                      <div>
                        <Text size="sm" fw={500}>Download Selected ({selectedChapters.length})</Text>
                        <Text size="xs" c="dimmed">Auto-search all sources</Text>
                      </div>
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>

            {/* Search Packs Button */}
            <Button variant="light" leftSection={<IconSearch />} onClick={() => setShowSearchModal(true)}>
              Search Packs
            </Button>

            {/* Settings Menu */}
            <Menu>
              <Menu.Target>
                <ActionIcon variant="light" size="lg">
                  <IconSettings />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => setShowAutoModal(true)}>
                  Auto-Download Settings
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Chapter Table */}
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{
              width: 40
            }} />
              <Table.Th>Chapter</Table.Th>
              <Table.Th>Title</Table.Th>
              <Table.Th>Size</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {manga['Chapter'].map(chapter => <ChapterRow key={chapter["id"]} chapter={chapter} manga={manga} selected={selectedChapters.includes(toNumberId(chapter["id"]))} onSelect={selected => {
            const numericId = toNumberId(chapter["id"]);
            if (selected) {
              setSelectedChapters([...selectedChapters, numericId]);
            } else {
              setSelectedChapters(selectedChapters.filter(id => id !== numericId));
            }
          }} canUseMangal={canUseMangal} isOutOfSync={isChapterOutOfSync(toNumberId(chapter["id"]))} onShowDetail={setSelectedChapterDetail} />)}
          </Table.Tbody>
        </Table>
      </Stack>

      {/* Modals */}
      <BulkDownloadModal opened={showBulkModal} onClose={() => setShowBulkModal(false)} manga={manga as MangaWithRelations} chapterIds={selectedChapters} />


      <PackSearchModal opened={showSearchModal} onClose={() => setShowSearchModal(false)} manga={manga} />


      <AutoDownloadModal opened={showAutoModal} onClose={() => setShowAutoModal(false)} manga={manga} />


      <ChapterDetailModal opened={!!selectedChapterDetail} onClose={() => setSelectedChapterDetail(null)} chapter={selectedChapterDetail} mangaTitle={manga["title"]} mangaId={toNumberId(manga["id"])} onDownload={chapterId => {
      onDownload?.(manga["id"], [chapterId]);
    }} />

    </>;
}
