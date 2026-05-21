/**
 * ViewMenu component for view type selection
 */

import React from 'react';

import { Stack, Menu, ActionIcon, Text } from '@mantine/core';
import { IconEye, IconLayoutGrid, IconTable, IconLayoutList } from '@tabler/icons-react';

import { COMMON_MENU_STYLES, ACTION_ICON_STYLES } from '../types';

import type { ViewMenuProps } from '../types';

/**
 * Dropdown menu for view type selection including posters, table, and details
 */
export function ViewMenu({
  opened,
  onOpen,
  onClose,
  viewType,
  onViewChange,
}: ViewMenuProps): React.JSX.Element {
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
          <ActionIcon variant="subtle" size="lg" title="View" styles={ACTION_ICON_STYLES}>
            <IconEye size={20} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>View Options</Menu.Label>
          <Menu.Item
            leftSection={<IconLayoutGrid size={14} />}
            onClick={() => {
              onViewChange('posters');
            }}
            rightSection={viewType === 'posters' ? '✓' : null}
          >
            Posters
          </Menu.Item>
          <Menu.Item
            leftSection={<IconTable size={14} />}
            onClick={() => {
              onViewChange('table');
            }}
            rightSection={viewType === 'table' ? '✓' : null}
          >
            Table
          </Menu.Item>
          <Menu.Item
            leftSection={<IconLayoutList size={14} />}
            onClick={() => {
              onViewChange('details');
            }}
            rightSection={viewType === 'details' ? '✓' : null}
          >
            Details
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Text size="xs" c="dimmed" ta="center">
        View
      </Text>
    </Stack>
  );
}
