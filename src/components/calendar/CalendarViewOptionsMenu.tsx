/**
 * Calendar View Options Menu Component
 *
 * Settings menu for calendar view customization.
 * Extracted from calendar.tsx to reduce complexity.
 *
 * Options:
 * - Color scheme selector (status/manga)
 */

import React from 'react';

import { ActionIcon, Menu, SegmentedControl } from '@mantine/core';
import { IconPalette, IconSettings } from '@tabler/icons-react';

/**
 * Color scheme type
 */
export type ColorScheme = 'status' | 'manga';

/**
 * Props for CalendarViewOptionsMenu component
 */
export interface CalendarViewOptionsMenuProps {
  /** Current color scheme */
  colorScheme: ColorScheme;
  /** Callback when color scheme changes */
  onColorSchemeChange: (scheme: ColorScheme) => void;
}

/**
 * Calendar View Options Menu
 *
 * Provides a dropdown menu with various calendar view customization options.
 * Hidden on mobile devices.
 *
 * @param props - Component props
 * @returns Settings menu component
 */
export function CalendarViewOptionsMenu({
  colorScheme,
  onColorSchemeChange,
}: CalendarViewOptionsMenuProps): React.JSX.Element {
  return (
    <Menu position="bottom-start">
      <Menu.Target>
        <ActionIcon variant="default" size="lg">
          <IconSettings size={18} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>View Options</Menu.Label>

        <Menu.Item
          leftSection={<IconPalette size={14} />}
          rightSection={
            <SegmentedControl
              size="xs"
              value={colorScheme}
              onChange={(value) => onColorSchemeChange(value as ColorScheme)}
              data={[
                {
                  value: 'status',
                  label: 'Status',
                },
                {
                  value: 'manga',
                  label: 'Manga',
                },
              ]}
            />
          }
        >
          Color By
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
