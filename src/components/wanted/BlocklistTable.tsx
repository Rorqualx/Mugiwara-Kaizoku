/**
 * BlocklistTable component for displaying and managing blocked releases
 *
 * This component provides a comprehensive table view for the release blocklist
 * with search, filtering, sorting, and bulk operations.
 *
 * Features:
 * - Sortable columns (title, reason, date, manga, group)
 * - Search by release title, group, or details
 * - Reason filtering with MultiSelect
 * - Status filtering (active/inactive)
 * - Bulk selection and removal
 * - Pagination support (50 items per page)
 * - Detailed reason badges with colors
 * - Expiry date tracking
 * - Auto-blocked indicator
 *
 * @module components/wanted/BlocklistTable
 */

import React, { useState, useMemo } from "react";

import {
  Table,
  Text,
  Badge,
  Group,
  Stack,
  TextInput,
  Button,
  ActionIcon,
  Pagination,
  Paper,
  Checkbox,
  MultiSelect,
  Tooltip,
  Box,
  Alert
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { ReleaseBlocklistReason } from '@prisma/client';
import {
  IconSearch,
  IconX,
  IconRefresh,
  IconAlertCircle,
  IconClock,
  IconCpu
} from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client/index';


import {
  formatReason,
  getReasonColor,
  filterBlocklistItems,
  sortBlocklistItems,
  getReasonOptions,
  SortField,
  SortDirection
} from './blocklist-utils';

/**
 * Blocklist entry interface matching Prisma model
 */
export interface BlocklistEntry {
  id: string;
  hash: string | null;
  title: string | null;
  pattern: string | null;
  group: string | null;
  reason: ReleaseBlocklistReason;
  details: string | null;
  isActive: boolean;
  autoBlocked: boolean;
  expiryDate: Date | null;
  dateAdded: Date;
  mangaId: number | null;
  manga?: {
    title: string;
  } | null;
}

/**
 * Props for BlocklistTable component
 */
export interface BlocklistTableProps {
  /** Current page entries (server-paginated) */
  items: BlocklistEntry[];
  /** Current 1-based page index */
  page: number;
  /** Page size used by the parent query */
  pageSize: number;
  /** Total entry count across all pages */
  total: number;
  /** Page-change callback */
  onPageChange: (page: number) => void;
  /** Callback for refresh action */
  onRefresh: () => void;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * BlocklistTable component
 */
export function BlocklistTable({
  items,
  page,
  pageSize,
  total,
  onPageChange,
  onRefresh,
  isLoading
}: BlocklistTableProps): React.ReactElement {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('dateAdded');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [reasonFilter, setReasonFilter] = useState<ReleaseBlocklistReason[]>([]);
  const [showInactive, setShowInactive] = useState(false);

  // Remove mutation — call sites handle notifications/refresh so bulk removes
  // emit a single summary instead of N "Success" toasts.
  const removeMutation = trpc.releaseBlocklist.remove.useMutation();

  // Filter, sort, and paginate items using utility functions
  const processedItems = useMemo(() => {
    const filtered = filterBlocklistItems(items, {
      searchTerm,
      reasonFilter,
      showInactive
    });
    
    return sortBlocklistItems(filtered, sortField, sortDirection);
  }, [items, searchTerm, reasonFilter, showInactive, sortField, sortDirection]);

  // Server pagination — `processedItems` is already the current page after
  // local filter/sort. Total pages come from the parent's server-side total.
  const paginatedItems = processedItems;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Handle sort
  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle selection
  const toggleSelection = (id: string): void => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
  };

  const toggleSelectAll = (): void => {
    if (selectedItems.size === paginatedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(paginatedItems.map(item => item.id)));
    }
  };

  // Handle bulk remove — allSettled so one failure doesn't abort the rest;
  // collapse into a single summary notification.
  const handleBulkRemove = async (): Promise<void> => {
    const ids = Array.from(selectedItems);
    const results = await Promise.allSettled(
      ids.map((id) => removeMutation.mutateAsync({ id }))
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;

    if (failed === 0) {
      showNotification({
        title: 'Removed',
        message: `Removed ${succeeded} blocklist entr${succeeded === 1 ? 'y' : 'ies'}`,
        color: 'green'
      });
    } else {
      showNotification({
        title: succeeded > 0 ? 'Partial removal' : 'Removal failed',
        message: `Removed ${succeeded} of ${results.length}; ${failed} failed`,
        color: succeeded > 0 ? 'yellow' : 'red'
      });
    }

    setSelectedItems(new Set());
    onRefresh();
  };

  // Single-row remove with its own notification.
  const handleSingleRemove = async (id: string): Promise<void> => {
    try {
      await removeMutation.mutateAsync({ id });
      showNotification({
        title: 'Removed',
        message: 'Blocklist entry removed',
        color: 'green'
      });
      onRefresh();
    } catch (error) {
      showNotification({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to remove entry',
        color: 'red'
      });
    }
  };

  // Get reason options for filter
  const reasonOptions = getReasonOptions();

  return (
    <Stack gap="md">
      {/* Action Bar */}
      <Paper p="md" withBorder>
        <Stack gap="md">
          {/* Search and Actions Row */}
          <Group justify="space-between">
            <Group>
              <TextInput
                placeholder="Search releases, groups, or details..."
                leftSection={<IconSearch size={16} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                style={{ width: 350 }}
              />

              <MultiSelect
                placeholder="Filter by reason"
                data={reasonOptions}
                value={reasonFilter}
                onChange={(value) => setReasonFilter(value as ReleaseBlocklistReason[])}
                clearable
                searchable
                style={{ width: 250 }}
              />

              <Checkbox
                label="Show inactive"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.currentTarget.checked)}
              />
            </Group>

            <Group>
              {selectedItems.size > 0 && (
                <Button
                  variant="filled"
                  color="red"
                  leftSection={<IconX size={16} />}
                  onClick={() => { void handleBulkRemove(); }}
                  loading={removeMutation.isPending}
                >
                  Remove ({selectedItems.size})
                </Button>
              )}
              <Tooltip label="Refresh blocklist">
                <ActionIcon
                  variant="light"
                  size="lg"
                  onClick={() => { void onRefresh(); }}
                  {...(isLoading && { loading: isLoading })}
                >
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {/* Statistics Row */}
          <Group gap="md">
            <Badge variant="light" size="lg">
              {processedItems.length} Total
            </Badge>
            <Badge variant="light" size="lg" color="blue">
              {processedItems.filter(item => item.isActive).length} Active
            </Badge>
            <Badge variant="light" size="lg" color="gray">
              {processedItems.filter(item => !item.isActive).length} Inactive
            </Badge>
            <Badge variant="light" size="lg" color="teal">
              {processedItems.filter(item => item.autoBlocked).length} Auto-Blocked
            </Badge>
          </Group>
        </Stack>
      </Paper>

      {/* Table - Always visible */}
      <Paper withBorder style={{ overflow: 'auto' }}>
        {paginatedItems.length === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} color="blue" mb="md">
            No blocklist entries found matching your filters
          </Alert>
        )}
        <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 40 }}>
                  <Checkbox
                    checked={selectedItems.size === paginatedItems.length && paginatedItems.length > 0}
                    indeterminate={selectedItems.size > 0 && selectedItems.size < paginatedItems.length}
                    onChange={() => { void toggleSelectAll(); }}
                  />
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => { void handleSort('title'); }}>
                  Release Title {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => { void handleSort('mangaTitle'); }}>
                  Manga {sortField === 'mangaTitle' && (sortDirection === 'asc' ? '↑' : '↓')}
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => { void handleSort('reason'); }}>
                  Reason {sortField === 'reason' && (sortDirection === 'asc' ? '↑' : '↓')}
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => { void handleSort('group'); }}>
                  Group {sortField === 'group' && (sortDirection === 'asc' ? '↑' : '↓')}
                </Table.Th>
                <Table.Th>Details</Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => { void handleSort('dateAdded'); }}>
                  Date Added {sortField === 'dateAdded' && (sortDirection === 'asc' ? '↑' : '↓')}
                </Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedItems.map((item) => (
                <BlocklistRow
                  key={item.id}
                  item={item}
                  isSelected={selectedItems.has(item.id)}
                  onToggleSelect={toggleSelection}
                  onRemove={handleSingleRemove}
                  isRemoving={removeMutation.isPending}
                />
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

      {/* Pagination */}
      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            value={page}
            onChange={onPageChange}
            total={totalPages}
            siblings={1}
            boundaries={1}
          />
          <Text size="xs" c="dimmed">
            Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} of {total}
          </Text>
        </Group>
      )}
    </Stack>
  );
}

