/**
 * Events Dashboard Component
 *
 * Comprehensive dashboard for monitoring and filtering system events with
 * advanced filtering, search, pagination, and export capabilities.
 *
 * @module components/events/EventsDashboard
 */
import React, { useState, useCallback, useMemo } from 'react';

import {
  Box,
  Title,
  Text,
  Stack
} from '@mantine/core';
import { useMediaQuery, useLocalStorage } from '@mantine/hooks';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import type { SystemEvent } from '@/hooks/useSystemEvents';
import { useSystemEvents } from '@/hooks/useSystemEvents';
import { EventLevel } from '@/server/services/events/eventTypes';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import { EventControlBar } from './EventControlBar';
import { EventDetailsModal } from './EventDetailsModal';
import { EventsPagination } from './EventsPagination';
import { EventsTable } from './EventsTable';
import { EventStatisticsCards } from './EventStatisticsCards';

import type { EventFilters } from './EventFiltersPanel';

/**
 * Default filters - show all events
 */
const DEFAULT_FILTERS: EventFilters = {
  levels: [],
  sources: [],
  types: [],
  dateRange: {},
  search: ''
};

/**
 * Events Dashboard Component
 *
 * Main dashboard for viewing and filtering system events with comprehensive
 * analytics and export capabilities.
 *
 * @returns EventsDashboard component
 */
export function EventsDashboard(): React.ReactElement {
  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Filter state with localStorage persistence
  const [filters, setFilters] = useLocalStorage<EventFilters>({
    key: 'system-events-filters',
    defaultValue: DEFAULT_FILTERS
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState('30000');

  // Selected event for details modal
  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);

  // Build events query options from filters
  const eventsOptions = useMemo<Parameters<typeof useSystemEvents>[0]>(() => ({
    page: currentPage,
    pageSize,
    pollingInterval: autoRefreshEnabled ? parseInt(refreshInterval, 10) : 0,
    ...(filters.levels.length > 0 && { levels: filters.levels }),
    ...(filters.sources.length > 0 && { sources: filters.sources }),
    ...(filters.types.length > 0 && { types: filters.types }),
    ...(filters.dateRange.start && { startDate: filters.dateRange.start }),
    ...(filters.dateRange.end && { endDate: filters.dateRange.end }),
    ...(filters.search && { search: filters.search })
  }), [currentPage, pageSize, autoRefreshEnabled, refreshInterval, filters]);

  const { events, isLoading, total, availableFilters, refetch } =
    useSystemEvents(eventsOptions);

  /**
   * Calculate active filter count
   */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.levels.length > 0) count++;
    if (filters.sources.length > 0) count++;
    if (filters.types.length > 0) count++;
    if (filters.dateRange.start ?? filters.dateRange.end) count++;
    if (filters.search) count++;
    return count;
  }, [filters]);

  /**
   * Calculate event statistics
   */
  const eventStats = useMemo(() => {
    const errorCount = events.filter(
      (e) =>
        e.level === EventLevel.ERROR || e.level === EventLevel.CRITICAL
    ).length;
    const warningCount = events.filter(
      (e) => e.level === EventLevel.WARNING
    ).length;
    const infoCount = events.filter((e) => e.level === EventLevel.INFO).length;

    return {
      total,
      error: errorCount,
      warning: warningCount,
      info: infoCount
    };
  }, [events, total]);

  /**
   * Handle filter changes
   */
  const handleFiltersChange = useCallback((newFilters: EventFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [setFilters]);

  /**
   * Handle search change
   */
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newSearch = event.currentTarget.value;
      setFilters((prev) => ({
        ...prev,
        search: newSearch
      }));
      setCurrentPage(1); // Reset to page 1 when search changes
    },
    [setFilters]
  );

  /**
   * Handle page change
   */
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  /**
   * Handle page size change
   */
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to page 1 when page size changes
  }, []);

  /**
   * Handle event click (open details modal)
   */
  const handleEventClick = useCallback((event: SystemEvent) => {
    setSelectedEvent(event);
  }, []);

  /**
   * Handle modal close
   */
  const handleModalClose = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  /**
   * Handle manual refresh
   */
  const handleManualRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  /**
   * Handle auto-refresh toggle
   */
  const handleAutoRefreshToggle = useCallback(
    (checked: boolean) => {
      setAutoRefreshEnabled(checked);
    },
    []
  );

  /**
   * Handle auto-refresh interval change
   */
  const handleRefreshIntervalChange = useCallback(
    (value: string | null) => {
      if (value) {
        setRefreshInterval(value);
      }
    },
    []
  );


  /**
   * Export events
   */
  const exportMutation = trpc.events.exportEvents.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        logger.info('Events exported successfully', {
          filePath: data.filePath
        });
      }
    },
    onError: (error) => {
      logger.error('Failed to export events', { error });
    }
  });

  const handleExport = useCallback(
    async (format: 'json' | 'csv') => {
      await exportMutation.mutateAsync({
        format,
        filters: {
          levels: filters.levels,
          sources: filters.sources,
          types: filters.types,
          startDate: filters.dateRange.start,
          endDate: filters.dateRange.end
        }
      });
    },
    [exportMutation, filters]
  );

  return (
    <ErrorBoundary>
      <Box>
        <Stack gap="lg">
          {/* Header */}
          <div>
            <Title order={2}>Event Monitor</Title>
            <Text size="sm" c="dimmed">
              Monitor API calls, downloads, metadata updates, and manga events
            </Text>
          </div>

          {/* Statistics Cards */}
          <EventStatisticsCards stats={eventStats} />

          {/* Filter and Control Bar */}
          <EventControlBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onSearchChange={handleSearchChange}
            onRefresh={() => {
              void handleManualRefresh();
            }}
            onExport={(format) => {
              void handleExport(format);
            }}
            autoRefreshEnabled={autoRefreshEnabled}
            onAutoRefreshToggle={handleAutoRefreshToggle}
            refreshInterval={refreshInterval}
            onRefreshIntervalChange={handleRefreshIntervalChange}
            activeFilterCount={activeFilterCount}
            availableFilters={availableFilters}
            isLoading={isLoading}
            isExporting={exportMutation.isPending}
            isMobile={isMobile ?? false}
          />

          {/* Events Table (full width) */}
          <Stack gap="md">
            <EventsTable
              events={events}
              onEventClick={handleEventClick}
              isLoading={isLoading}
              emptyMessage={
                activeFilterCount > 0 || filters.search
                  ? 'No events match your filters or search. Try adjusting your criteria.'
                  : 'No events to display. Events will appear here as they occur in the system.'
              }
            />

            {/* Pagination */}
            <EventsPagination
              currentPage={currentPage}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </Stack>
        </Stack>

        {/* Event Details Modal */}
        <EventDetailsModal
          event={selectedEvent}
          opened={selectedEvent !== null}
          onClose={handleModalClose}
        />
      </Box>
    </ErrorBoundary>
  );
}
