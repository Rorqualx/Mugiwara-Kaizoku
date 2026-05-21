// @file-size-justified: Responsive view handles multiple breakpoints and complex layout transitions - splitting would complicate responsive logic
/* eslint-disable @typescript-eslint/no-unnecessary-condition, max-lines */
/**
 * Responsive Detailed View Component
 *
 * Mobile-optimized detailed view showing comprehensive manga information.
 * Adapts layout for mobile devices with better touch targets and stacked layouts.
 *
 * @module components/library/views/ResponsiveDetailedView
 */

import React, { useMemo, useState } from 'react';

import { Stack, Card, Group, Text, Badge, ActionIcon, Progress, ScrollArea, Checkbox, Button, Collapse, Image, Box, Menu } from '@mantine/core';
import { MangaPublicationStatus } from '@prisma/client';
import { IconRefresh, IconEye, IconDots, IconChevronDown, IconChevronUp, IconUser, IconTags } from '@tabler/icons-react';

import { useBreakpoint } from '@/hooks/mobile';
import { useNavigation } from '@/hooks/useNavigation';
import { useLibraryViewStore } from '@/store/index';
import { toStringId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';

import { filterAndSortManga, calculateProgress, getLatestChapterNumber } from '../utils/libraryUtils';

import type { Prisma } from '@prisma/client';

// Define MangaEntity with relations
type MangaEntity = Prisma.MangaGetPayload<{
  include: {
    Metadata: true;
    Chapter: true;
  };
}> & {
  library?: Prisma.LibraryGetPayload<Record<string, unknown>>;
};

interface DetailedViewProps {
  manga: MangaEntity[];
  libraryId?: number;
  onRefresh: () => void;
  searchedManga?: MangaEntity[];
}

// Helper component for card content
interface MangaCardContentProps {
  manga: MangaEntity;
  isMobile: boolean;
  isTablet: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  progress: number;
  availableChapters: number;
  readChapters: number;
  showCovers: boolean;
  showProgress: boolean;
  coverDimensions: { width: number; height: number };
  iconSize: number;
  actionIconSize: 'sm' | 'md';
  onToggleSelection: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onNavigate: (id: number) => void;
  onRefresh: () => void;
}

// Cover Image Component
interface CoverImageProps {
  manga: MangaEntity;
  showCovers: boolean;
  coverDimensions: { width: number; height: number };
  onNavigate: (id: number) => void;
}

function CoverImage({ manga, showCovers, coverDimensions, onNavigate }: CoverImageProps): React.ReactElement | null {
  if (!showCovers) return null;

  // Get cover URL with fallback chain
  const coverUrl = manga.Metadata?.coverLarge ??
                   manga.Metadata?.coverMedium ??
                   manga.Metadata?.cover ??
                   manga.Metadata?.coverUrl ??
                   undefined;

  return (
    <Box>
      <Image
        src={coverUrl}
        alt={manga.title}
        width={coverDimensions.width}
        height={coverDimensions.height}
        radius="sm"
        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3C/svg%3E"
        onClick={() => { void onNavigate(manga.id); }}
        style={{ cursor: 'pointer' }}
      />
    </Box>
  );
}

// Title and Status Component
interface TitleStatusProps {
  manga: MangaEntity;
  isMobile: boolean;
  onNavigate: (id: number) => void;
}

function TitleStatus({ manga, isMobile, onNavigate }: TitleStatusProps): React.ReactElement {
  return (
    <Group justify="space-between" wrap="wrap">
      <Text
        fw={600}
        size={isMobile ? 'md' : 'lg'}
        style={{ cursor: 'pointer' }}
        onClick={() => { void onNavigate(manga.id); }}
      >
        {manga.title}
      </Text>
      <Badge
        color={manga.Metadata?.status === MangaPublicationStatus.COMPLETED ? 'green' : 'blue'}
        variant="light"
        size={isMobile ? 'sm' : 'md'}
      >
        {manga.Metadata?.status ?? 'Unknown'}
      </Badge>
    </Group>
  );
}

// Author Information Component
interface AuthorInfoProps {
  manga: MangaEntity;
}

function AuthorInfo({ manga }: AuthorInfoProps): React.ReactElement | null {
  if (!manga.Metadata?.authors || manga.Metadata.authors.length === 0) return null;

  return (
    <Group gap="xs" wrap="wrap">
      <Group gap={4} wrap="nowrap">
        <IconUser size={14} color="var(--mantine-color-dimmed)" />
        <Text size="sm" c="dimmed">
          {manga.Metadata.authors.join(', ')}
        </Text>
      </Group>
    </Group>
  );
}

// Chapter and Progress Component
interface ChapterProgressProps {
  manga: MangaEntity;
  isMobile: boolean;
  showProgress: boolean;
  progress: number;
}

function ChapterProgress({ manga, isMobile, showProgress, progress }: ChapterProgressProps): React.ReactElement {
  return (
    <Group gap={isMobile ? 'xs' : 'md'} wrap="wrap">
      <Group gap="xs">
        <Text size="sm" fw={500}>Chapters:</Text>
        <Text size="sm">{getLatestChapterNumber(manga)}</Text>
      </Group>

      {showProgress && (
        <Group gap="xs">
          <Text size="sm" fw={500}>Progress:</Text>
          <Progress value={progress} size="sm" style={{ width: isMobile ? 60 : 80 }} />
          <Text size="xs" c="dimmed">{progress}%</Text>
        </Group>
      )}
    </Group>
  );
}

// Genre Tags Component
interface GenreTagsProps {
  manga: MangaEntity;
  isMobile: boolean;
}

function GenreTags({ manga, isMobile }: GenreTagsProps): React.ReactElement | null {
  if (!manga.Metadata?.genres || manga.Metadata.genres.length === 0) return null;

  return (
    <Group gap={4} wrap="wrap">
      <IconTags size={14} color="var(--mantine-color-dimmed)" />
      {(isMobile ? manga.Metadata.genres.slice(0, 3) : manga.Metadata.genres).map(genre => (
        <Badge key={genre} size="xs" variant="outline">
          {genre}
        </Badge>
      ))}
      {isMobile && manga.Metadata.genres.length > 3 && (
        <Badge size="xs" variant="outline">
          +{manga.Metadata.genres.length - 3}
        </Badge>
      )}
    </Group>
  );
}

// Action Buttons Component
interface ActionButtonsProps {
  manga: MangaEntity;
  isMobile: boolean;
  actionIconSize: 'sm' | 'md';
  iconSize: number;
  onNavigate: (id: number) => void;
  onRefresh: () => void;
}

function ActionButtons({ manga, isMobile, actionIconSize, iconSize, onNavigate, onRefresh }: ActionButtonsProps): React.ReactElement {
  return (
    <Group
      gap="xs"
      style={isMobile ? { width: '100%' } : {}}
      justify={isMobile ? 'center' : 'flex-start'}
    >
      <ActionIcon
        variant="subtle"
        size={actionIconSize}
        onClick={() => {
          notify({ severity: 'INFO', title: 'Refreshing', message: `Updating ${manga.title}...` });
          onRefresh();
        }}
      >
        <IconRefresh size={iconSize} />
      </ActionIcon>
      <ActionIcon variant="subtle" size={actionIconSize} onClick={() => { void onNavigate(manga.id); }}>
        <IconEye size={iconSize} />
      </ActionIcon>
      <Menu withinPortal position="bottom-end">
        <Menu.Target>
          <ActionIcon variant="subtle" size={actionIconSize}>
            <IconDots size={iconSize} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconRefresh size={14} />}>
            Refresh Metadata
          </Menu.Item>
          <Menu.Item leftSection={<IconEye size={14} />}>
            View Details
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

// Expanded Content Component
interface ExpandedContentProps {
  manga: MangaEntity;
  isMobile: boolean;
  availableChapters: number;
  readChapters: number;
}

function ExpandedContent({ manga, isMobile, availableChapters, readChapters }: ExpandedContentProps): React.ReactElement {
  return (
    <Stack gap="xs" pt="xs">
      <Group gap="lg" wrap="wrap">
        <Group gap="xs">
          <Text size="sm" c="dimmed">Available:</Text>
          <Text size="sm" fw={500}>{availableChapters} chapters</Text>
        </Group>
        <Group gap="xs">
          <Text size="sm" c="dimmed">Read:</Text>
          <Text size="sm" fw={500}>{readChapters} chapters</Text>
        </Group>
      </Group>

      {manga.Metadata?.summary && (
        <Box>
          <Text size="sm" fw={500} mb={4}>Description:</Text>
          <Text size="sm" c="dimmed" lineClamp={3}>
            {manga.Metadata.summary}
          </Text>
        </Box>
      )}

      {(manga.Chapter?.length ?? 0) > 0 && (
        <Box>
          <Text size="sm" fw={500} mb={4}>Recent Chapters:</Text>
          <ScrollArea style={{ height: isMobile ? 150 : 200 }}>
            <Stack gap={4}>
              {(manga.Chapter ?? []).slice(0, 5).map(chapter => (
                <Group key={chapter.id} justify="space-between">
                  <Text size="xs">{chapter.title || `Chapter ${chapter.chapterNumber}`}</Text>
                  <Badge size="xs" variant="dot">
                    {chapter.downloadStatus}
                  </Badge>
                </Group>
              ))}
            </Stack>
          </ScrollArea>
        </Box>
      )}
    </Stack>
  );
}

// Main Manga Card Content Component
function MangaCardContent({
  manga: m,
  isMobile,
  isSelected,
  isExpanded,
  progress,
  availableChapters,
  readChapters,
  showCovers,
  showProgress,
  coverDimensions,
  iconSize,
  actionIconSize,
  onToggleSelection,
  onToggleExpanded,
  onNavigate,
  onRefresh
}: MangaCardContentProps): React.ReactElement {
  return (
    <Stack gap={isMobile ? 'xs' : 'sm'}>
      <Group align="flex-start" gap={isMobile ? 'sm' : 'md'} wrap={isMobile ? 'wrap' : 'nowrap'}>
        <Checkbox
          checked={isSelected}
          onChange={() => { void onToggleSelection(toStringId(m.id)); }}
          size={isMobile ? 'md' : 'sm'}
          style={{ alignSelf: 'center' }}
        />

        <CoverImage
          manga={m}
          showCovers={showCovers}
          coverDimensions={coverDimensions}
          onNavigate={onNavigate}
        />

        <Stack gap="xs" style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}>
          <TitleStatus manga={m} isMobile={isMobile} onNavigate={onNavigate} />
          <AuthorInfo manga={m} />
          <ChapterProgress
            manga={m}
            isMobile={isMobile}
            showProgress={showProgress}
            progress={progress}
          />
          <GenreTags manga={m} isMobile={isMobile} />

          {isMobile && (
            <Button
              variant="subtle"
              size="xs"
              onClick={() => { void onToggleExpanded(toStringId(m.id)); }}
              rightSection={isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            >
              {isExpanded ? 'Show Less' : 'Show More'}
            </Button>
          )}
        </Stack>

        <ActionButtons
          manga={m}
          isMobile={isMobile}
          actionIconSize={actionIconSize}
          iconSize={iconSize}
          onNavigate={onNavigate}
          onRefresh={onRefresh}
        />
      </Group>

      <Collapse in={!isMobile || isExpanded}>
        <ExpandedContent
          manga={m}
          isMobile={isMobile}
          availableChapters={availableChapters}
          readChapters={readChapters}
        />
      </Collapse>
    </Stack>
  );
}

export function ResponsiveDetailedView({
  manga,
  libraryId: _libraryId,
  onRefresh,
  searchedManga
}: DetailedViewProps): React.ReactElement | null {
  const { navigateTo } = useNavigation();
  const {
    isMobile,
    isTablet
  } = useBreakpoint();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Get state from store
  const sortBy = useLibraryViewStore(state => state.sortBy);
  const filterBy = useLibraryViewStore(state => state.filterBy);
  const searchQuery = useLibraryViewStore(state => state.searchQuery);
  const searchField = useLibraryViewStore(state => state.searchField);
  const enableRegexSearch = useLibraryViewStore(state => state.enableRegexSearch);
  const advancedFilters = useLibraryViewStore(state => state.advancedFilters);
  const selectedItems = useLibraryViewStore(state => state.selectedItems);
  const toggleItemSelection = useLibraryViewStore(state => state.toggleItemSelection);
  const showCovers = useLibraryViewStore(state => state.showCovers);
  const showProgress = useLibraryViewStore(state => state.showProgress);

  // Helper functions
  const getAvailableChapters = (manga: MangaEntity): number => {
    return manga.Chapter?.length ?? 0;
  };
  const getReadChapters = (manga: MangaEntity): number => {
    return manga.Chapter?.filter(ch => ch.isRead).length ?? 0;
  };

  // Apply filtering and sorting
  const displayedManga = useMemo(() => {
    return filterAndSortManga(manga, {
      sortBy,
      filterBy,
      searchQuery,
      searchField,
      enableRegexSearch,
      advancedFilters,
      ...(searchedManga && { searchedManga })
    });
  }, [manga, searchedManga, searchQuery, searchField, enableRegexSearch, advancedFilters, filterBy, sortBy]);

  // Toggle card expansion
  const toggleExpanded = (mangaId: string): void => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mangaId)) {
        newSet.delete(mangaId);
      } else {
        newSet.add(mangaId);
      }
      return newSet;
    });
  };

  // Get responsive dimensions
  const coverDimensions = isMobile ? {
    width: 80,
    height: 120
  } : isTablet ? {
    width: 100,
    height: 150
  } : {
    width: 120,
    height: 180
  };
  const iconSize = isMobile ? 20 : 18;
  const actionIconSize = isMobile ? 'md' : 'sm';

  const handleNavigate = (id: number): void => {
    void navigateTo(`/manga/${id}`);
  };

  return (
    <Stack gap="md">
      {displayedManga.map(m => {
        const isExpanded = expandedCards.has(toStringId(m.id));
        const isSelected = selectedItems.includes(toStringId(m.id));
        const progress = calculateProgress(m);
        const availableChapters = getAvailableChapters(m);
        const readChapters = getReadChapters(m);

        return (
          <Card key={m.id} shadow="sm" padding={isMobile ? 'sm' : 'md'} radius="md" withBorder>
            <MangaCardContent
              manga={m}
              isMobile={isMobile}
              isTablet={isTablet}
              isSelected={isSelected}
              isExpanded={isExpanded}
              progress={progress}
              availableChapters={availableChapters}
              readChapters={readChapters}
              showCovers={showCovers}
              showProgress={showProgress}
              coverDimensions={coverDimensions}
              iconSize={iconSize}
              actionIconSize={actionIconSize}
              onToggleSelection={toggleItemSelection}
              onToggleExpanded={toggleExpanded}
              onNavigate={handleNavigate}
              onRefresh={onRefresh}
            />
          </Card>
        );
      })}

      {displayedManga.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          No manga found matching your filters
        </Text>
      )}
    </Stack>
  );
}