interface BlocklistRowProps {
  item: BlocklistEntry;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => Promise<void>;
  isRemoving: boolean;
}

function BlocklistRow({ item, isSelected, onToggleSelect, onRemove, isRemoving }: BlocklistRowProps): React.ReactElement {
  return (
    <Table.Tr>
      <Table.Td>
        <Checkbox checked={isSelected} onChange={() => { onToggleSelect(item.id); }} />
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500} lineClamp={2}>{item.title ?? '-'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">{item.manga?.title ?? '-'}</Text>
      </Table.Td>
      <Table.Td>
        <Badge color={getReasonColor(item.reason)} variant="light" size="sm">
          {formatReason(item.reason)}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{item.group ?? '-'}</Text>
      </Table.Td>
      <Table.Td>
        <Tooltip label={item.details ?? 'No details'}>
          <Text size="sm" lineClamp={1} c="dimmed">{item.details ?? '-'}</Text>
        </Tooltip>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Text size="sm" c="dimmed">{new Date(item.dateAdded).toLocaleDateString()}</Text>
          {item.expiryDate && (
            <Tooltip label={`Expires: ${new Date(item.expiryDate).toLocaleDateString()}`}>
              <IconClock size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
            </Tooltip>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Badge color={item.isActive ? 'green' : 'gray'} variant="dot" size="sm">
            {item.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {item.autoBlocked && (
            <Tooltip label="Automatically blocked">
              <Box>
                <IconCpu size={14} style={{ color: 'var(--mantine-color-teal-filled)' }} />
              </Box>
            </Tooltip>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        <Tooltip label="Remove from blocklist">
          <ActionIcon
            color="red"
            variant="light"
            size="sm"
            onClick={() => { void onRemove(item.id); }}
            loading={isRemoving}
          >
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  );
}
