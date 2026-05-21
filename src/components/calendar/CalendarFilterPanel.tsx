/**
 * Calendar Filter Panel Component
 * 
 * Provides advanced filtering capabilities for the calendar view.
 * Allows users to filter by manga, confidence level, status, and date range.
 * 
 * @module components/calendar/CalendarFilterPanel
 */

import React, { useMemo } from 'react';

import { Paper, Title, Group, Button, MultiSelect, Checkbox, Text, Stack, Divider, Badge, ActionIcon } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconFilter, IconX, IconRefresh } from '@tabler/icons-react';

import { useCalendarStore } from '@/store/calendarSlice';
import { toStringId } from '@/utils/id-converters';
import { trpc } from '@/utils/trpc-client/index';

import type { EventStatus } from '@prisma/client';

/**
 * Calendar Filter Panel Props
 */
interface CalendarFilterPanelProps {
  onClose?: () => void;
}

/**
 * Calendar Filter Panel Component
 */
export function CalendarFilterPanel({
  onClose
}: CalendarFilterPanelProps): React.ReactElement {
  const {
    filters,
    setSelectedManga,
    setStatusFilter,
    setDateRange,
    toggleConfirmed,
    toggleDelayed,
    resetFilters,
    getActiveFiltersCount,
    hasActiveFilters
  } = useCalendarStore();

  // Fetch available manga for filter
  const {
    data: mangaList
  } = trpc.manga.query.useQuery({
    include: {
      library: true,
      chapters: false
    }
  });

  // Prepare manga options for MultiSelect
  const mangaOptions = useMemo(() => {
    if (!mangaList) return [];
    return mangaList.map(manga => {
      if (typeof manga !== 'object') return { value: '', label: '', group: '' };
      if (!('id' in manga) || !('title' in manga)) return { value: '', label: '', group: '' };
      return {
        value: toStringId(manga["id"]),
        label: manga["title"] as string,
        group: ('library' in manga && manga.library && typeof manga.library === 'object' && 'name' in manga.library)
          ? (manga.library.name as string)
          : 'No Library'
      };
    });
  }, [mangaList]);

  // Status filter options
  const statusOptions = [{
    value: 'CONFIRMED',
    label: 'Confirmed'
  }, {
    value: 'SCHEDULED',
    label: 'Scheduled'
  }, {
    value: 'DELAYED',
    label: 'Delayed'
  }, {
    value: 'RELEASED',
    label: 'Released'
  }, {
    value: 'CANCELLED',
    label: 'Cancelled'
  }];
  const activeFilterCount = getActiveFiltersCount();
  return <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconFilter size={20} />
          <Title order={4}>Filters</Title>
          {activeFilterCount > 0 && <Badge size="sm" variant="filled">
              {activeFilterCount}
            </Badge>}
        </Group>
        
        <Group gap="xs">
          {hasActiveFilters() && <Button size="xs" variant="subtle" leftSection={<IconRefresh size={14} />} onClick={resetFilters}>
              Reset
            </Button>}
          {onClose && <ActionIcon size="sm" variant="subtle" onClick={onClose}>
              <IconX size={16} />
            </ActionIcon>}
        </Group>
      </Group>
      
      <Stack gap="md">
        {/* Manga Filter */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Filter by Manga
          </Text>
          <MultiSelect data={mangaOptions} value={filters.selectedManga.map(id => toStringId(id))} onChange={values => setSelectedManga(values.map(v => parseInt(v)))} placeholder="Select manga to show" searchable clearable maxDropdownHeight={200} />
        </div>
        
        <Divider />

        {/* Status Filter */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Event Status
          </Text>
          <MultiSelect data={statusOptions} value={filters.statusFilter} onChange={values => setStatusFilter(values as EventStatus[])} placeholder="All statuses" clearable />
        </div>
        
        <Divider />
        
        {/* Quick Toggles */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Quick Filters
          </Text>
          <Stack gap="xs">
            <Checkbox label="Show Confirmed Events" checked={filters.showConfirmed} onChange={toggleConfirmed} />
            <Checkbox label="Show Delayed Events" checked={filters.showDelayed} onChange={toggleDelayed} />
          </Stack>
        </div>
        
        <Divider />
        
        {/* Date Range Filter */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Date Range
          </Text>
          <Stack gap="xs">
            <DatePickerInput label="Start Date" value={filters.dateRange.start} onChange={date => date && setDateRange(new Date(date), filters.dateRange.end)} clearable={false} />
            <DatePickerInput label="End Date" value={filters.dateRange.end} onChange={date => date && setDateRange(filters.dateRange.start, new Date(date))} clearable={false} />
          </Stack>
        </div>
      </Stack>
    </Paper>;
}
CalendarFilterPanel.displayName = 'CalendarFilterPanel';