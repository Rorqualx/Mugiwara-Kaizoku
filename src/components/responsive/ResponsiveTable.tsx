/**
 * Responsive Table Component
 * 
 * An enhanced table component that adapts to mobile screens with:
 * - Horizontal scrolling on small screens
 * - Collapsible columns
 * - Mobile-friendly row layouts
 * - Touch-optimized interactions
 */

import React, { useState } from 'react';

import {
  Table,
  ScrollArea,
  Box,
  ActionIcon,
  Group,
  Text,
  UnstyledButton,
  Collapse,
  Stack } from
'@mantine/core';
import { IconArrowNarrowDown, IconArrowNarrowUp, IconChevronDown, IconChevronRight, IconSelector } from '@tabler/icons-react';

import { useBreakpoint } from '@/hooks/mobile';

import type {
  TableProps} from '@mantine/core';

export type SortDirection = 'asc' | 'desc';

export interface TableSortState {
  key: string;
  direction: SortDirection;
}

interface ResponsiveColumn<T> {
  /** Column identifier */
  accessor: keyof T | string;
  /** Column header title */
  title: string;
  /** Custom render function */
  render?: (record: T) => React.ReactNode;
  /** Whether to hide on mobile */
  hideOnMobile?: boolean;
  /** Whether to show in mobile card view */
  showInCard?: boolean;
  /** Priority for mobile display (lower = higher priority) */
  mobilePriority?: number;
  /** Minimum width for the column */
  minWidth?: number;
  /** Whether the column header is clickable to toggle sort */
  sortable?: boolean;
  /** Key passed to onSort; defaults to String(accessor) when omitted */
  sortKey?: string;
}

interface ResponsiveTableProps<T extends Record<string, unknown>> extends Omit<TableProps, 'children'> {
  /** Data records to display */
  records: T[];
  /** Column definitions */
  columns: ResponsiveColumn<T>[];
  /** Unique key for each record */
  idAccessor?: keyof T | ((record: T) => string | number);
  /** Whether to use card layout on mobile */
  mobileCardView?: boolean;
  /** Mobile card render function (overrides default) */
  mobileCardRender?: (record: T) => React.ReactNode;
  /** Whether to enable row expansion on mobile */
  mobileExpandable?: boolean;
  /** Callback when row is clicked */
  onRowClick?: (record: T) => void;
  /** Whether to show column headers on mobile */
  showMobileHeaders?: boolean;
  /** Minimum table width (for horizontal scroll) */
  minTableWidth?: number;
  /** Active sort state; null when no column is sorted */
  sortState?: TableSortState | null;
  /** Fired when a sortable column header is clicked */
  onSort?: (key: string) => void;
}

