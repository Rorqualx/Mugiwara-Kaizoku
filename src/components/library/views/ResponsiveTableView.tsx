
/**
 * Responsive Table View Component
 * 
 * Mobile-optimized table view for manga library using ResponsiveTable.
 * Automatically switches to card view on mobile devices.
 * 
 * @module components/library/views/ResponsiveTableView
 */

import React, { useCallback, useMemo, useState } from 'react';



// Define MangaEntity with relations - must include Library for consistency
type MangaEntity = Prisma.MangaGetPayload<{
  include: {
    Metadata: true;
    Chapter: true;
    Library: true;
  };
}>;
import { Group, Text, Badge, Avatar, Progress, Checkbox } from '@mantine/core';
import {MangaPublicationStatus} from '@prisma/client';
import { IconBook } from '@tabler/icons-react';

import { ResponsiveTable } from '@/components/responsive/ResponsiveTable';
import type { TableSortState } from '@/components/responsive/ResponsiveTable';
import { useNavigation } from '@/hooks/useNavigation';
import { useLibraryViewStore } from '@/store/index';
import { toStringId } from '@/utils/id-converters';

// Sentinel-band filtering (index >= 100000 pack-import volume rows) is
// centralized in libraryUtils — getLatestChapterNumber/calculateProgress/
// getDownloadStatus already apply it internally.
import { filterAndSortManga, getLatestChapterNumber, isRealChapter } from '../utils/libraryUtils';

import { ResponsiveTableRowActions } from './ResponsiveTableRowActions';

