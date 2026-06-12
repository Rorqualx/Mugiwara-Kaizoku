/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/**
 * Table View Component
 *
 * Table-based view showing manga with sortable columns and inline actions.
 * Provides a compact, data-dense view of the library.
 * 
 * @module components/library/views/TableView
 */

import React, { useMemo, useState } from 'react';

import { Table, Group, Text, Badge, ActionIcon, Checkbox, Tooltip, Progress, Avatar, Menu } from '@mantine/core';
import { MangaPublicationStatus } from '@prisma/client';
import { IconDownload, IconCheck, IconBook, IconDots, IconTrash, IconRefresh, IconEye } from '@tabler/icons-react';

import { useNavigation } from '@/hooks/useNavigation';
import { useLibraryViewStore } from '@/store/index';
import { toStringId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';

import { filterAndSortManga, calculateProgress, getLatestChapterNumber, getDownloadStatus, isRealChapter } from '../utils/libraryUtils';

import type { Prisma } from '@prisma/client';

// Define MangaEntity with relations to match what filterAndSortManga expects
type MangaEntity = Prisma.MangaGetPayload<{
  include: {
    Metadata: true;
    Chapter: true;
  };
}>;
interface TableViewProps {
  manga: MangaEntity[];
  libraryId: number;
  onRefresh: () => void;
  searchedManga?: MangaEntity[];
}
export function TableView({
  manga,
  libraryId: _libraryId,
  onRefresh: _onRefresh,
  searchedManga
}: TableViewProps): React.ReactElement {
  const { navigateTo } = useNavigation();

  // Get state from store
  const sortBy = useLibraryViewStore(state => state.sortBy);
  const filterBy = useLibraryViewStore(state => state.filterBy);
  const searchQuery = useLibraryViewStore(state => state.searchQuery);
  const selectedItems = useLibraryViewStore(state => state.selectedItems);
  const selectAll = useLibraryViewStore(state => state.selectAll);
  const clearSelection = useLibraryViewStore(state => state.clearSelection);
  const toggleItemSelection = useLibraryViewStore(state => state.toggleItemSelection);
  const selectionMode = useLibraryViewStore(state => state.selectionMode);
  const showCovers = useLibraryViewStore(state => state.showCovers);
  const showProgress = useLibraryViewStore(state => state.showProgress);

  // Local state for table sorting
  const [tableSortBy, setTableSortBy] = useState<string | null>(null);
  const [reverseSortDirection, setReverseSortDirection] = useState(false);

  // Get additional state needed for filtering
  const searchField = useLibraryViewStore(state => state.searchField);
  const enableRegexSearch = useLibraryViewStore(state => state.enableRegexSearch);
  const advancedFilters = useLibraryViewStore(state => state.advancedFilters);

  // Apply filtering and sorting
  const displayedManga = useMemo(() => {
    let filtered = filterAndSortManga(manga, {
      sortBy,
      filterBy,
      searchQuery,
      searchField,
      enableRegexSearch,
      advancedFilters,
      ...(searchedManga && { searchedManga })
    });

    // Apply additional table column sorting if active
    if (tableSortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        switch (tableSortBy) {
          case 'title':
            aVal = a["title"] || '';
            bVal = b["title"] || '';
            break;
          case 'status':
            aVal = a.publicationStatus;
            bVal = b.publicationStatus;
            break;
          case 'chapters':
            aVal = a.Chapter?.filter(isRealChapter).length ?? 0;
            bVal = b.Chapter?.filter(isRealChapter).length ?? 0;
            break;
          case 'progress':
            aVal = calculateProgress(a);
            bVal = calculateProgress(b);
            break;
          case 'lastUpdated':
            aVal = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : 0);
            bVal = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : 0);
            break;
          default:
            return 0;
        }
        if (reverseSortDirection) {
          return aVal > bVal ? -1 : 1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }
    return filtered;
  }, [manga, searchedManga, searchQuery, searchField, enableRegexSearch, advancedFilters, filterBy, sortBy, tableSortBy, reverseSortDirection]);

  // Handle column sorting
  const handleSort = (field: string): void => {
    const reversed = field === tableSortBy ? !reverseSortDirection : false;
    setReverseSortDirection(reversed);
    setTableSortBy(field);
  };

  // Handle selection
  const handleSelect = (mangaId: string): void => {
    toggleItemSelection(mangaId);
  };
  const handleSelectAll = (): void => {
    if (selectedItems.length === displayedManga.length) {
      clearSelection();
    } else {
      selectAll(displayedManga.map(m => toStringId(m["id"])));
    }
  };

  // Inline actions
  const handleMarkAsRead = (_mangaId: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    notify({ severity: 'INFO', title: 'Mark as Read', message: 'This feature will be implemented with backend support' });
  };
  const handleDownload = (_mangaId: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    notify({ severity: 'INFO', title: 'Download', message: 'This feature will be implemented with backend support' });
  };
  // Helper to get cover URL with fallback chain
  const getCoverUrl = (manga: MangaEntity, mangaId?: number): string | undefined => {
    // Phase 1: coverUrl column dropped from Metadata.
    const raw = manga.Metadata?.coverLarge ??
           manga.Metadata?.coverMedium ??
           manga.Metadata?.cover ??
           undefined;
    if (!raw && mangaId !== undefined) return `/api/local-cover/${mangaId}`;
    return raw;
  };

  const rows = displayedManga.map(m => {
    const progress = calculateProgress(m);
    const latestChapter = getLatestChapterNumber(m);
    const downloadStatus = getDownloadStatus(m);
    const isSelected = selectedItems.includes(toStringId(m["id"]));
    const coverUrl = getCoverUrl(m, m["id"]);
    return <Table.Tr key={m["id"]} onClick={() => {
      if (selectionMode) {
        handleSelect(toStringId(m["id"]));
        return;
      }
      void navigateTo(`/manga/${m["id"]}`);
    }} style={{
      cursor: 'pointer'
    }} {...(isSelected && { bg: 'var(--mantine-color-dark-6)' })}>

        {selectionMode && (
          <Table.Td>
            <Checkbox checked={isSelected} onChange={() => { void handleSelect(toStringId(m["id"])); }} onClick={e => e.stopPropagation()} />
          </Table.Td>
        )}

        {showCovers && <Table.Td>
            <Avatar {...(coverUrl && { src: coverUrl })} alt={m["title"]} size="md" radius="sm" />

          </Table.Td>}
        
        <Table.Td>
          <Text fw={500}>{m["title"]}</Text>
          {m.Metadata?.authors && m.Metadata.authors.length > 0 && <Text size="xs" c="dimmed">{m.Metadata.authors.join(', ')}</Text>}
        </Table.Td>
        
        <Table.Td>
          <Badge color={m.Metadata?.status === MangaPublicationStatus.COMPLETED ? 'green' : 'blue'} variant="light">
            {m.Metadata?.status ?? 'Unknown'}
          </Badge>
        </Table.Td>
        
        <Table.Td>
          <Text size="sm">{m.Chapter?.filter(isRealChapter).length ?? 0}</Text>
          {latestChapter && <Text size="xs" c="dimmed">Latest: Ch. {latestChapter}</Text>}
        </Table.Td>
        
        {showProgress && <Table.Td>
            <Group gap="xs">
              <Progress value={progress} w={60} size="sm" />
              <Text size="xs">{progress}%</Text>
            </Group>
          </Table.Td>}
        
        <Table.Td>
          <Group gap="xs">
            <Text size="sm">{downloadStatus.downloaded}/{downloadStatus.total}</Text>
            {downloadStatus.hasErrors && <Badge color="red" size="xs">Error</Badge>}
          </Group>
        </Table.Td>
        
        <Table.Td>
          <Text size="xs" c="dimmed">
            {m.updatedAt instanceof Date ? m.updatedAt.toLocaleDateString() : (typeof m.updatedAt === 'string' ? new Date(m.updatedAt).toLocaleDateString() : 'N/A')}
          </Text>
        </Table.Td>
        
        <Table.Td>
          <Group gap="xs">
            <Tooltip label="Mark as Read">
              <ActionIcon variant="subtle" onClick={e => { void handleMarkAsRead(toStringId(m["id"]), e); }}>

                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
            
            <Tooltip label="Download All">
              <ActionIcon variant="subtle" onClick={e => { void handleDownload(toStringId(m["id"]), e); }}>

                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>
            
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" onClick={e => e.stopPropagation()}>

                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconEye size={16} />}>
                  View Details
                </Menu.Item>
                <Menu.Item leftSection={<IconBook size={16} />}>
                  Read
                </Menu.Item>
                <Menu.Item leftSection={<IconRefresh size={16} />}>
                  Update Metadata
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconTrash size={16} />} color="red">
                  Remove from Library
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Table.Td>
      </Table.Tr>;
  });
  return <Table.ScrollContainer minWidth={800}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {selectionMode && (
              <Table.Th w={40}>
                <Checkbox checked={selectedItems.length === displayedManga.length && displayedManga.length > 0} indeterminate={selectedItems.length > 0 && selectedItems.length < displayedManga.length} onChange={() => { void handleSelectAll(); }} />
              </Table.Th>
            )}
            
            {showCovers && <Table.Th w={60}>Cover</Table.Th>}
            
            <Table.Th>
              <Table.Th onClick={() => { void handleSort('title'); }} style={{
              cursor: 'pointer'
            }}>

                Title
              </Table.Th>
            </Table.Th>
            
            <Table.Th onClick={() => { void handleSort('status'); }} style={{
            cursor: 'pointer'
          }}>

              Status
            </Table.Th>
            
            <Table.Th onClick={() => { void handleSort('chapters'); }} style={{
            cursor: 'pointer'
          }}>

              Chapters
            </Table.Th>
            
            {showProgress && <Table.Th onClick={() => { void handleSort('progress'); }} style={{
            cursor: 'pointer'
          }}>

                Progress
              </Table.Th>}
            
            <Table.Th>Downloaded</Table.Th>
            
            <Table.Th onClick={() => { void handleSort('lastUpdated'); }} style={{
            cursor: 'pointer'
          }}>

              Last Updated
            </Table.Th>
            
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        
        <Table.Tbody>
          {rows.length > 0 ? rows : <Table.Tr>
              <Table.Td colSpan={(showCovers ? 8 : 7) + (selectionMode ? 1 : 0)} align="center" py="xl">
                <Text c="dimmed">No manga found matching your criteria</Text>
              </Table.Td>
            </Table.Tr>}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>;
}