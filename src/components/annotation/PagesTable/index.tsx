/**
 * Pages Table Component
 *
 * Displays annotated pages in a grouped, expandable table format.
 * Groups pages by wiki/series for easier navigation.
 */

import React, { useState, useMemo } from 'react';

import {
  Text,
  Group,
  Stack,
  Table,
  Alert,
  LoadingOverlay,
  Paper,
  UnstyledButton,
  Checkbox,
  Pagination,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
} from '@tabler/icons-react';

import { api } from '@/utils/api';

import { FilterBar } from './filter-bar';
import { groupPages } from './grouping';
import { GroupRow } from './row-components';

export type { PageListItem, PageGroup, TrainingDiscoveredUrl } from './types';

// ============================================================================
// Types
// ============================================================================

export interface PagesTableProps {
  searchQuery: string;
  sourceFilter: string | null;
  statusFilter: string | null;
  onSearchChange: (value: string) => void;
  onSourceFilterChange: (value: string | null) => void;
  onStatusFilterChange: (value: string | null) => void;
  sortBy?: 'recent' | 'default';
}

type SortField = 'createdAt' | 'mangaTitle' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

// ============================================================================
// Selection Helpers
// ============================================================================

function usePageSelection(allPageIds: string[]): {
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  toggleSelectAll: () => void;
  togglePageSelect: (pageId: string) => void;
  toggleGroupSelect: (groupPageIds: string[]) => void;
  clearSelection: () => void;
} {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = allPageIds.length > 0 && allPageIds.every(id => selectedIds.has(id));
  const someSelected = allPageIds.some(id => selectedIds.has(id));

  const toggleSelectAll = (): void => {
    setSelectedIds(allSelected ? new Set() : new Set(allPageIds));
  };

  const togglePageSelect = (pageId: string): void => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) { next.delete(pageId); } else { next.add(pageId); }
      return next;
    });
  };

  const toggleGroupSelect = (groupPageIds: string[]): void => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allGroupSelected = groupPageIds.every(id => prev.has(id));
      for (const id of groupPageIds) {
        if (allGroupSelected) { next.delete(id); } else { next.add(id); }
      }
      return next;
    });
  };

  const clearSelection = (): void => { setSelectedIds(new Set()); };

  return { selectedIds, allSelected, someSelected, toggleSelectAll, togglePageSelect, toggleGroupSelect, clearSelection };
}

// ============================================================================
// Main Component
// ============================================================================

