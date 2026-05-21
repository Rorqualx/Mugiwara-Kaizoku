/**
 * ViewMenu component for view options
 */

import React from 'react';

import { Menu, ActionIcon } from '@mantine/core';
import {
  IconEye,
  IconLayoutGrid,
  IconTable,
  IconLayoutList,
  IconPhoto,
  IconChartBar,
} from '@tabler/icons-react';

import type { ViewType } from '@/store/index';

import type { ViewMenuProps } from '../types';

/**
 * Dropdown menu for view options including poster, table, and detailed views,
 * plus toggles for covers and progress display.
 */
export function ViewMenu({
  opened,
  onToggle,
  viewType,
  showCovers,
  showProgress,
  onViewChange,
  onToggleCovers,
  onToggleProgress,
}: ViewMenuProps): React.JSX.Element {
  const handleViewChange = (view: ViewType): void => {
    onViewChange(view);
  };

  return (
    <Menu
      shadow="md"
      width={200}
      opened={opened}
      onChange={onToggle}
    >
      <Menu.Target>
        <ActionIcon variant="subtle" size="lg" title="View">
          <IconEye size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>View Options</Menu.Label>
        <Menu.Item
          leftSection={<IconLayoutGrid size={14} />}
          onClick={() => handleViewChange('posters')}
          {...(viewType === 'posters' && { color: 'blue' })}
        >
          Poster View
        </Menu.Item>
        <Menu.Item
          leftSection={<IconTable size={14} />}
          onClick={() => handleViewChange('table')}
          {...(viewType === 'table' && { color: 'blue' })}
        >
          Table View
        </Menu.Item>
        <Menu.Item
          leftSection={<IconLayoutList size={14} />}
          onClick={() => handleViewChange('details')}
          {...(viewType === 'details' && { color: 'blue' })}
        >
          Detailed View
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconPhoto size={14} />}
          onClick={onToggleCovers}
          {...(showCovers && { color: 'blue' })}
        >
          Show Covers
        </Menu.Item>
        <Menu.Item
          leftSection={<IconChartBar size={14} />}
          onClick={onToggleProgress}
          {...(showProgress && { color: 'blue' })}
        >
          Show Progress
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
