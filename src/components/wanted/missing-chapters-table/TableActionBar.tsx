/**
 * Table Action Bar Component
 *
 * Action bar with search, filters, and bulk actions for missing chapters table.
 */

import React from 'react';

import {
  Paper,
  Stack,
  Group,
  Title,
  Tooltip,
  ActionIcon,
  Text,
  Button,
  TextInput,
  MultiSelect
} from '@mantine/core';
import { IconRefresh, IconSearch, IconDownload, IconFilter } from '@tabler/icons-react';

interface TableActionBarProps {
  filteredCount: number;
  mangaCount: number;
  selectedCount: number;
  searchTerm: string;
  statusFilter: string[];
  uniqueStatuses: Array<{ value: string; label: string }>;
  isLoading?: boolean | undefined;
  isSearching: boolean;
  onRefresh?: (() => void) | undefined;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string[]) => void;
  onSearchNow: () => void;
}

export function TableActionBar({
  filteredCount,
  mangaCount,
  selectedCount,
  searchTerm,
  statusFilter,
  uniqueStatuses,
  isLoading,
  isSearching,
  onRefresh,
  onSearchChange,
  onStatusFilterChange,
  onSearchNow
}: TableActionBarProps): React.ReactElement {
  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Group>
            <Title order={3}>Missing Chapters</Title>
            <Tooltip label="Refresh missing items">
              <ActionIcon
                variant="light"
                size="lg"
                onClick={() => { if (onRefresh) void onRefresh(); }}
                loading={isLoading ?? false}
                disabled={!onRefresh}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Text size="sm" c="dimmed">
              {filteredCount} chapters across {mangaCount} manga
            </Text>
          </Group>
          <Group>
            {selectedCount > 0 && (
              <Button
                leftSection={<IconDownload size={16} />}
                onClick={() => { void onSearchNow(); }}
                loading={isSearching}
                color="blue"
              >
                Search Now ({selectedCount})
              </Button>
            )}
          </Group>
        </Group>

        <Group>
          <TextInput
            placeholder="Search manga, chapter title, or number..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={e => onSearchChange(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 300 }}
          />
          <MultiSelect
            placeholder="Filter by status"
            data={uniqueStatuses}
            value={statusFilter}
            onChange={onStatusFilterChange}
            leftSection={<IconFilter size={16} />}
            clearable
            style={{ minWidth: 200 }}
          />
        </Group>
      </Stack>
    </Paper>
  );
}
