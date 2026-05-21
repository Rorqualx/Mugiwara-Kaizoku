/**
 * Missing Chapters Table Component
 *
 * Displays all monitored missing chapters in a detailed, searchable table.
 * Replaces the card-based view with comprehensive chapter-level information.
 *
 * Features:
 * - Individual chapter rows with full database fields
 * - Search by manga title, chapter title, or chapter number
 * - Filters for status, date range, and more
 * - Bulk selection and actions
 * - "Search Now" button to trigger auto-download
 * - Sorting by any column
 * - Pagination for large datasets
 */

import React, { useState, useMemo } from 'react';

import {
  Table,
  Text,
  Badge,
  Group,
  Stack,
  Paper,
  Avatar,
  Pagination,
  Checkbox,
  Tooltip,
  ActionIcon
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconDownload } from '@tabler/icons-react';

import type { MissingItem } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { trpc } from '@/utils/trpc-client';

import { sortItems, type SortField, type SortDirection } from './missing-chapters-table/sorting-helpers';
import { TableActionBar } from './missing-chapters-table/TableActionBar';
import { TableHeader } from './missing-chapters-table/TableHeader';

interface MissingChaptersTableProps {
  items: MissingItem[];
  page: number;
  pageSize: number;
  total: number;
  totalMangaAffected: number;
  onPageChange: (page: number) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function MissingChaptersTable({
  items,
  page,
  pageSize,
  total,
  totalMangaAffected,
  onPageChange,
  onRefresh,
  isLoading
}: MissingChaptersTableProps): React.ReactElement {
  // State (filter/sort act over the current page only — server pagination)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('mangaTitle');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // Mutations
  const searchChaptersMutation = trpc.wanted.searchChapters.useMutation({
    onSuccess: (data) => {
      showNotification({
        title: 'Search Triggered',
        message: `Auto-download started for ${data.triggered} manga`,
        color: 'green'
      });
      setSelectedIds(new Set()); // Clear selection after search
      onRefresh?.();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: error.message || 'Failed to trigger search',
        color: 'red'
      });
    }
  });

  // Filtering and sorting
  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...items];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.mangaTitle.toLowerCase().includes(term) ||
          item.chapterTitle?.toLowerCase().includes(term) ||
          item.chapterNumber.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(item =>
        item.downloadStatus && statusFilter.includes(item.downloadStatus)
      );
    }

    // Sorting (using extracted helper)
    return sortItems(filtered, sortField, sortDirection);
  }, [items, searchTerm, statusFilter, sortField, sortDirection]);

  // Server pagination — `items` is already the current page; we just filter/sort it.
  const paginatedItems = filteredAndSortedItems;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Selection handlers
  const handleSelectAll = (): void => {
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map(item => item.chapterId)));
    }
  };

  const handleSelectRow = (chapterId: string): void => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(chapterId)) {
      newSelection.delete(chapterId);
    } else {
      newSelection.add(chapterId);
    }
    setSelectedIds(newSelection);
  };

  // Search handler
  const handleSearchNow = async (chapterIds?: string[]): Promise<void> => {
    const idsToSearch = chapterIds ?? Array.from(selectedIds);

    if (idsToSearch.length === 0) {
      showNotification({
        title: 'No Chapters Selected',
        message: 'Please select chapters to search',
        color: 'yellow'
      });
      return;
    }

    await searchChaptersMutation.mutateAsync({
      chapterIds: idsToSearch.map(id => toNumberId(id))
    });
  };

  // Sort handler
  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get unique statuses for filter
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(items.map(item => item.downloadStatus).filter(Boolean));
    return Array.from(statuses).map(status => ({ value: status as string, label: status as string }));
  }, [items]);

  return (
    <Stack gap="md">
      {/* Action Bar */}
      <TableActionBar
        filteredCount={total}
        mangaCount={totalMangaAffected}
        selectedCount={selectedIds.size}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        uniqueStatuses={uniqueStatuses}
        isLoading={isLoading}
        isSearching={searchChaptersMutation.isPending}
        onRefresh={onRefresh}
        onSearchChange={setSearchTerm}
        onStatusFilterChange={setStatusFilter}
        onSearchNow={() => { void handleSearchNow(); }}
      />

      {/* Table */}
      <Paper withBorder>
        <Table.ScrollContainer minWidth={1200}>
          <Table striped highlightOnHover>
            <TableHeader
              isAllSelected={selectedIds.size === paginatedItems.length && paginatedItems.length > 0}
              isIndeterminate={selectedIds.size > 0 && selectedIds.size < paginatedItems.length}
              sortField={sortField}
              sortDirection={sortDirection}
              onSelectAll={() => { void handleSelectAll(); }}
              onSort={(field) => { void handleSort(field); }}
            />
            <Table.Tbody>
              {paginatedItems.map(item => (
                <Table.Tr key={item.chapterId}>
                  <Table.Td>
                    <Checkbox
                      checked={selectedIds.has(item.chapterId)}
                      onChange={() => { void handleSelectRow(item.chapterId); }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Avatar
                      {...(item.coverImage && { src: item.coverImage })}
                      alt={item.mangaTitle}
                      size="sm"
                      radius="sm"
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2}>{item.mangaTitle}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{item.chapterNumber}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {item.chapterTitle ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{item.volumeNumber ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">
                      {item.releaseDate
                        ? new Date(item.releaseDate).toLocaleDateString()
                        : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{item.pageCount ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="sm"
                      variant="light"
                      color={item.downloadStatus === 'PENDING' ? 'yellow' : 'gray'}
                    >
                      {item.downloadStatus ?? 'UNKNOWN'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Search for this chapter now">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="sm"
                        onClick={() => { void handleSearchNow([item.chapterId]); }}
                        loading={searchChaptersMutation.isPending}
                      >
                        <IconDownload size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination
              value={page}
              onChange={onPageChange}
              total={totalPages}
              size="sm"
            />
            <Text size="xs" c="dimmed">
              Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} of {total}
            </Text>
          </Group>
        )}
      </Paper>
    </Stack>
  );
}
