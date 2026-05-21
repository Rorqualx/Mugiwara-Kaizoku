/**
 * Responsive Manga Detail Component
 * 
 * Provides an optimized manga detail view that adapts to different screen sizes.
 * Uses mobile-specific components on small screens and desktop layout on larger screens.
 */

import React, { useState, useEffect } from 'react';

import { Box, Stack, Tabs, Paper, Group, Text, Badge, Loader, Center, Alert, Container } from '@mantine/core';
import { ChapterStatus } from '@prisma/client';
import { IconBook, IconInfoCircle, IconSettings, IconAlertCircle, IconRefresh } from '@tabler/icons-react';

import { GetComicsButton } from '@/components/comicbook/GetComicsButton';
import { useMediaTypeLabels } from '@/hooks/manga/useMediaTypeLabels';
import { useBreakpoint } from '@/hooks/mobile/useBreakpoint';
import type { MangaWithRelations } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';


import { FloatingActionButton } from '../mobile/FloatingActionButton';

// import { SwipeableView } from '../mobile/SwipeableView';
// import { usePullToRefresh } from '@/hooks/mobile/usePullToRefresh';
import { MobileMangaHeader } from './MobileMangaHeader';
import { ResponsiveChapterList } from './ResponsiveChapterList';
import { SyncStatusCard } from './SyncStatusCard';
interface ResponsiveMangaDetailProps {
  manga: MangaWithRelations;
  /** Manga ID from router - use this to prevent stale data during navigation */
  mangaId?: number;
  isLoading?: boolean;
  error?: Error | null;
  onToggleMonitoring: (monitored: boolean) => void;
  onRefreshMetadata: () => void;
  onEditManga: () => void;
  onRemoveManga: () => void;
  onDownloadChapters?: (mangaId: string | number, chapterIds: (string | number)[]) => void;
  outOfSyncChapters?: (string | number)[];
  isUpdating?: boolean;
}

/**
 * Desktop header component
 */
function DesktopMangaHeader({
  manga: _manga,
  isMonitoring: _isMonitoring,
  onToggleMonitoring: _onToggleMonitoring,
  onRefresh: _onRefresh,
  onEdit: _onEdit,
  onRemove: _onRemove,
  isUpdating: _isUpdating
}: {
  manga: MangaWithRelations;
  isMonitoring: boolean;
  onToggleMonitoring: (monitored: boolean) => void;
  onRefresh: () => void;
  onEdit: () => void;
  onRemove: () => void;
  isUpdating?: boolean;
}): React.ReactElement {
  // Desktop header implementation (simplified for brevity)
  // This would be the existing desktop header from the manga detail page
  return <Paper p="md" withBorder>
      <Text>Desktop Header - To be implemented with existing desktop layout</Text>
    </Paper>;
}

/**
 * Responsive manga detail view
 */
