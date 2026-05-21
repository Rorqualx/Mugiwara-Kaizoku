/**
 * Token Display Toolbar Component
 */

import React from 'react';

import { Text, Group, Badge, Stack, TextInput, Tabs, SegmentedControl } from '@mantine/core';
import { IconSearch, IconList, IconLayoutGrid } from '@tabler/icons-react';

import type { TokenViewMode, TokenLayoutMode } from './types';

interface TokenDisplayToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  viewMode: TokenViewMode;
  onViewModeChange: (v: TokenViewMode) => void;
  layoutMode: TokenLayoutMode;
  onLayoutModeChange: (v: TokenLayoutMode) => void;
  stats: { labeled: number; unlabeled: number };
  filteredCount: number;
}

export function TokenDisplayToolbar({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  layoutMode,
  onLayoutModeChange,
  stats,
  filteredCount,
}: TokenDisplayToolbarProps): React.ReactElement {
  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end">
        <TextInput
          size="xs"
          placeholder="Search tokens..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 250 }}
        />
        <Group gap="xs">
          <SegmentedControl
            size="xs"
            value={layoutMode}
            onChange={(v) => onLayoutModeChange(v as TokenLayoutMode)}
            data={[
              { value: 'flow', label: <IconLayoutGrid size={14} /> },
              { value: 'compact', label: <IconList size={14} /> },
              { value: 'grouped', label: 'Grouped' },
            ]}
          />
        </Group>
      </Group>

      <Group justify="space-between">
        <Tabs value={viewMode} onChange={(v) => onViewModeChange(v as TokenViewMode)} variant="pills">
          <Tabs.List>
            <Tabs.Tab value="all" size="xs">
              All ({stats.labeled + stats.unlabeled})
            </Tabs.Tab>
            <Tabs.Tab value="labeled" size="xs">
              <Badge size="xs" color="green" variant="light" mr={4}>{stats.labeled}</Badge>
              Labeled
            </Tabs.Tab>
            <Tabs.Tab value="unlabeled" size="xs">
              <Badge size="xs" color="gray" variant="light" mr={4}>{stats.unlabeled}</Badge>
              Unlabeled
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {search && (
          <Text size="xs" c="dimmed">
            Showing {filteredCount} results
          </Text>
        )}
      </Group>
    </Stack>
  );
}
