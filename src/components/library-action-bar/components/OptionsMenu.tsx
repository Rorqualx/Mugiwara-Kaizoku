/**
 * OptionsMenu component for library actions
 */

import React from 'react';

import { Menu, ActionIcon } from '@mantine/core';
import {
  IconSettings,
  IconEdit,
  IconAdjustmentsAlt,
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
  onAdvancedOptions,
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
        <Menu.Item
          leftSection={<IconAdjustmentsAlt size={14} />}
          onClick={onAdvancedOptions}
        >
          Advanced Options
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
