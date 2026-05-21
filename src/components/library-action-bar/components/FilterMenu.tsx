/**
 * FilterMenu component for filter options
 */

import React from 'react';

import { Menu, ActionIcon } from '@mantine/core';
import {
  IconFilter,
  IconEyeCheck,
  IconEyeOff,
  IconRefresh,
  IconPlayerStop,
  IconDownload,
  IconAlertCircle,
} from '@tabler/icons-react';

import type { FilterOption } from '@/store/index';

import type { FilterMenuProps } from '../types';

/**
 * Dropdown menu for filter options including read status, progress,
 * download status, and issue tracking.
 */
export function FilterMenu({
  opened,
  onToggle,
  filterBy,
  onFilterChange,
}: FilterMenuProps): React.JSX.Element {
  const handleFilterChange = (filter: FilterOption): void => {
    onFilterChange(filter);
  };

  return (
    <Menu
      shadow="md"
      width={280}
      opened={opened}
      onChange={onToggle}
    >
      <Menu.Target>
        <ActionIcon variant="subtle" size="lg" title="Filter">
          <IconFilter size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Filter Options</Menu.Label>
        <Menu.Item
          leftSection={<IconEyeCheck size={14} />}
          onClick={() => handleFilterChange('read')}
          {...(filterBy.includes('read') && { color: 'blue' })}
        >
          Read
        </Menu.Item>
        <Menu.Item
          leftSection={<IconEyeOff size={14} />}
          onClick={() => handleFilterChange('unread')}
          {...(filterBy.includes('unread') && { color: 'blue' })}
        >
          Unread
        </Menu.Item>
        <Menu.Item
          leftSection={<IconRefresh size={14} />}
          onClick={() => handleFilterChange('in-progress')}
          {...(filterBy.includes('in-progress') && { color: 'blue' })}
        >
          In Progress
        </Menu.Item>
        <Menu.Item
          leftSection={<IconPlayerStop size={14} />}
          onClick={() => handleFilterChange('completed')}
          {...(filterBy.includes('completed') && { color: 'blue' })}
        >
          Completed
        </Menu.Item>
        <Menu.Item
          leftSection={<IconDownload size={14} />}
          onClick={() => handleFilterChange('downloaded')}
          {...(filterBy.includes('downloaded') && { color: 'blue' })}
        >
          Downloaded
        </Menu.Item>
        <Menu.Item
          leftSection={<IconAlertCircle size={14} />}
          onClick={() => handleFilterChange('has-issues')}
          {...(filterBy.includes('has-issues') && { color: 'blue' })}
        >
          Has Issues
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
