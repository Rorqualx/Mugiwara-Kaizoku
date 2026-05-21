/**
 * SortMenu component for sort options
 */

import React from 'react';

import { Menu, ActionIcon } from '@mantine/core';
import { IconArrowsSort } from '@tabler/icons-react';

import type { SortOption } from '@/store/index';

import type { SortMenuProps } from '../types';

/**
 * Dropdown menu for sort options including alphabetical, date added,
 * last read, progress, and rating.
 */
export function SortMenu({
  opened,
  onToggle,
  sortBy,
  onSortChange,
}: SortMenuProps): React.JSX.Element {
  const handleSortChange = (sort: SortOption): void => {
    onSortChange(sort);
  };

  return (
    <Menu
      shadow="md"
      width={250}
      opened={opened}
      onChange={onToggle}
    >
      <Menu.Target>
        <ActionIcon variant="subtle" size="lg" title="Sort">
          <IconArrowsSort size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Sort Options</Menu.Label>
        <Menu.Item
          onClick={() => handleSortChange('alphabetical')}
          {...(sortBy === 'alphabetical' && { color: 'blue' })}
        >
          Alphabetical (A-Z)
        </Menu.Item>
        <Menu.Item
          onClick={() => handleSortChange('alphabetical-desc')}
          {...(sortBy === 'alphabetical-desc' && { color: 'blue' })}
        >
          Alphabetical (Z-A)
        </Menu.Item>
        <Menu.Item
          onClick={() => handleSortChange('date-added')}
          {...(sortBy === 'date-added' && { color: 'blue' })}
        >
          Date Added (Newest)
        </Menu.Item>
        <Menu.Item
          onClick={() => handleSortChange('date-added-desc')}
          {...(sortBy === 'date-added-desc' && { color: 'blue' })}
        >
          Date Added (Oldest)
        </Menu.Item>
        <Menu.Item
          onClick={() => handleSortChange('last-read')}
          {...(sortBy === 'last-read' && { color: 'blue' })}
        >
          Last Read
        </Menu.Item>
        <Menu.Item
          onClick={() => handleSortChange('progress')}
          {...(sortBy === 'progress' && { color: 'blue' })}
        >
          Progress
        </Menu.Item>
        <Menu.Item
          onClick={() => handleSortChange('rating')}
          {...(sortBy === 'rating' && { color: 'blue' })}
        >
          Rating
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
