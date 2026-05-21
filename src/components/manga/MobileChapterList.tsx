/**
 * Mobile-optimized Chapter List Component
 * 
 * Displays chapters in a card-based layout optimized for mobile devices.
 * Features touch gestures, pull-to-refresh, and streamlined mobile UI.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';

import { Stack, Card, Button, Group, Checkbox, Text, ActionIcon, Menu, Badge, Paper, Progress, Box, Collapse, Switch, ScrollArea, Center, Loader } from '@mantine/core';
import { ChapterStatus } from '@prisma/client';
import { IconDownload, IconSearch, IconDotsVertical, IconSettings, IconPlayerPlay, IconCheck, IconX, IconChevronDown, IconFilter, IconArrowsSort } from '@tabler/icons-react';

// MANGAL_SUPPORTED_SOURCES removed - mangal is deprecated
// import { usePullToRefresh } from '@/hooks/mobile/usePullToRefresh';
import { useSwipeGesture } from '@/hooks/mobile/useSwipeGesture';
import type { MangaWithRelations } from '@/types/search.types';
import { formatFileSize } from '@/utils/formatters';
import { toNumberId, toStringId } from '@/utils/id-converters';
import { trpc } from '@/utils/trpc-client/index';


import { toast } from '../mobile/MobileToast';

import { AutoDownloadModal } from './AutoDownloadModal';
import { BulkDownloadModal } from './BulkDownloadModal';
import { PackSearchModal } from './PackSearchModal';

import type { Chapter as ChapterEntity } from '@prisma/client';
interface MobileChapterListProps {
  manga: MangaWithRelations;
  outOfSyncChapters?: (string | number)[];
  onDownload?: (mangaId: string | number, chapterIds: (string | number)[]) => void;
  onToggleMonitoring?: (chapterId: string | number, monitored: boolean) => void;
  onAutoSearch?: (chapterId: string | number) => void;
  onManualSearch?: (chapterId: string | number) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

/**
 * Mobile Chapter Card Component
 */
function MobileChapterCard({
  chapter,
  manga,
  selected,
  onSelect,
  canUseMangal: _canUseMangal,
  isOutOfSync,
  onSwipeLeft,
  onSwipeRight
}: {
  chapter: ChapterEntity;
  manga: MangaWithRelations;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  canUseMangal: boolean;
  isOutOfSync: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}): React.ReactElement {
  const [showActions, setShowActions] = useState(false);
  const quickDownload = trpc.manga.quickDownload.useMutation({
    onSuccess: () => {
      toast.success(`Chapter ${chapter.index} download started`);
    },
    onError: error => {
      toast.error(`Download failed: ${(error instanceof Error ? error.message : String(error))}`);
    }
  });
  const {
    handlers: swipeHandlers
  } = useSwipeGesture({
    onSwipeLeft: () => {
      if (onSwipeLeft) {
        onSwipeLeft();
      } else {
        setShowActions(!showActions);
      }
    },
    onSwipeRight: () => {
      if (onSwipeRight) {
        onSwipeRight();
      } else {
        handleQuickDownload();
      }
    },
    threshold: 50
  });
  const getStatusColor = (): string => {
    if (isOutOfSync) return 'orange';
    switch (chapter.downloadStatus) {
      case ChapterStatus.COMPLETED:
        return 'green';
      case ChapterStatus.DOWNLOADING:
        return 'blue';
      case ChapterStatus.ERROR:
        return 'red';
      case ChapterStatus.PENDING:
        return 'yellow';
      default:
        return 'gray';
    }
  };
  const getStatusIcon = (): React.ReactNode => {
    if (isOutOfSync) return <IconX size={16} />;
    switch (chapter.downloadStatus) {
      case ChapterStatus.COMPLETED:
        return <IconCheck size={16} />;
      case ChapterStatus.DOWNLOADING:
        return <IconPlayerPlay size={16} />;
      case ChapterStatus.ERROR:
        return <IconX size={16} />;
      default:
        return null;
    }
  };
  const getStatusText = (): string => {
    if (isOutOfSync) return 'Out of Sync';
    switch (chapter.downloadStatus) {
      case ChapterStatus.COMPLETED:
        return 'Downloaded';
      case ChapterStatus.DOWNLOADING:
        return 'Downloading';
      case ChapterStatus.ERROR:
        return 'Error';
      case ChapterStatus.PENDING:
        return 'Pending';
      default:
        return 'Not Downloaded';
    }
  };
  const handleQuickDownload = (): void => {
    if (chapter.downloadStatus === ChapterStatus.COMPLETED || chapter.downloadStatus === ChapterStatus.DOWNLOADING) {
      return;
    }
    void quickDownload.mutateAsync({
      mangaId: toNumberId(manga["id"]),
      chapterId: toNumberId(chapter["id"])
    });
  };
  return <Card {...swipeHandlers} shadow="sm" p="sm" radius="md" withBorder style={{
    opacity: selected ? 0.9 : 1,
    transform: selected ? 'scale(0.98)' : 'scale(1)',
    transition: 'all 0.2s ease'
  }}>

      <Group justify="space-between" wrap="nowrap">
        <Group wrap="nowrap" style={{
        flex: 1
      }}>
          <Checkbox checked={selected} onChange={e => onSelect(e.currentTarget.checked)} size="md" />

          <Box style={{
          flex: 1
        }}>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600} size="md">Chapter {chapter.index}</Text>
              <Badge size="sm" color={getStatusColor()} leftSection={getStatusIcon()}>

                {getStatusText()}
              </Badge>
            </Group>
            {chapter["title"] && <Text size="sm" c="dimmed" lineClamp={1}>
                {chapter["title"]}
              </Text>}
            {chapter.size && <Text size="xs" c="dimmed">
                {formatFileSize(chapter.size)}
              </Text>}
          </Box>
        </Group>
        
        <ActionIcon size="lg" variant="subtle" onClick={() => setShowActions(!showActions)}>

          <IconChevronDown size={20} style={{
          transform: showActions ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }} />

        </ActionIcon>
      </Group>

      <Collapse in={showActions}>
        <Group mt="sm" gap="xs">
          {chapter.downloadStatus === ChapterStatus.DOWNLOADING ? <Progress value={0} size="lg" radius="md" style={{
          flex: 1
        }} animated /> : <Button size="sm" variant="light" leftSection={<IconDownload size={16} />} onClick={handleQuickDownload} loading={quickDownload.isPending} disabled={chapter.downloadStatus === ChapterStatus.COMPLETED} fullWidth>

              {'Download'}
            </Button>}
        </Group>
      </Collapse>
    </Card>;
}

