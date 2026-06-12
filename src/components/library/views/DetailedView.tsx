/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import React, { useMemo, useState } from 'react';

import { Card, Group, Text, Badge, Stack, Progress, Button, Collapse, Divider, ActionIcon, Checkbox, ScrollArea } from '@mantine/core';
import { MangaPublicationStatus, ChapterStatus } from '@prisma/client';
import { IconChevronDown, IconChevronUp, IconDownload, IconCheck, IconBook, IconRefresh, IconTrash } from '@tabler/icons-react';

import { MangaCover } from '@/components/manga/MangaCover';
import { useNavigation } from '@/hooks/useNavigation';
import { useLibraryViewStore } from '@/store/index';
import { toStringId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';

import { filterAndSortManga, calculateProgress, getDownloadStatus, isRealChapter } from '../utils/libraryUtils';

import type { Prisma } from '@prisma/client';

/**
 * Detailed View Component
 *
 * List-based view showing manga with extended metadata and chapter previews.
 * Provides the most information-dense view of the library.
 *
 * @module components/library/views/DetailedView
 */

// Define MangaEntity with relations for this component
type MangaEntity = Prisma.MangaGetPayload<{
  include: {
    Chapter: true;
    Metadata: true;
  };
}>;

interface DetailedViewProps {
  manga: MangaEntity[];
  libraryId: number;
  searchedManga?: MangaEntity[];
}
interface MangaDetailCardProps {
  manga: MangaEntity;
  isSelected: boolean;
  onSelect: () => void;
  onNavigate: () => void;
  showCovers: boolean;
  showProgress: boolean;
  selectionMode: boolean;
}

// Sub-components to reduce complexity
interface AuthorArtistInfoProps {
  metadata: MangaEntity['Metadata'] | null;
}

function AuthorArtistInfo({ metadata }: AuthorArtistInfoProps): React.ReactElement | null {
  if (!metadata?.authors && !metadata?.artists) return null;

  const authors = metadata.authors;
  const artists = metadata.artists;
  
  const hasAuthors = authors.length > 0;
  const hasArtists = artists.length > 0;
  const artistsDifferentFromAuthors = hasArtists && artists.join(',') !== authors.join(',');

  if (!hasAuthors && !hasArtists) return null;

  return (
    <Group gap="xs">
      {hasAuthors && (
        <Text size="sm" c="dimmed">
          By {authors.join(', ')}
        </Text>
      )}
      {artistsDifferentFromAuthors && (
        <Text size="sm" c="dimmed">
          Art by {artists.join(', ')}
        </Text>
      )}
    </Group>
  );
}

interface StatusBadgesProps {
  publicationStatus: MangaPublicationStatus;
  source?: string | null;
  hasErrors: boolean;
}

function StatusBadges({ publicationStatus, source, hasErrors }: StatusBadgesProps): React.ReactElement {
  return (
    <Group gap="xs">
      <Badge
        color={publicationStatus === MangaPublicationStatus.COMPLETED ? 'green' : 'blue'}
        variant="light"
      >
        {publicationStatus}
      </Badge>
      {source && <Badge variant="outline">{source}</Badge>}
      {hasErrors && <Badge color="red" variant="filled">Has unknown as Errors</Badge>}
    </Group>
  );
}

interface ActionButtonsProps {
  onAction: (action: string, e: React.MouseEvent) => void;
}

function ActionButtons({ onAction }: ActionButtonsProps): React.ReactElement {
  return (
    <Group gap="xs">
      <ActionIcon
        variant="subtle"
        onClick={(e) => { void onAction('Mark as Read', e); }}
        title="Mark all as read"
      >
        <IconCheck size={18} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        onClick={(e) => { void onAction('Download All', e); }}
        title="Download all chapters"
      >
        <IconDownload size={18} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        onClick={(e) => { void onAction('Update Metadata', e); }}
        title="Update metadata"
      >
        <IconRefresh size={18} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="red"
        onClick={(e) => { void onAction('Remove from Library', e); }}
        title="Remove from library"
      >
        <IconTrash size={18} />
      </ActionIcon>
    </Group>
  );
}

interface StatsRowProps {
  chapterCount: number;
  downloaded: number;
  total: number;
  progress: number;
  showProgress: boolean;
  startDate?: Date | null | undefined;
}

function StatsRow({ chapterCount, downloaded, total, progress, showProgress, startDate }: StatsRowProps): React.ReactElement {
  return (
    <Group gap="xl">
      <Stack gap={4}>
        <Text size="xs" c="dimmed">Chapters</Text>
        <Text fw={500}>{chapterCount}</Text>
      </Stack>

      <Stack gap={4}>
        <Text size="xs" c="dimmed">Downloaded</Text>
        <Text fw={500}>{downloaded}/{total}</Text>
      </Stack>

      {showProgress && (
        <Stack gap={4}>
          <Text size="xs" c="dimmed">Progress</Text>
          <Group gap="xs">
            <Progress value={progress} w={80} size="md" />
            <Text fw={500}>{progress}%</Text>
          </Group>
        </Stack>
      )}

      {startDate && (
        <Stack gap={4}>
          <Text size="xs" c="dimmed">Year</Text>
          <Text fw={500}>{new Date(startDate).getFullYear()}</Text>
        </Stack>
      )}
    </Group>
  );
}

interface GenresAndTagsProps {
  metadata: MangaEntity['Metadata'];
}

function GenresAndTags({ metadata }: GenresAndTagsProps): React.ReactElement | null {
  if (!metadata) return null;

  const metadataRecord = metadata as Record<string, unknown>;
  const hasGenresOrTags =
    ('genres' in metadataRecord && metadataRecord['genres']) ||
    ('tags' in metadataRecord && metadataRecord['tags']);

  if (!hasGenresOrTags) return null;

  const genres = Array.isArray(metadataRecord['genres']) ? metadataRecord['genres'] as string[] : [];
  const tags = Array.isArray(metadataRecord['tags']) ? metadataRecord['tags'] as string[] : [];

  return (
    <Group gap={6}>
      {genres.map((genre: string) => (
        <Badge key={genre} size="sm" variant="dot">
          {genre}
        </Badge>
      ))}
      {tags.slice(0, 3).map((tag: string) => (
        <Badge key={tag} size="sm" variant="outline">
          {tag}
        </Badge>
      ))}
      {tags.length > 3 && (
        <Badge size="sm" variant="outline">
          +{tags.length - 3} more
        </Badge>
      )}
    </Group>
  );
}

interface ChapterListSectionProps {
  latestChapters: MangaEntity['Chapter'];
  totalChapters: number;
  expanded: boolean;
  onToggle: () => void;
}

function ChapterListSection({ latestChapters, totalChapters, expanded, onToggle }: ChapterListSectionProps): React.ReactElement | null {
  if (latestChapters.length === 0) return null;

  return (
    <>
      <Divider />
      <Card.Section>
        <Button
          variant="subtle"
          fullWidth
          onClick={onToggle}
          rightSection={expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        >
          Latest Chapters ({latestChapters.length} of {totalChapters})
        </Button>

        <Collapse in={expanded}>
          <ScrollArea h={200} px="md" pb="md">
            <Stack gap="xs">
              {latestChapters.map((chapter) => (
                <Group key={chapter["id"]} justify="space-between" py={4}>
                  <Group gap="xs">
                    <Text size="sm">
                      Chapter {String(chapter.chapterNumber ?? '')}
                      {chapter["title"] && typeof chapter["title"] === 'string' && `: ${chapter["title"]}`}
                    </Text>
                    {chapter.isRead && <Badge size="xs" variant="light" color="green">Read</Badge>}
                    {chapter.downloadStatus === ChapterStatus.COMPLETED && (
                      <Badge size="xs" variant="light" color="blue">Downloaded</Badge>
                    )}
                  </Group>
                  <Group gap={4}>
                    <ActionIcon size="sm" variant="subtle">
                      <IconBook size={14} />
                    </ActionIcon>
                    <ActionIcon size="sm" variant="subtle">
                      <IconDownload size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              ))}
            </Stack>
          </ScrollArea>
        </Collapse>
      </Card.Section>
    </>
  );
}
function MangaDetailCard({
  manga,
  isSelected,
  onSelect,
  onNavigate,
  showCovers,
  showProgress,
  selectionMode
}: MangaDetailCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const progress = calculateProgress(manga);
  const downloadStatus = getDownloadStatus(manga);

  // Get cover URL with fallback chain (Phase 1: coverUrl column dropped)
  const coverUrl = manga.Metadata?.coverLarge ??
                   manga.Metadata?.coverMedium ??
                   manga.Metadata?.cover ??
                   undefined;

  // Description JSX element
  const descriptionElement: React.ReactNode = useMemo(() => {
    if (!manga.Metadata?.summary) return null;

    return (
      <Text size="sm" {...(expanded ? {} : { lineClamp: 2 })}>
        {manga.Metadata.summary}
      </Text>
    );
  }, [manga.Metadata?.summary, expanded]);

  // Get latest 5 chapters
  const latestChapters = useMemo(() => {
    const realChapters = (manga.Chapter ?? []).filter(isRealChapter);
    if (realChapters.length === 0) return [];
    return [...realChapters].sort((a, b) => {
      const aNum = parseFloat(String(a.chapterNumber ?? '0'));
      const bNum = parseFloat(String(b.chapterNumber ?? '0'));
      return bNum - aNum;
    }).slice(0, 5);
  }, [manga.Chapter]);
  const handleAction = (action: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    notify({ severity: 'INFO', title: action, message: 'This feature will be implemented with backend support' });
  };
  return <Card shadow="sm" radius="md" withBorder>
      <Card.Section>
        <Group p="md" gap="md" align="flex-start">
          {/* Selection checkbox */}
          {selectionMode && (
            <Checkbox checked={isSelected} onChange={e => {
              e.stopPropagation();
              onSelect();
            }} mt={6} />
          )}

          {/* Cover image */}
          {showCovers && <MangaCover src={coverUrl} alt={manga["title"]} w={120} h={180} radius="sm" seed={manga["id"]} style={{
          cursor: 'pointer'
        }} onClick={() => { void onNavigate(); }} />}
          
          {/* Main content */}
          <Stack style={{
          flex: 1
        }} gap="sm">
            {/* Title and metadata */}
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs">
                <Text fw={600} size="lg" style={{
                cursor: 'pointer'
              }} onClick={() => { void onNavigate(); }}>

                  {manga["title"]}
                </Text>
                
                <AuthorArtistInfo metadata={manga.Metadata} />
                
                <StatusBadges
                  publicationStatus={manga.publicationStatus}
                  source={manga["source"]}
                  hasErrors={downloadStatus.hasErrors}
                />
              </Stack>
              
              <ActionButtons onAction={handleAction} />
            </Group>

            {/* Description */}
            {descriptionElement}

            <StatsRow
              chapterCount={manga.Chapter?.filter(isRealChapter).length ?? 0}
              downloaded={downloadStatus.downloaded}
              total={downloadStatus.total}
              progress={progress}
              showProgress={showProgress}
              startDate={manga.Metadata?.startDate}
            />
            
            <GenresAndTags metadata={manga.Metadata} />
          </Stack>
        </Group>
      </Card.Section>
      
      <ChapterListSection
        latestChapters={latestChapters}
        totalChapters={manga.Chapter?.filter(isRealChapter).length ?? 0}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
    </Card>;
}
export function DetailedView({
  manga,
  libraryId,
  searchedManga
}: DetailedViewProps): React.ReactElement {
  const { navigateTo } = useNavigation();

  // Get state from store
  const sortBy = useLibraryViewStore(state => state.sortBy);
  const filterBy = useLibraryViewStore(state => state.filterBy);
  const searchQuery = useLibraryViewStore(state => state.searchQuery);
  const searchField = useLibraryViewStore(state => state.searchField);
  const enableRegexSearch = useLibraryViewStore(state => state.enableRegexSearch);
  const advancedFilters = useLibraryViewStore(state => state.advancedFilters);
  const selectedItems = useLibraryViewStore(state => state.selectedItems);
  const toggleItemSelection = useLibraryViewStore(state => state.toggleItemSelection);
  const selectionMode = useLibraryViewStore(state => state.selectionMode);
  const showCovers = useLibraryViewStore(state => state.showCovers);
  const showProgress = useLibraryViewStore(state => state.showProgress);

  // Apply filtering and sorting
  const displayedManga = useMemo(() => {
    return filterAndSortManga(manga, {
      sortBy,
      filterBy,
      searchQuery,
      searchField,
      enableRegexSearch,
      advancedFilters,
      ...(searchedManga !== undefined && { searchedManga })
    });
  }, [manga, searchedManga, searchQuery, searchField, enableRegexSearch, advancedFilters, filterBy, sortBy]);

  // Handle selection
  const handleSelect = (mangaId: string): void => {
    toggleItemSelection(mangaId);
  };
  return <Stack gap="md">
      {/* Add new manga button */}
      <Card shadow="sm" radius="md" withBorder style={{
      borderStyle: 'dashed'
    }}>
        <Card.Section p="xl">
          <Stack align="center" gap="sm">
            <Button variant="subtle" size="lg" onClick={() => { void navigateTo(`/library/${libraryId}/add`); }}>

              + Add New Manga
            </Button>
            <Text size="sm" c="dimmed">
              Click to browse and add manga to your library
            </Text>
          </Stack>
        </Card.Section>
      </Card>
      
      {/* Manga list */}
      {displayedManga.map(m => <MangaDetailCard key={m["id"]} manga={m} isSelected={selectedItems.includes(toStringId(m["id"]))} onSelect={() => { void handleSelect(toStringId(m["id"])); }} onNavigate={() => { void navigateTo(`/manga/${m["id"]}`); }} showCovers={showCovers} showProgress={showProgress} selectionMode={selectionMode} />)}
      
      {/* Empty state */}
      {displayedManga.length === 0 && manga.length > 0 && <Card shadow="sm" radius="md" withBorder>
          <Card.Section p="xl">
            <Stack align="center" gap="sm">
              <Text size="lg" c="dimmed">No manga match your filters</Text>
              <Text size="sm" c="dimmed">Try adjusting your search criteria</Text>
            </Stack>
          </Card.Section>
        </Card>}
    </Stack>;
}
