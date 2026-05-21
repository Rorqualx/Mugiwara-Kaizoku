/**
 * Volume Detail Modal Component
 *
 * Displays detailed information about a specific volume including
 * cover art, title, description, release date, and chapter list.
 *
 * Architecture:
 * - volume-detail-modal/volume-detail-modal-types.ts - Types and interfaces
 * - volume-detail-modal/volume-detail-modal-hooks.ts - Custom hooks
 * - volume-detail-modal/volume-detail-modal-utils.ts - Utilities
 * - volume-detail-modal/VolumeDetailsTab.tsx - Details tab
 * - volume-detail-modal/VolumeChaptersTab.tsx - Chapters tab
 * - volume-detail-modal/VolumeSearchTab.tsx - Search tab
 *
 * Original: 848 lines -> Refactored: ~180 lines (79% reduction)
 */

import React, { useState, useMemo } from 'react';

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
  IconList,
  IconSearch
} from '@tabler/icons-react';

import {
  VolumeDetailsTab,
  VolumeChaptersTab,
  VolumeSearchTab,
  useVolumeBookmark,
  useEnabledClients,
  useQuickDownload,
  useProwlarrSearch,
  useDownloadFromProwlarr
} from './volume-detail-modal';

import type {
  VolumeDetailModalProps,
  SortStatus,
  SearchResult
} from './volume-detail-modal/volume-detail-modal-types';

export function VolumeDetailModal({
  opened,
  onClose,
  volume,
  mangaId,
  mangaTitle,
  onChapterClick,
  initialTab = 'details'
}: VolumeDetailModalProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<string | null>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortStatus, setSortStatus] = useState<SortStatus<SearchResult>>({
    columnAccessor: 'publishDate',
    direction: 'desc'
  });

  // Initialize search query when modal opens
  React.useEffect(() => {
    if (opened && mangaTitle && volume) {
      setSearchQuery(`${mangaTitle} Volume ${volume.volumeNumber}`);
    }
  }, [opened, mangaTitle, volume]);

  // Reset active tab when modal opens or initialTab changes
  React.useEffect(() => {
    if (opened) {
      setActiveTab(initialTab);
    }
  }, [opened, initialTab]);

  // Use extracted hooks
  const { isBookmarked, toggle: toggleBookmark, isPending: isBookmarkPending } =
    useVolumeBookmark(mangaId, volume?.volumeNumber);

  const enabledClients = useEnabledClients();

  const { download: _quickDownload, isPending: _isQuickDownloadPending } =
    useQuickDownload();

  const prowlarrSearch = useProwlarrSearch(
    searchQuery,
    mangaId,
    opened && activeTab === 'search'
  );

  const { download: downloadFromProwlarr, downloadingGuid } =
    useDownloadFromProwlarr(mangaId, enabledClients);

  // Sort search results based on sort status
  const sortedResults = useMemo((): SearchResult[] => {
    if (!prowlarrSearch.data) return [];

    const results = [...prowlarrSearch.data];

    results.sort((a, b) => {
      const accessor = sortStatus.columnAccessor as keyof SearchResult;
      const aValue = a[accessor];
      const bValue = b[accessor];

      let comparison = 0;

      // Handle numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      }
      // Handle string comparison
      else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      }
      // Handle cases where one value is missing/falsy (arrays, booleans treated as lower priority)
      else if (!aValue && bValue) {
        comparison = 1;
      } else if (aValue && !bValue) {
        comparison = -1;
      }

      return sortStatus.direction === 'desc' ? -comparison : comparison;
    });

    return results;
  }, [prowlarrSearch.data, sortStatus]);

  // Handler for opening search tab from menu
  const _handleOpenSearch = (): void => {
    setActiveTab('search');
  };

  // Handler for quick download
  const _handleQuickDownload = (): void => {
    if (mangaId && volume) {
      _quickDownload(mangaId, volume.volumeNumber);
    }
  };

  if (!volume) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="calc(90vw)"
      title={
        <Group gap="xs">
          <IconBook size={20} />
          <Text fw={600}>
            {volume.title ?? `Volume ${volume.volumeNumber}`}
          </Text>
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
          <Tabs.Tab value="chapters" leftSection={<IconList size={16} />}>
            Chapters
          </Tabs.Tab>
          <Tabs.Tab value="search" leftSection={<IconSearch size={16} />}>
            Search
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <VolumeDetailsTab
            volume={volume}
            mangaTitle={mangaTitle}
            mangaId={mangaId}
            isVolumeBookmarked={isBookmarked}
            onToggleBookmark={toggleBookmark}
            isBookmarkLoading={isBookmarkPending}
          />
        </Tabs.Panel>

        <Tabs.Panel value="chapters" pt="md">
          <VolumeChaptersTab
            volume={volume}
            onChapterClick={onChapterClick}
          />
        </Tabs.Panel>

        <Tabs.Panel value="search" pt="md">
          <VolumeSearchTab
            isLoading={prowlarrSearch.isLoading}
            results={sortedResults}
            error={prowlarrSearch.error}
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            onDownload={downloadFromProwlarr}
            downloadingGuid={downloadingGuid}
          />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
