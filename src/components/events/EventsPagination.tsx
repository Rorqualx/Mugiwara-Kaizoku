/**
 * Events Pagination Component
 *
 * Pagination controls for the events table with page size selection
 * and navigation buttons.
 *
 * @module components/events/EventsPagination
 */
import React, { useCallback } from 'react';

import { Group, Text, Select, Pagination, Paper, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

/**
 * Props for the EventsPagination component
 */
export interface EventsPaginationProps {
  /**
   * Current page number (1-indexed)
   */
  currentPage: number;

  /**
   * Total number of items
   */
  totalItems: number;

  /**
   * Number of items per page
   */
  pageSize: number;

  /**
   * Callback when page changes
   */
  onPageChange: (page: number) => void;

  /**
   * Callback when page size changes
   */
  onPageSizeChange: (pageSize: number) => void;

  /**
   * Available page size options
   * @default [25, 50, 100, 250]
   */
  pageSizeOptions?: number[];
}

/**
 * Calculate pagination info
 */
function getPaginationInfo(
  currentPage: number,
  pageSize: number,
  totalItems: number
): {
  startItem: number;
  endItem: number;
  totalPages: number;
} {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return {
    startItem: totalItems > 0 ? startItem : 0,
    endItem,
    totalPages
  };
}

/**
 * Events Pagination Component
 *
 * Provides pagination controls for navigating through large sets of events,
 * including page size selection and current position display.
 *
 * @param props - Component props
 * @returns EventsPagination component
 */
export function EventsPagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 250]
}: EventsPaginationProps): React.ReactElement {
  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Calculate pagination info
  const { startItem, endItem, totalPages } = getPaginationInfo(
    currentPage,
    pageSize,
    totalItems
  );

  /**
   * Handle page size change
   */
  const handlePageSizeChange = useCallback(
    (value: string | null) => {
      if (value) {
        const newPageSize = parseInt(value, 10);
        onPageSizeChange(newPageSize);

        // Reset to page 1 when changing page size
        if (currentPage > 1) {
          onPageChange(1);
        }
      }
    },
    [currentPage, onPageChange, onPageSizeChange]
  );

  // Convert page size options to select format
  const pageSizeSelectData = pageSizeOptions.map((size) => ({
    value: size.toString(),
    label: `${size} per page`
  }));

  // Don't render if no items
  if (totalItems === 0) {
    return <></>;
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        {/* Info and page size selector */}
        <Group justify="space-between" wrap={isMobile ? 'wrap' : 'nowrap'}>
          {/* Showing X-Y of Z */}
          <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            Showing{' '}
            <Text component="span" fw={600}>
              {startItem}-{endItem}
            </Text>{' '}
            of{' '}
            <Text component="span" fw={600}>
              {totalItems.toLocaleString()}
            </Text>{' '}
            events
          </Text>

          {/* Page size selector */}
          <Select
            size="sm"
            data={pageSizeSelectData}
            value={pageSize.toString()}
            onChange={handlePageSizeChange}
            style={{ width: isMobile ? '100%' : '150px' }}
            aria-label="Select page size"
          />
        </Group>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <Group justify="center">
            <Pagination
              value={currentPage}
              onChange={onPageChange}
              total={totalPages}
              siblings={isMobile ? 0 : 1}
              boundaries={isMobile ? 1 : 2}
              size={isMobile ? 'sm' : 'md'}
              withEdges={!isMobile}
            />
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