import type { Prisma } from '@prisma/client';
interface TableViewProps {
  manga: MangaEntity[];
  libraryId?: number;
  _libraryId?: number;
  onRefresh: () => void;
  searchedManga?: MangaEntity[];
}
export function ResponsiveTableView({
  manga,
  _libraryId,
  onRefresh,
  searchedManga
}: TableViewProps): React.ReactElement {
  const { navigateTo } = useNavigation();

  // Get state from store
  const sortBy = useLibraryViewStore(state => state.sortBy);
  const filterBy = useLibraryViewStore(state => state.filterBy);
  const searchQuery = useLibraryViewStore(state => state.searchQuery);
  const searchField = useLibraryViewStore(state => state.searchField);
  const enableRegexSearch = useLibraryViewStore(state => state.enableRegexSearch);
  const advancedFilters = useLibraryViewStore(state => state.advancedFilters);
  const showCovers = useLibraryViewStore(state => state.showCovers);
  const showProgress = useLibraryViewStore(state => state.showProgress);
  const selectionMode = useLibraryViewStore(state => state.selectionMode);
  const selectedItems = useLibraryViewStore(state => state.selectedItems);
  const toggleItemSelection = useLibraryViewStore(state => state.toggleItemSelection);

  // Table-local sort. Independent of the store's `sortBy` (which drives the
  // preset/dropdown selector); clicking a column header overrides until the
  // user clicks the active column a third time to clear back to the store sort.
  const [tableSort, setTableSort] = useState<TableSortState | null>(null);

  const handleSort = useCallback((key: string) => {
    setTableSort(prev => {
      if (prev?.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }, []);

  // Apply filtering and sorting
  const displayedManga = useMemo(() => {
    // filterAndSortManga returns manga without library relation, but our manga already has it
    // Type assertion needed to match filterAndSortManga signature
    type MangaWithoutLibrary = Omit<MangaEntity, 'Library'> & { Library?: MangaEntity['Library'] };
    const base = filterAndSortManga(manga as unknown as MangaWithoutLibrary[], {
      sortBy,
      filterBy,
      searchQuery,
      searchField,
      enableRegexSearch,
      advancedFilters,
      searchedManga: searchedManga as unknown as MangaWithoutLibrary[]
    }) as MangaEntity[];

    if (!tableSort) return base;

    const dir = tableSort.direction === 'asc' ? 1 : -1;
    const sorted = [...base].sort((a, b) => {
      switch (tableSort.key) {
        case 'title':
          return a["title"].localeCompare(b["title"], undefined, { sensitivity: 'base', numeric: true }) * dir;
        case 'status': {
          const aStatus = a.Metadata?.status ?? '';
          const bStatus = b.Metadata?.status ?? '';
          return aStatus.localeCompare(bStatus) * dir;
        }
        case 'chapters':
          return (a.Chapter.filter(isRealChapter).length - b.Chapter.filter(isRealChapter).length) * dir;
        case 'progress': {
          const aReal = a.Chapter.filter(isRealChapter);
          const bReal = b.Chapter.filter(isRealChapter);
          const aPct = aReal.length > 0 ? aReal.filter(c => c.downloadStatus === 'COMPLETED').length / aReal.length : 0;
          const bPct = bReal.length > 0 ? bReal.filter(c => c.downloadStatus === 'COMPLETED').length / bReal.length : 0;
          return (aPct - bPct) * dir;
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [manga, searchedManga, searchQuery, searchField, enableRegexSearch, advancedFilters, filterBy, sortBy, tableSort]);

  // Helper to get cover URL with fallback chain (Phase 1: coverUrl dropped)
  const getCoverUrl = (manga: MangaEntity, mangaId?: number): string | undefined => {
    const raw = manga.Metadata?.coverLarge ??
           manga.Metadata?.coverMedium ??
           manga.Metadata?.cover ??
           undefined;
    if (!raw && mangaId !== undefined) return `/api/local-cover/${mangaId}`;
    return raw;
  };

  // Define columns for ResponsiveTable
  const columns = [{
    accessor: 'cover',
    title: '',
    render: (manga: MangaEntity) => {
      const idStr = toStringId(manga["id"]);
      // In selection mode, the first column hosts the row checkbox instead
      // of the cover thumbnail — keeps the selected state visible without
      // adding an extra column.
      if (selectionMode) {
        return (
          <Checkbox
            checked={selectedItems.includes(idStr)}
            onChange={() => toggleItemSelection(idStr)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${manga["title"]}`}
          />
        );
      }
      const coverUrl = getCoverUrl(manga, manga["id"]);
      return showCovers ? <Avatar {...(coverUrl ? { src: coverUrl } : {})} size="sm" radius="sm">
            <IconBook />
          </Avatar> : null;
    },
    showInCard: true,
    mobilePriority: 1,
    minWidth: 48
  }, {
    accessor: 'title',
    title: 'Title',
    sortable: true,
    render: (manga: MangaEntity) => (
      <Group gap="xs" wrap="nowrap">
        <Text fw={500} size="sm" lineClamp={1}>{manga["title"]}</Text>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {manga.Metadata?.authors.join(', ') ?? 'Unknown Author'}
        </Text>
      </Group>
    ),
    showInCard: true,
    mobilePriority: 2
  }, {
    accessor: 'status',
    title: 'Status',
    sortable: true,
    render: (manga: MangaEntity) => {
      const publicationStatus = manga.Metadata?.status;
      const statusColor = publicationStatus === MangaPublicationStatus.COMPLETED ? 'green' : publicationStatus === MangaPublicationStatus.ONGOING ? 'blue' : 'gray';
      return <Badge color={statusColor} variant="light" size="sm">
            {publicationStatus ?? 'Unknown'}
          </Badge>;
    },
    showInCard: true,
    mobilePriority: 3
  }, {
    accessor: 'chapters',
    title: 'Chapters',
    sortable: true,
    render: (manga: MangaEntity) => {
      // Show real chapter count (excludes the index >= 100000 pack-import
      // sentinel band — those are imported volume files, not chapters).
      const count = manga.Chapter.filter(isRealChapter).length;
      return <Group gap="xs" wrap="nowrap">
            <Text size="sm">{count}</Text>
          </Group>;
    },
    showInCard: true,
    mobilePriority: 4
  }, {
    accessor: 'progress',
    title: 'Progress',
    sortable: true,
    render: (manga: MangaEntity) => {
      if (!showProgress) return null;
      // Download progress (downloaded real chapters / total real chapters) —
      // sentinel pack rows are excluded so a series with no real downloads
      // but lots of pack rows doesn't read as "100% complete".
      const realChapters = manga.Chapter.filter(isRealChapter);
      const total = realChapters.length;
      const downloaded = realChapters.filter(c => c.downloadStatus === 'COMPLETED').length;
      const progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
      return <Group gap="xs" wrap="nowrap">
            <Progress value={progress} size="sm" style={{
          minWidth: 60
        }} />
            <Text size="xs" c="dimmed">{progress}%</Text>
          </Group>;
    },
    hideOnMobile: true,
    mobilePriority: 5
  }, {
    accessor: 'actions',
    title: '',
    render: (manga: MangaEntity) => (
      <ResponsiveTableRowActions
        mangaId={manga["id"]}
        title={manga["title"]}
        onChanged={onRefresh}
      />
    ),
    showInCard: true,
    mobilePriority: 7
  }];

  // Custom mobile card renderer
  const mobileCardRender = (manga: MangaEntity): React.ReactElement => {
    const coverUrl = getCoverUrl(manga, manga["id"]);
    return <Group gap="sm" p="xs" wrap="nowrap">
      {showCovers && <Avatar {...(coverUrl ? { src: coverUrl } : {})} size="lg" radius="sm">
          <IconBook />
        </Avatar>}
      <div style={{
      flex: 1
    }}>
        <Text fw={500} lineClamp={1}>{manga["title"]}</Text>
        <Group gap="xs">
          <Badge color={manga.Metadata?.status === MangaPublicationStatus.COMPLETED ? 'green' : 'blue'} variant="light" size="xs">
            {manga.Metadata?.status ?? 'Unknown'}
          </Badge>
          <Text size="xs" c="dimmed">
            {getLatestChapterNumber(manga)} chapters
          </Text>
        </Group>
      </div>
      <ResponsiveTableRowActions
        mangaId={manga["id"]}
        title={manga["title"]}
        onChanged={onRefresh}
      />
    </Group>;
  };

  if (displayedManga.length === 0) {
    return <Text c="dimmed" ta="center" py="xl">
        No manga found matching your filters
      </Text>;
  }
  const handleRowClick = (record: MangaEntity): void => {
    if (selectionMode) {
      toggleItemSelection(toStringId(record["id"]));
      return;
    }
    void navigateTo(`/manga/${record["id"]}`);
  };

  return <ResponsiveTable records={displayedManga} columns={columns} idAccessor="id" mobileCardRender={mobileCardRender} onRowClick={handleRowClick} sortState={tableSort} onSort={handleSort} striped highlightOnHover withTableBorder withColumnBorders />;
}