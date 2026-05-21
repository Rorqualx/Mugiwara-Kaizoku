/**
 * OptionsMenu component for library actions
 */

import React from 'react';

import { Menu, ActionIcon } from '@mantine/core';
import {
  IconSettings,
  IconEdit,
  IconSearch,
  IconDownload,
  IconAdjustmentsAlt,
  IconUsers,
} from '@tabler/icons-react';

import type { OptionsMenuProps } from '../types';

/**
 * Dropdown menu for library options including edit, search, download manager,
 * advanced options, and bulk actions.
 */
export function OptionsMenu({
  opened,
  onToggle,
  onEditLibrary,
  onDownloadManager,
  onAdvancedOptions,
  onBulkActions,
}: OptionsMenuProps): React.JSX.Element {
  return (
    <Menu
      shadow="md"
      width={300}
      opened={opened}
      onChange={onToggle}
    >
      <Menu.Target>
        <ActionIcon variant="subtle" size="lg" title="Options">
          <IconSettings size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Library Actions</Menu.Label>
        <Menu.Item
          leftSection={<IconEdit size={14} />}
          onClick={onEditLibrary}
        >
          Edit Library
        </Menu.Item>
        <Menu.Item leftSection={<IconSearch size={14} />}>
          Search & Filter
        </Menu.Item>
        <Menu.Item
          leftSection={<IconDownload size={14} />}
          onClick={onDownloadManager}
        >
          Download Manager
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconAdjustmentsAlt size={14} />}
          onClick={onAdvancedOptions}
        >
          Advanced Options
        </Menu.Item>
        <Menu.Item
          leftSection={<IconUsers size={14} />}
          onClick={onBulkActions}
        >
          Bulk Actions
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
