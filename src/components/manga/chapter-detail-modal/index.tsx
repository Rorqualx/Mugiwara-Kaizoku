/**
 * Chapter Detail Modal - Main Component
 *
 * Displays detailed information about a chapter with tabs for:
 * - Details: Cover, metadata, description, actions
 * - Search: Prowlarr search results with download actions
 * - History: Download history timeline
 *
 * Architecture:
 * - types.ts - Type definitions and interfaces
 * - utils.ts - Formatting utilities (5 functions)
 * - hooks.ts - Data fetching hook (useChapterModalData)
 * - search-columns.tsx - DataTable columns (useSearchColumns)
 * - DetailsTab.tsx - Details panel component
 * - SearchTab.tsx - Search results panel component
 * - HistoryTab.tsx - Download history panel component
 *
 * Original: 856 lines -> Refactored: ~180 lines (79% reduction)
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';

import {
  Modal,
  Group,
  Text,
  Tabs
} from '@mantine/core';
import {
  IconBook,
  IconX,
  IconInfoCircle,
  IconClock,
  IconSearch
} from '@tabler/icons-react';

// Local module imports
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';
import { isArray } from '@/utils/type-guards';

import { DetailsTab } from './DetailsTab';
import { HistoryTab } from './HistoryTab';
import { useChapterModalData } from './hooks';
import { useSearchColumns } from './search-columns';
import { SearchTab } from './SearchTab';

import type {
  ChapterDownloadHistoryEntry,
  MangaDownloadHistoryEntry
} from './HistoryTab';
import type { ChapterDetailModalProps, SearchResult, SortStatus } from './types';

// Column definition type for SearchTab compatibility
interface SearchColumnDefinition {
  accessor: string;
  title: string;
  sortable: boolean;
  width: number | string;
  render: (record: SearchResult) => JSX.Element;
  [key: string]: unknown;
}

/**
 * ChapterDetailModal Component
 *
 * Modal that displays detailed information about a chapter with
 * tabbed interface for details, search, and download history.
 */
export function ChapterDetailModal({
  opened,
  onClose,
  chapter,
  mangaTitle,
  mangaId: propMangaId,
  onDownload,
  onRead,
  initialTab = 'details'
}: ChapterDetailModalProps): JSX.Element | null {
  // Local state
  const [activeTab, setActiveTab] = useState<string | null>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortStatus, setSortStatus] = useState<SortStatus<SearchResult>>({
    columnAccessor: 'publishDate',
    direction: 'desc'
  });

  // Initialize search query when modal opens
  useEffect((): void => {
    if (opened && mangaTitle !== undefined && chapter !== null) {
      setSearchQuery(`${mangaTitle} Chapter ${chapter.index}`);
    }
  }, [opened, mangaTitle, chapter]);

  // Reset active tab when modal opens or initialTab changes
  useEffect((): void => {
    if (opened) {
      setActiveTab(initialTab);
    }
  }, [opened, initialTab]);

  // Get the manga ID from props or chapter
  const mangaId = propMangaId !== undefined
    ? (typeof propMangaId === 'string' ? parseInt(propMangaId, 10) : propMangaId)
    : (chapter?.mangaId ?? 0);

  // Use custom hook for data fetching
  const {
    searchProwlarrQuery,
    downloadingGuid,
    handleDownload,
    downloadHistory,
    mangaDownloadHistory,
    downloadHistoryQuery,
    mangaDownloadHistoryQuery
  } = useChapterModalData({
    opened,
    activeTab,
    searchQuery,
    mangaId,
    chapterId: chapter?.id
  });

  // Get trpc utils for cache invalidation
  const utils = trpc.useUtils();

  // Delete chapter file mutation (keeps metadata, removes only the file)
  const deleteFileMutation = trpc.chapter.deleteFile.useMutation({
    onSuccess: (result) => {
      if (result.status === 'success') {
        notify({ severity: 'SUCCESS', title: 'File Removed', message: result.data.message });
        // Invalidate manga queries to refresh the chapter list
        void utils.manga.get.invalidate({ id: mangaId });
        void utils.manga.detail.invalidate({ id: mangaId });
        onClose();
      }
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Error', message: error.message });
    }
  });

  // Handler for deleting chapter file (keeps metadata)
  const handleDelete = useCallback((chapterId: number): void => {
    if (!mangaId) return;
    deleteFileMutation.mutate({ mangaId, chapterId });
  }, [mangaId, deleteFileMutation]);

  // Handler for opening folder (copies path to clipboard)
  const handleOpenFolder = useCallback((filePath: string): void => {
    void navigator.clipboard.writeText(filePath).then(() => {
      notify({ severity: 'INFO', title: 'Path Copied', message: 'File path copied to clipboard' });
    }).catch(() => {
      notify({ severity: 'ERROR', title: 'Error', message: 'Failed to copy path to clipboard' });
    });
  }, []);

  // Sort search results
  const sortedResults = useMemo((): SearchResult[] => {
    const data = searchProwlarrQuery.data;
    if (!data || !isArray(data)) return [];

    const results: SearchResult[] = data.slice() as SearchResult[];

    results.sort((a, b) => {
      const accessor = sortStatus.columnAccessor as keyof SearchResult;
      const aValue = a[accessor];
      const bValue = b[accessor];

      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      }

      return sortStatus.direction === 'desc' ? -comparison : comparison;
    });

    return results;
  }, [searchProwlarrQuery.data, sortStatus]);

  // Get search columns
  const searchColumns = useSearchColumns({
    downloadingGuid,
    handleDownload
  });

  // Early return after all hooks
  if (!chapter) {
    return null;
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="calc(90vw)"
      title={
        <Group gap="xs">
          <IconBook size={20} />
          <Text fw={600}>{chapter.title || `Chapter ${chapter.index}`}</Text>
        </Group>
      }
      closeButtonProps={{
        icon: <IconX size={18} />
      }}
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
            Details
          </Tabs.Tab>
          <Tabs.Tab value="search" leftSection={<IconSearch size={16} />}>
            Search
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconClock size={16} />}>
            Download History
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <DetailsTab
            chapter={chapter}
            mangaId={mangaId}
            onDelete={handleDelete}
            onOpenFolder={handleOpenFolder}
            {...(mangaTitle !== undefined ? { mangaTitle } : {})}
            {...(onDownload !== undefined ? { onDownload: (id: number) => onDownload(id) } : {})}
            {...(onRead !== undefined ? { onRead: (id: number) => onRead(id) } : {})}
          />
        </Tabs.Panel>

        <Tabs.Panel value="search" pt="md">
          <SearchTab
            isLoading={searchProwlarrQuery.isLoading}
            error={searchProwlarrQuery.error}
            sortedResults={sortedResults}
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            searchColumns={searchColumns as SearchColumnDefinition[]}
            hasData={!!searchProwlarrQuery.data}
          />
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <HistoryTab
            isChapterHistoryLoading={downloadHistoryQuery.isLoading}
            isMangaHistoryLoading={mangaDownloadHistoryQuery.isLoading}
            chapterHistoryError={downloadHistoryQuery.error}
            mangaHistoryError={mangaDownloadHistoryQuery.error}
            downloadHistory={downloadHistory as ChapterDownloadHistoryEntry[]}
            mangaDownloadHistory={mangaDownloadHistory as MangaDownloadHistoryEntry[]}
          />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

// Re-export types for consumers
export type { ChapterDetailModalProps } from './types';
