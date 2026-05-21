/**
 * SortMenu component for sort options
 */

import React from 'react';

import { Stack, Menu, ActionIcon, Text } from '@mantine/core';
import { IconArrowsSort, IconEyeCheck, IconUsers, IconBook } from '@tabler/icons-react';

import { COMMON_MENU_STYLES, ACTION_ICON_STYLES } from '../types';

import type { SortMenuProps } from '../types';

/**
 * Dropdown menu for sort options including status, title, and progress
 */
export function SortMenu({
  opened,
  onOpen,
  onClose,
  sortBy,
  onSortChange,
}: SortMenuProps): React.JSX.Element {
  return (
    <Stack gap={2} align="center" style={{ width: '60px' }}>
      <Menu
        shadow="md"
        width={200}
        styles={COMMON_MENU_STYLES}
        opened={opened}
        onOpen={onOpen}
        onClose={onClose}
      >
        <Menu.Target>
          <ActionIcon variant="subtle" size="lg" title="Sort" styles={ACTION_ICON_STYLES}>
            <IconArrowsSort size={20} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Sort Options</Menu.Label>
          <Menu.Item
            leftSection={<IconEyeCheck size={14} />}
            onClick={() => {
              onSortChange('status');
            }}
            rightSection={sortBy === 'status' ? '✓' : null}
          >
            Monitored/Status
          </Menu.Item>
          <Menu.Item
            leftSection={<IconUsers size={14} />}
            onClick={() => {
              onSortChange('alphabetical');
            }}
            rightSection={sortBy === 'alphabetical' ? '✓' : null}
          >
            Title
          </Menu.Item>
          <Menu.Item
            leftSection={<IconBook size={14} />}
            onClick={() => {
              onSortChange('progress');
            }}
            rightSection={sortBy === 'progress' ? '✓' : null}
          >
            Progress
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Text size="xs" c="dimmed" ta="center">
        Sort
      </Text>
    </Stack>
  );
}
