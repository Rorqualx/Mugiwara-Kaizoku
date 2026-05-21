/**
 * Event Filters Menu Component
 *
 * Simplified dropdown menu for filtering system events. Features a clean
 * interface focused on date range selection with optional level and source filters.
 *
 * @module components/events/EventFiltersPanel
 */
import React, { useState, useCallback } from 'react';

import {
  Menu,
  Button,
  Stack,
  Radio,
  Checkbox,
  Group,
  Divider,
  Text,
  Badge,
  Accordion
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconFilter, IconX } from '@tabler/icons-react';
import { addDays, startOfDay, endOfDay } from 'date-fns';

import type { EventLevel, EventSource, EventType } from '@/server/services/events/eventTypes';

/**
 * Event filters state interface
 */
export interface EventFilters {
  /** Selected event levels */
  levels: EventLevel[];
  /** Selected event sources */
  sources: EventSource[];
  /** Selected event types */
  types: EventType[];
  /** Date range filter */
  dateRange: {
    start?: Date;
    end?: Date;
  };
  /** Search query */
  search: string;
}

/**
 * Props for the EventFiltersMenu component
 */
export interface EventFiltersPanelProps {
  /**
   * Available event levels for filtering
   */
  availableLevels: EventLevel[];

  /**
   * Available event sources for filtering
   */
  availableSources: EventSource[];

  /**
   * Available event types for filtering (not used in simplified version)
   */
  availableTypes: EventType[];

  /**
   * Current filter values
   */
  filters: EventFilters;

  /**
   * Callback when filters change
   */
  onFiltersChange: (filters: EventFilters) => void;

  /**
   * Active filter count (for badge display)
   */
  activeFilterCount?: number;
}

/**
 * Date range preset options
 */
type DatePreset = 'all' | '24h' | '7d' | '30d' | 'custom';

/**
 * Calculate date range from preset
 */
function getDateRangeFromPreset(preset: DatePreset): { start?: Date; end?: Date } {
  if (preset === 'all' || preset === 'custom') {
    return {};
  }

  const now = new Date();
  const endDate = endOfDay(now);

  switch (preset) {
    case '24h':
      return {
        start: startOfDay(addDays(now, -1)),
        end: endDate
      };
    case '7d':
      return {
        start: startOfDay(addDays(now, -7)),
        end: endDate
      };
    case '30d':
      return {
        start: startOfDay(addDays(now, -30)),
        end: endDate
      };
    default:
      return {};
  }
}

/**
 * Determine current date preset from filters
 */
function getCurrentDatePreset(filters: EventFilters): DatePreset {
  if (!filters.dateRange.start && !filters.dateRange.end) {
    return 'all';
  }
  // If custom dates are set, return 'custom'
  return 'custom';
}

/**
 * Event Filters Menu Component
 *
 * Provides a simplified dropdown menu interface for filtering system events
 * with focus on date range selection.
 *
 * @param props - Component props
 * @returns EventFiltersMenu component
 */