export function ResponsiveTable<T extends Record<string, unknown>>({
  records,
  columns,
  idAccessor = 'id',
  mobileCardView = true,
  mobileCardRender,
  mobileExpandable = true,
  onRowClick,
  showMobileHeaders: _showMobileHeaders = false,
  minTableWidth = 800,
  sortState,
  onSort,
  ...tableProps
}: ResponsiveTableProps<T>): React.ReactElement {
  const { isMobile, isTablet } = useBreakpoint();
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

  // Get record ID
  const getRecordId = (record: T): string | number => {
    if (typeof idAccessor === 'function') {
      return idAccessor(record);
    }
    const value = record[idAccessor];
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return String(value);
  };

  // Toggle row expansion
  const toggleRowExpansion = (id: string | number): void => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Filter and sort columns for mobile
  const mobileColumns = React.useMemo(() => {
    return columns.
    filter((col) => !col.hideOnMobile).
    sort((a, b) => (a.mobilePriority ?? 999) - (b.mobilePriority ?? 999));
  }, [columns]);

  // Mobile card view
  if (isMobile && mobileCardView) {
    return (
      <Stack gap="xs">
        {records.map((record) => {
          const id = getRecordId(record);
          const isExpanded = expandedRows.has(id);

          if (mobileCardRender) {
            return (
              <Box key={id} onClick={() => onRowClick?.(record)}>
                {mobileCardRender(record)}
              </Box>);

          }

          return (
            <Box
              key={id}
              p="sm"
              style={{
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderRadius: 'var(--mantine-radius-sm)',
                cursor: onRowClick ?? mobileExpandable ? 'pointer' : 'default'
              }}
              onClick={() => {
                if (onRowClick) {
                  onRowClick(record);
                } else if (mobileExpandable) {
                  toggleRowExpansion(id);
                }
              }}>

              {/* Primary columns always visible */}
              <Stack gap="xs">
                {mobileColumns.
                filter((col) => col.showInCard !== false).
                slice(0, 3).
                map((column) =>
                <Group key={String(column.accessor)} justify="space-between">
                      <Text size="sm" c="dimmed">{column["title"]}:</Text>
                      <Text size="sm">
                        {column.render ?
                    column.render(record) :
                    String(record[column.accessor] ?? '')}
                      </Text>
                    </Group>
                )}
              </Stack>

              {/* Expandable section */}
              {mobileExpandable && mobileColumns.length > 3 &&
              <>
                  <Group justify="center" mt="xs">
                    <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRowExpansion(id);
                    }}>

                      {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    </ActionIcon>
                  </Group>

                  <Collapse in={isExpanded}>
                    <Stack gap="xs" mt="sm">
                      {mobileColumns.
                    slice(3).
                    map((column) =>
                    <Group key={String(column.accessor)} justify="space-between">
                            <Text size="sm" c="dimmed">{column["title"]}:</Text>
                            <Text size="sm">
                              {column.render ?
                        column.render(record) :
                        String(record[column.accessor] ?? '')}
                            </Text>
                          </Group>
                    )}
                    </Stack>
                  </Collapse>
                </>
              }
            </Box>);

        })}
      </Stack>);

  }

  // Regular table view with horizontal scroll
  const visibleColumns = isMobile ?
  columns.filter((col) => !col.hideOnMobile) :
  columns;

  return (
    <ScrollArea type="auto">
      <Box style={{ minWidth: isMobile || isTablet ? minTableWidth : 'auto' }}>
        <Table {...tableProps}>
          <Table.Thead>
            <Table.Tr>
              {visibleColumns.map((column) => {
                const sortKey = column.sortKey ?? String(column.accessor);
                const isSortable = column.sortable === true && onSort !== undefined;
                const activeDirection = isSortable && sortState?.key === sortKey ? sortState.direction : null;
                const SortIcon = activeDirection === 'asc'
                  ? IconArrowNarrowUp
                  : activeDirection === 'desc'
                    ? IconArrowNarrowDown
                    : IconSelector;
                return (
                  <Table.Th
                    key={String(column.accessor)}
                    style={{ minWidth: column.minWidth }}>
                    {isSortable ? (
                      <UnstyledButton
                        onClick={() => onSort(sortKey)}
                        style={{ width: '100%', cursor: 'pointer' }}>
                        <Group gap={4} justify="space-between">
                          <Text fw={600} size="sm">{column["title"]}</Text>
                          <SortIcon size={14} opacity={activeDirection !== null ? 1 : 0.4} />
                        </Group>
                      </UnstyledButton>
                    ) : (
                      column["title"]
                    )}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {records.map((record) => {
              const id = getRecordId(record);

              return (
                <Table.Tr
                  key={id}
                  onClick={() => onRowClick?.(record)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}>

                  {visibleColumns.map((column) =>
                  <Table.Td key={String(column.accessor)}>
                      {column.render ?
                    column.render(record) :
                    String(record[column.accessor] ?? '')}
                    </Table.Td>
                  )}
                </Table.Tr>);

            })}
          </Table.Tbody>
        </Table>
      </Box>
    </ScrollArea>);

}