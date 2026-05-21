/**
 * Event Control Bar Component
 *
 * Contains search, filters, refresh controls, and auto-refresh settings
 * for the Events Dashboard.
 *
 * @module components/events/EventControlBar
 */
import React from 'react';

import {
  Paper,
  Group,
  Stack,
  TextInput,
  Button,
  Checkbox,
  Select,
  Badge
} from '@mantine/core';
import {
  IconDownload,
  IconRefresh,
  IconSearch
} from '@tabler/icons-react';

import type { EventLevel, EventSource, EventType } from '@/server/services/events/eventTypes';

import { EventFiltersPanel } from './EventFiltersPanel';

import type { EventFilters } from './EventFiltersPanel';

/**
 * Auto-refresh interval options (in milliseconds)
 */
const REFRESH_INTERVALS = [
  { value: '0', label: 'Disabled' },
  { value: '10000', label: '10 seconds' },
  { value: '30000', label: '30 seconds' },
  { value: '60000', label: '1 minute' },
  { value: '300000', label: '5 minutes' }
] as const;

/**
 * Available filter options
 */
export interface AvailableFilters {
  levels: EventLevel[];
  sources: EventSource[];
  types: EventType[];
}

/**
 * Props for EventControlBar component
 */
export interface EventControlBarProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRefresh: () => void;
  onExport: (format: 'json' | 'csv') => void;
  autoRefreshEnabled: boolean;
  onAutoRefreshToggle: (enabled: boolean) => void;
  refreshInterval: string;
  onRefreshIntervalChange: (value: string | null) => void;
  activeFilterCount: number;
  availableFilters: AvailableFilters;
  isLoading: boolean;
  isExporting: boolean;
  isMobile: boolean;
}

/**
 * EventControlBar Component
 *
 * Displays search, filters, and controls for the events dashboard.
 *
 * @param props - Component props
 * @returns EventControlBar component
 */
export function EventControlBar({
  filters,
  onFiltersChange,
  onSearchChange,
  onRefresh,
  onExport,
  autoRefreshEnabled,
  onAutoRefreshToggle,
  refreshInterval,
  onRefreshIntervalChange,
  activeFilterCount,
  availableFilters,
  isLoading,
  isExporting,
  isMobile
}: EventControlBarProps): React.ReactElement {
  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        {/* Top row: Search + Filters + Actions */}
        <Group justify="space-between" wrap={isMobile ? 'wrap' : 'nowrap'} gap="md">
          {/* Search (always visible) */}
          <TextInput
            placeholder="Search events..."
            leftSection={<IconSearch size={16} />}
            value={filters.search}
            onChange={onSearchChange}
            style={{ flex: isMobile ? '1 1 100%' : '1 1 300px', maxWidth: isMobile ? '100%' : '400px' }}
            size={isMobile ? 'sm' : 'md'}
          />

          {/* Filter + Actions */}
          <Group gap="xs" wrap="nowrap" style={{ flex: '0 0 auto' }}>
            <EventFiltersPanel
              availableLevels={availableFilters.levels}
              availableSources={availableFilters.sources}
              availableTypes={availableFilters.types}
              filters={filters}
              onFiltersChange={onFiltersChange}
              activeFilterCount={activeFilterCount}
            />

            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={onRefresh}
              loading={isLoading}
              size={isMobile ? 'sm' : 'md'}
            >
              {isMobile ? '' : 'Refresh'}
            </Button>

            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={() => {
                onExport('json');
              }}
              loading={isExporting}
              size={isMobile ? 'sm' : 'md'}
            >
              {isMobile ? '' : 'Export'}
            </Button>
          </Group>
        </Group>

        {/* Bottom row: Auto-refresh controls */}
        <Group justify="space-between" wrap={isMobile ? 'wrap' : 'nowrap'}>
          <Checkbox
            label="Auto-refresh"
            checked={autoRefreshEnabled}
            onChange={(e) => onAutoRefreshToggle(e.currentTarget.checked)}
            size={isMobile ? 'sm' : 'md'}
          />

          {autoRefreshEnabled && (
            <Group gap="xs">
              <Select
                size="sm"
                data={REFRESH_INTERVALS.map((i) => ({
                  value: i.value,
                  label: i.label
                }))}
                value={refreshInterval}
                onChange={onRefreshIntervalChange}
                style={{ width: isMobile ? '100%' : '150px' }}
                aria-label="Select refresh interval"
              />
              <Badge color="green" variant="dot">
                Live
              </Badge>
            </Group>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