export function ResponsiveMangaDetail({
  manga,
  mangaId: propMangaId,
  isLoading = false,
  error = null,
  onToggleMonitoring,
  onRefreshMetadata,
  onEditManga,
  onRemoveManga,
  onDownloadChapters,
  outOfSyncChapters = [],
  isUpdating = false
}: ResponsiveMangaDetailProps): React.ReactElement {
  const {
    isMobile,
    isTablet
  } = useBreakpoint();

  const labels = useMediaTypeLabels((manga as { mediaType?: string }).mediaType);
  const [activeTab, setActiveTab] = useState<string | null>('chapters');
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Extract monitoring status with proper type guard
  useEffect(() => {
    const config = manga.monitoringConfig;
    const monitoring = (config && typeof config === 'object' && 'monitor' in config)
      ? Boolean(config['monitor'])
      : false;
    setIsMonitoring(monitoring);
  }, [manga.monitoringConfig]);

  // Pull to refresh for mobile - commented out for now
  // const { pullToRefreshProps, isRefreshing } = usePullToRefresh({
  //   onRefresh: async () => {
  //     await onRefreshMetadata();
  //     toast.success('Metadata refreshed');
  //   },
  //   disabled: isLoading || isUpdating
  // });
  const pullToRefreshProps = {};
  const isRefreshing = false;

  // Calculate chapter stats
  const chapterStats = React.useMemo(() => {
    const chapters = manga.Chapter;
    const downloaded = chapters.filter(ch => ch.downloadStatus === ChapterStatus.COMPLETED).length;
    const total = chapters.length;
    return {
      total,
      downloaded,
      missing: total - downloaded,
      outOfSync: outOfSyncChapters.length
    };
  }, [manga.Chapter, outOfSyncChapters.length]);

  // Handle monitoring toggle
  const handleToggleMonitoring = (monitored: boolean): void => {
    setIsMonitoring(monitored);
    onToggleMonitoring(monitored);
  };
  if (isLoading) {
    return <Center h="100vh">
        <Loader size="lg" />
      </Center>;
  }
  if (error) {
    return <Container size="sm" py="xl">
        <Alert icon={<IconAlertCircle />} title="Error loading manga" color="red">

          {(error instanceof Error ? error.message : String(error))}
        </Alert>
      </Container>;
  }

  // Mobile layout with tabs
  if (isMobile) {
    return <Box {...pullToRefreshProps}>
        <Stack gap={0}>
          {/* Mobile Header */}
          <MobileMangaHeader manga={manga} isMonitoring={isMonitoring} onToggleMonitoring={handleToggleMonitoring} onRefresh={onRefreshMetadata} onEdit={onEditManga} onRemove={onRemoveManga} isUpdating={isUpdating || isRefreshing} />

          {/* Mobile Tabs */}
          <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md" p="sm">

            <Tabs.List grow>
              <Tabs.Tab value="chapters" leftSection={<IconBook size={16} />} rightSection={chapterStats.missing > 0 && <Badge size="xs" color="red" variant="filled">
                      {chapterStats.missing}
                    </Badge>}>

                Chapters
              </Tabs.Tab>
              <Tabs.Tab value="info" leftSection={<IconInfoCircle size={16} />}>

                Info
              </Tabs.Tab>
              <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />} rightSection={chapterStats.outOfSync > 0 && <Badge size="xs" color="orange" variant="filled">
                      {chapterStats.outOfSync}
                    </Badge>}>

                Settings
              </Tabs.Tab>
            </Tabs.List>

            {/* Swipeable Tab Content - SwipeableView commented out */}
            <Box>
              <Tabs.Panel value="chapters" pt="sm">
                <ResponsiveChapterList
                  manga={manga}
                  {...(propMangaId !== undefined ? { mangaId: propMangaId } : {})}
                  outOfSyncChapters={outOfSyncChapters}
                  {...(onDownloadChapters !== undefined && { onDownload: onDownloadChapters })}
                  onRefresh={onRefreshMetadata}
                />

              </Tabs.Panel>

              <Tabs.Panel value="info" pt="sm">
                <Stack gap="md" p="sm">
                  {/* Additional manga info can go here */}
                  <Paper p="md" withBorder>
                    <Text size="sm" c="dimmed">
                      Additional manga information and metadata would be displayed here.
                    </Text>
                  </Paper>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="settings" pt="sm">
                <Stack gap="md" p="sm">
                  {chapterStats.outOfSync > 0 && <SyncStatusCard mangaId={toNumberId(manga["id"])} mangaTitle={manga["title"]} />}
                  {/* Additional settings would go here */}
                </Stack>
              </Tabs.Panel>
            </Box>
          </Tabs>
        </Stack>

        {/* Floating Action Button for quick actions */}
        <FloatingActionButton actions={[{
        id: 'refresh',
        icon: <IconRefresh size={20} />,
        label: 'Refresh',
        onClick: onRefreshMetadata,
        color: 'blue'
      }]} />

      </Box>;
  }

  // Tablet/Desktop layout
  return <Container size={isTablet ? 'md' : 'lg'} py="md">
      <Stack gap="lg">
        {/* Desktop Header */}
        <DesktopMangaHeader manga={manga} isMonitoring={isMonitoring} onToggleMonitoring={handleToggleMonitoring} onRefresh={onRefreshMetadata} onEdit={onEditManga} onRemove={onRemoveManga} isUpdating={isUpdating} />

        {/* Sync Status Alert */}
        {chapterStats.outOfSync > 0 && <SyncStatusCard mangaId={toNumberId(manga["id"])} mangaTitle={manga["title"]} />}

        {/* Chapter List */}
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="md">
            <Text size="lg" fw={600}>{labels.Units}</Text>
            <Group gap="xs">
              <GetComicsButton
                mangaId={toNumberId(manga["id"])}
                mangaTitle={manga["title"] as string}
                mediaType={(manga as { mediaType?: string }).mediaType}
              />
              <Badge color="green">{chapterStats.downloaded} downloaded</Badge>
              {chapterStats.missing > 0 && <Badge color="gray">{chapterStats.missing} missing</Badge>}
            </Group>
          </Group>

          <ResponsiveChapterList
            manga={manga}
            {...(propMangaId !== undefined ? { mangaId: propMangaId } : {})}
            outOfSyncChapters={outOfSyncChapters}
            {...(onDownloadChapters !== undefined && { onDownload: onDownloadChapters })}
            onRefresh={onRefreshMetadata}
          />

        </Paper>
      </Stack>
    </Container>;
}