export function EventFiltersPanel({
  // availableLevels not used in simplified menu design
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  availableLevels,
  availableSources,
  filters,
  onFiltersChange,
  activeFilterCount = 0
}: EventFiltersPanelProps): React.ReactElement {
  // Menu open state
  const [menuOpened, setMenuOpened] = useState(false);

  // Local state for date preset
  const [datePreset, setDatePreset] = useState<DatePreset>(
    getCurrentDatePreset(filters)
  );

  // Quick filter states
  const [showErrorsOnly, setShowErrorsOnly] = useState(
    filters.levels.includes('ERROR' as EventLevel) &&
      filters.levels.includes('CRITICAL' as EventLevel) &&
      filters.levels.length === 2
  );
  const [showWarningsOnly, setShowWarningsOnly] = useState(
    filters.levels.includes('WARNING' as EventLevel) && filters.levels.length === 1
  );

  /**
   * Handle date preset change
   */
  const handleDatePresetChange = useCallback(
    (value: string | null) => {
      if (!value) return;

      const preset = value as DatePreset;
      setDatePreset(preset);

      if (preset !== 'custom') {
        const dateRange = getDateRangeFromPreset(preset);
        onFiltersChange({
          ...filters,
          dateRange
        });
      }
    },
    [filters, onFiltersChange]
  );

  /**
   * Handle custom date range change
   */
  const handleCustomDateChange = useCallback(
    (dates: [Date | null, Date | null]) => {
      const dateRange: { start?: Date; end?: Date } = {};
      if (dates[0]) {
        dateRange.start = dates[0];
      }
      if (dates[1]) {
        dateRange.end = dates[1];
      }
      onFiltersChange({
        ...filters,
        dateRange
      });
    },
    [filters, onFiltersChange]
  );

  /**
   * Handle errors only filter
   */
  const handleErrorsOnlyChange = useCallback(
    (checked: boolean) => {
      setShowErrorsOnly(checked);
      if (showWarningsOnly) {
        setShowWarningsOnly(false);
      }

      onFiltersChange({
        ...filters,
        levels: checked ? (['ERROR', 'CRITICAL'] as EventLevel[]) : []
      });
    },
    [filters, onFiltersChange, showWarningsOnly]
  );

  /**
   * Handle warnings only filter
   */
  const handleWarningsOnlyChange = useCallback(
    (checked: boolean) => {
      setShowWarningsOnly(checked);
      if (showErrorsOnly) {
        setShowErrorsOnly(false);
      }

      onFiltersChange({
        ...filters,
        levels: checked ? (['WARNING'] as EventLevel[]) : []
      });
    },
    [filters, onFiltersChange, showErrorsOnly]
  );

  /**
   * Handle source filter toggle
   */
  const handleSourceToggle = useCallback(
    (source: EventSource, checked: boolean) => {
      const newSources = checked
        ? [...filters.sources, source]
        : filters.sources.filter((s) => s !== source);

      onFiltersChange({
        ...filters,
        sources: newSources
      });
    },
    [filters, onFiltersChange]
  );

  /**
   * Clear all filters
   */
  const handleClearAll = useCallback(() => {
    setDatePreset('all');
    setShowErrorsOnly(false);
    setShowWarningsOnly(false);
    onFiltersChange({
      levels: [],
      sources: [],
      types: [],
      dateRange: {},
      search: filters.search // Keep search
    });
    setMenuOpened(false);
  }, [filters.search, onFiltersChange]);

  // Top 6 most relevant sources for the menu
  const topSources = [
    'download',
    'metadata',
    'manga',
    'anilist',
    'comicvine',
    'system'
  ].filter((s) => availableSources.includes(s as EventSource)) as EventSource[];

  return (
    <Menu
      opened={menuOpened}
      onChange={setMenuOpened}
      width={320}
      shadow="md"
      position="bottom-end"
    >
      <Menu.Target>
        <Button
          variant="light"
          leftSection={<IconFilter size={16} />}
          rightSection={
            activeFilterCount > 0 ? (
              <Badge size="sm" circle>
                {activeFilterCount}
              </Badge>
            ) : null
          }
        >
          Filter
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Stack gap="md" p="xs">
          {/* Date Range Section (Primary) */}
          <div>
            <Text size="sm" fw={600} mb="xs">
              Date Range
            </Text>
            <Radio.Group value={datePreset} onChange={handleDatePresetChange}>
              <Stack gap="xs">
                <Radio value="all" label="All time" />
                <Radio value="24h" label="Last 24 hours" />
                <Radio value="7d" label="Last 7 days" />
                <Radio value="30d" label="Last 30 days" />
                <Radio value="custom" label="Custom range..." />
              </Stack>
            </Radio.Group>

            {/* Custom date picker */}
            {datePreset === 'custom' && (
              <DatePickerInput
                type="range"
                placeholder="Pick dates range"
                value={[
                  filters.dateRange.start ?? null,
                  filters.dateRange.end ?? null
                ]}
                onChange={handleCustomDateChange}
                mt="xs"
                size="sm"
                clearable
              />
            )}
          </div>

          <Divider />

          {/* Quick Level Filters (Secondary) */}
          <div>
            <Text size="sm" fw={600} mb="xs">
              Quick Filters
            </Text>
            <Stack gap="xs">
              <Checkbox
                label="Errors only"
                checked={showErrorsOnly}
                onChange={(e) => handleErrorsOnlyChange(e.currentTarget.checked)}
              />
              <Checkbox
                label="Warnings only"
                checked={showWarningsOnly}
                onChange={(e) => handleWarningsOnlyChange(e.currentTarget.checked)}
              />
            </Stack>
          </div>

          {/* Optional Source Filters */}
          {topSources.length > 0 && (
            <>
              <Divider />
              <Accordion variant="contained">
                <Accordion.Item value="sources">
                  <Accordion.Control>
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>
                        Sources (optional)
                      </Text>
                      {filters.sources.length > 0 && (
                        <Badge size="sm">{filters.sources.length}</Badge>
                      )}
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="xs">
                      {topSources.map((source) => (
                        <Checkbox
                          key={source}
                          label={
                            source.charAt(0).toUpperCase() + source.slice(1)
                          }
                          checked={filters.sources.includes(source)}
                          onChange={(e) =>
                            handleSourceToggle(source, e.currentTarget.checked)
                          }
                        />
                      ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </>
          )}

          <Divider />

          {/* Actions */}
          <Group justify="space-between">
            {activeFilterCount > 0 && (
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                leftSection={<IconX size={14} />}
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            )}
          </Group>
        </Stack>
      </Menu.Dropdown>
    </Menu>
  );
}