/**
 * Mobile-optimized chapter list with cards instead of table
 */
export function MobileChapterList({
  manga,
  outOfSyncChapters = [],
  onDownload: _onDownload,
  onToggleMonitoring: _onToggleMonitoring,
  onAutoSearch: _onAutoSearch,
  onManualSearch: _onManualSearch,
  onRefresh: _onRefresh,
  isLoading = false
}: MobileChapterListProps): React.ReactElement {
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterDownloaded, setFilterDownloaded] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Pull to refresh - commented out for now
  // const { pullToRefreshProps, isRefreshing } = usePullToRefresh({
  //   onRefresh: async () => {
  //     if (onRefresh) {
  //       await onRefresh();
  //     }
  //   },
  //   disabled: isLoading || isRefreshing
  // });
  const pullToRefreshProps = {};

  // Check if source supports Mangal
  // Mangal is deprecated - always false
  const canUseMangal = false;

  // Calculate statistics
  const stats = useMemo(() => {
    const chapters = manga.Chapter;
    const downloaded = chapters.filter(ch => ch.downloadStatus === ChapterStatus.COMPLETED).length;
    const missing = chapters.length - downloaded;
    return {
      total: chapters.length,
      downloaded,
      missing,
      outOfSync: outOfSyncChapters.length
    };
  }, [manga.Chapter, outOfSyncChapters]);

  // Filter and sort chapters
  const displayedChapters = useMemo(() => {
    let chapters = [...manga.Chapter];

    // Apply filter
    if (filterDownloaded) {
      chapters = chapters.filter(ch => ch.downloadStatus !== ChapterStatus.COMPLETED);
    }

    // Apply sort
    chapters.sort((a, b) => {
      const indexA = parseFloat(String(a.index));
      const indexB = parseFloat(String(b.index));
      return sortOrder === 'asc' ? indexA - indexB : indexB - indexA;
    });
    return chapters;
  }, [manga.Chapter, filterDownloaded, sortOrder]);

  // Handle select all
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedChapters(displayedChapters.map(ch => toNumberId(ch["id"])));
    } else {
      setSelectedChapters([]);
    }
  }, [displayedChapters]);

  // Download all missing chapters
  const handleDownloadMissing = useCallback(() => {
    const chapters = manga.Chapter;
    const missingChapterIds = chapters.filter(ch => ch.downloadStatus !== ChapterStatus.COMPLETED).map(ch => toNumberId(ch["id"]));
    if (missingChapterIds.length > 0) {
      setSelectedChapters(missingChapterIds);
      setShowBulkModal(true);
    }
  }, [manga.Chapter]);

  // Check if chapter is out of sync
  const isChapterOutOfSync = useCallback((chapterId: string | number): boolean => {
    return outOfSyncChapters.some(id => toStringId(id) === toStringId(chapterId));
  }, [outOfSyncChapters]);
  if (isLoading) {
    return <Center h={200}>
        <Loader size="lg" />
      </Center>;
  }
  return <>
      <Stack gap="sm">
        {/* Header Stats */}
        <Paper p="sm" withBorder>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {stats.total} chapters
              </Text>
              <Badge variant="dot" color={'blue'} size="sm">

                {'Prowlarr'}
              </Badge>
            </Group>
            
            <Group gap="xs">
              <Badge color="green" size="sm">{stats.downloaded} downloaded</Badge>
              {stats.missing > 0 && <Badge color="gray" size="sm">{stats.missing} missing</Badge>}
              {stats.outOfSync > 0 && <Badge color="orange" size="sm">{stats.outOfSync} out of sync</Badge>}
            </Group>
          </Stack>
        </Paper>

        {/* Mobile Controls */}
        <Group justify="space-between">
          <Group gap="xs">
            <Checkbox label={`All (${displayedChapters.length})`} checked={selectedChapters.length === displayedChapters.length && selectedChapters.length > 0} indeterminate={selectedChapters.length > 0 && selectedChapters.length < displayedChapters.length} onChange={e => handleSelectAll(e.currentTarget.checked)} size="md" />

            {selectedChapters.length > 0 && <Badge size="sm" variant="filled">
                {selectedChapters.length}
              </Badge>}
          </Group>
          
          <Group gap="xs">
            <ActionIcon size="lg" variant="light" onClick={() => setShowFilters(!showFilters)} {...(filterDownloaded || sortOrder === 'asc' ? { color: 'blue' } : {})}>

              <IconFilter size={20} />
            </ActionIcon>
            
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon size="lg" variant="light">
                  <IconDotsVertical size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {selectedChapters.length > 0 && <>
                    <Menu.Item leftSection={<IconDownload size={16} />} onClick={() => setShowBulkModal(true)}>

                      Download Selected ({selectedChapters.length})
                    </Menu.Item>
                    <Menu.Divider />
                  </>}
                <Menu.Item leftSection={<IconSearch size={16} />} onClick={() => setShowSearchModal(true)}>

                  Search Packs
                </Menu.Item>
                <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => setShowAutoModal(true)}>

                  Auto-Download
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconDownload size={16} />} onClick={handleDownloadMissing} disabled={stats.missing === 0}>

                  Download Missing ({stats.missing})
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Filter Panel */}
        <Collapse in={showFilters}>
          <Paper p="sm" withBorder>
            <Stack gap="sm">
              <Switch label="Hide downloaded chapters" checked={filterDownloaded} onChange={e => setFilterDownloaded(e.currentTarget.checked)} />

              <Group justify="space-between">
                <Text size="sm">Sort order</Text>
                <Button.Group>
                  <Button size="xs" variant={sortOrder === 'desc' ? 'filled' : 'light'} onClick={() => setSortOrder('desc')} leftSection={<IconArrowsSort size={14} />}>

                    Newest
                  </Button>
                  <Button size="xs" variant={sortOrder === 'asc' ? 'filled' : 'light'} onClick={() => setSortOrder('asc')} leftSection={<IconArrowsSort size={14} style={{
                  transform: 'rotate(180deg)'
                }} />}>

                    Oldest
                  </Button>
                </Button.Group>
              </Group>
            </Stack>
          </Paper>
        </Collapse>
        
        {/* Chapter Cards */}
        <ScrollArea {...pullToRefreshProps} ref={scrollAreaRef} style={{
        height: 'calc(100vh - 300px)'
      }}>

          <Stack gap="xs">
            {displayedChapters.map(chapter => <MobileChapterCard key={chapter["id"]} chapter={chapter} manga={manga} selected={selectedChapters.includes(toNumberId(chapter["id"]))} onSelect={selected => {
            const numericId = toNumberId(chapter["id"]);
            if (selected) {
              setSelectedChapters([...selectedChapters, numericId]);
            } else {
              setSelectedChapters(selectedChapters.filter(id => id !== numericId));
            }
          }} canUseMangal={canUseMangal} isOutOfSync={isChapterOutOfSync(toNumberId(chapter["id"]))} />)}
          </Stack>
        </ScrollArea>
      </Stack>
      
      {/* Modals */}
      <BulkDownloadModal opened={showBulkModal} onClose={() => setShowBulkModal(false)} manga={manga as MangaWithRelations} chapterIds={selectedChapters} />

      
      <PackSearchModal opened={showSearchModal} onClose={() => setShowSearchModal(false)} manga={manga} />

      
      <AutoDownloadModal opened={showAutoModal} onClose={() => setShowAutoModal(false)} manga={manga} />

    </>;
}