export function PagesTable({
  searchQuery,
  sourceFilter,
  statusFilter,
  onSearchChange,
  onSourceFilterChange,
  onStatusFilterChange,
}: PagesTableProps): React.ReactElement {
  const utils = api.useUtils();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [refetchHtml, setRefetchHtml] = useState(false);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState(1);

  const offset = (currentPage - 1) * pageSize;

  const { data, isLoading, isError, error } = api.annotation.getPages.useQuery({
    limit: pageSize,
    offset,
    search: searchQuery ? searchQuery : undefined,
    sourceType: (sourceFilter ?? undefined) as 'FANDOM' | 'WIKIPEDIA' | 'ANILIST' | 'COMICVINE' | undefined,
    status: (statusFilter ?? undefined) as 'BOOTSTRAP' | 'AGENT_REVIEWED' | 'IN_PROGRESS' | 'REVIEWED' | 'GOLD' | 'REJECTED' | undefined,
    sortBy: sortField,
    sortOrder,
  });

  const totalPages = data?.total ? Math.ceil(data.total / pageSize) : 0;

  const groups = useMemo(
    () => groupPages(data?.pages ?? [], sortField, sortOrder),
    [data?.pages, sortField, sortOrder]
  );

  const allPageIds = useMemo(() => {
    const ids: string[] = [];
    for (const group of groups) {
      for (const page of group.pages) { ids.push(page.id); }
    }
    return ids;
  }, [groups]);

  const selection = usePageSelection(allPageIds);

  const deleteMutation = api.annotation.delete.useMutation({
    onSuccess: () => { void utils.annotation.getPages.invalidate(); void utils.annotation.getStats.invalidate(); },
  });

  const bulkReprocessMutation = api.annotation.bulkReprocess.useMutation({
    onSuccess: () => { void utils.annotation.getPages.invalidate(); void utils.annotation.getStats.invalidate(); selection.clearSelection(); },
  });

  const bulkDeleteMutation = api.annotation.bulkDelete.useMutation({
    onSuccess: () => { void utils.annotation.getPages.invalidate(); void utils.annotation.getStats.invalidate(); selection.clearSelection(); },
  });

  const handleSort = (field: SortField): void => {
    if (sortField === field) { setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortOrder('desc'); }
  };

  const getSortIcon = (field: SortField): React.ReactNode => {
    if (sortField !== field) return <IconArrowsSort size={14} style={{ opacity: 0.3 }} />;
    return sortOrder === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };

  const handlePageSizeChange = (value: string | null): void => {
    if (value) { setPageSize(parseInt(value, 10)); setCurrentPage(1); }
  };

  const handleSearchChange = (value: string): void => { onSearchChange(value); setCurrentPage(1); };
  const handleSourceFilterChange = (value: string | null): void => { onSourceFilterChange(value); setCurrentPage(1); };
  const handleStatusFilterChange = (value: string | null): void => { onStatusFilterChange(value); setCurrentPage(1); };

  const toggleGroup = (key: string): void => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const handleBulkDelete = (): void => {
    modals.openConfirmModal({
      title: 'Delete Selected Pages',
      children: (
        <Text size="sm">
          Are you sure you want to delete {selection.selectedIds.size} page{selection.selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => { bulkDeleteMutation.mutate({ pageIds: Array.from(selection.selectedIds) }); },
    });
  };

  return (
    <Stack>
      {isError && (
        <Alert color="red" variant="light">
          <Text size="sm">Failed to load pages: {error.message}</Text>
        </Alert>
      )}

      <FilterBar
        searchQuery={searchQuery}
        sourceFilter={sourceFilter}
        statusFilter={statusFilter}
        pageSize={pageSize}
        onSearchChange={handleSearchChange}
        onSourceFilterChange={handleSourceFilterChange}
        onStatusFilterChange={handleStatusFilterChange}
        onPageSizeChange={handlePageSizeChange}
        selectedCount={selection.selectedIds.size}
        refetchHtml={refetchHtml}
        onRefetchHtmlChange={setRefetchHtml}
        onBulkReprocess={() => bulkReprocessMutation.mutate({ pageIds: Array.from(selection.selectedIds), refetch: refetchHtml })}
        onBulkDelete={handleBulkDelete}
        onClearSelection={selection.clearSelection}
        isReprocessing={bulkReprocessMutation.isPending}
        isDeleting={bulkDeleteMutation.isPending}
      />

      <Paper withBorder pos="relative" style={{ overflow: 'auto' }}>
        {isLoading && <LoadingOverlay visible />}
        <Table highlightOnHover key={`table-${groups.length}`} style={{ tableLayout: 'fixed', width: '100%' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>
                <Checkbox
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected && !selection.allSelected}
                  onChange={selection.toggleSelectAll}
                  aria-label="Select all pages"
                />
              </Table.Th>
              <Table.Th>
                <UnstyledButton onClick={() => handleSort('mangaTitle')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  Title / URL {getSortIcon('mangaTitle')}
                </UnstyledButton>
              </Table.Th>
              <Table.Th style={{ width: 90 }}>Source</Table.Th>
              <Table.Th style={{ width: 100 }}>Status</Table.Th>
              <Table.Th style={{ width: 70, textAlign: 'right' }}>Tokens</Table.Th>
              <Table.Th style={{ width: 90 }}>
                <UnstyledButton onClick={() => handleSort('createdAt')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  Created {getSortIcon('createdAt')}
                </UnstyledButton>
              </Table.Th>
              <Table.Th style={{ width: 90 }}>CV ID</Table.Th>
              <Table.Th style={{ width: 120 }}>Discovered</Table.Th>
              <Table.Th style={{ width: 70 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {groups.length === 0 && !isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text ta="center" c="dimmed" py="xl">
                    No annotated pages yet. Add pages to start building training data.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              groups.map((group) => (
                <GroupRow
                  key={group.key}
                  group={group}
                  isExpanded={expandedGroups.has(group.key)}
                  onToggle={() => toggleGroup(group.key)}
                  onDelete={(id) => deleteMutation.mutate({ id })}
                  isDeleting={deleteMutation.isPending}
                  selectedIds={selection.selectedIds}
                  onToggleGroupSelect={() => selection.toggleGroupSelect(group.pages.map(p => p.id))}
                  onTogglePageSelect={selection.togglePageSelect}
                />
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Pagination */}
      {totalPages > 0 && (
        <Paper withBorder p="md">
          <Stack gap="sm">
            {totalPages > 1 && (
              <Group justify="center">
                <Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} siblings={1} boundaries={2} withEdges />
              </Group>
            )}
            <Text size="sm" c="dimmed" ta="center">
              Showing <Text component="span" fw={600}>{offset + 1}-{Math.min(offset + pageSize, data?.total ?? 0)}</Text> of{' '}
              <Text component="span" fw={600}>{(data?.total ?? 0).toLocaleString()}</Text> pages
            </Text>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
