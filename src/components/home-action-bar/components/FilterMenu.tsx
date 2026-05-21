/**
 * FilterMenu component for filter options
 */

import React from 'react';

import { Stack, Menu, ActionIcon, Text, Divider } from '@mantine/core';
import {
  IconFilter,
  IconEyeCheck,
  IconEyeOff,
  IconRefresh,
  IconPlayerStop,
  IconCopy,
  IconPhoto,
  IconChartBar,
  IconUserCircle,
  IconFileCheck,
  IconSearch,
} from '@tabler/icons-react';

import { COMMON_MENU_STYLES, ACTION_ICON_STYLES } from '../types';

import type { FilterMenuProps, FilterOption } from '../types';

/**
 * Dropdown menu for filter options including monitored status,
 * publication status, and manga deduplication
 */
export function FilterMenu({
  opened,
  onOpen,
  onClose,
  filterBy,
  onFilterChange,
  deduplicateManga,
  onDeduplicateToggle,
  options,
  onOptionToggle,
}: FilterMenuProps): React.JSX.Element {
  const handleFilterToggle = (filter: FilterOption): void => {
    const newFilters = filterBy.includes(filter)
      ? filterBy.filter((f) => f !== filter)
      : [...filterBy, filter];
    onFilterChange(newFilters);
  };

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
          <ActionIcon variant="subtle" size="lg" title="Filter" styles={ACTION_ICON_STYLES}>
            <IconFilter size={20} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Filter Options</Menu.Label>
          <Menu.Item
            leftSection={<IconEyeCheck size={14} />}
            rightSection={filterBy.includes('monitored') ? '✓' : null}
            onClick={() => {
              handleFilterToggle('monitored');
            }}
          >
            Monitored
          </Menu.Item>
          <Menu.Item
            leftSection={<IconEyeOff size={14} />}
            rightSection={filterBy.includes('unmonitored') ? '✓' : null}
            onClick={() => {
              handleFilterToggle('unmonitored');
            }}
          >
            Unmonitored
          </Menu.Item>
          <Menu.Item
            leftSection={<IconRefresh size={14} />}
            rightSection={filterBy.includes('continuing') ? '✓' : null}
            onClick={() => {
              handleFilterToggle('continuing');
            }}
          >
            Continuing
          </Menu.Item>
          <Menu.Item
            leftSection={<IconPlayerStop size={14} />}
            rightSection={filterBy.includes('ended') ? '✓' : null}
            onClick={() => {
              handleFilterToggle('ended');
            }}
          >
            Ended
          </Menu.Item>
          <Divider />
          <Menu.Item
            leftSection={<IconCopy size={14} />}
            rightSection={deduplicateManga ? '✓' : null}
            onClick={onDeduplicateToggle}
          >
            Deduplicate Manga
          </Menu.Item>
          <Divider />
          <Menu.Label>Display Options</Menu.Label>
          <Menu.Item
            leftSection={<IconPhoto size={14} />}
            onClick={() => {
              onOptionToggle('posterSize');
            }}
            rightSection={options.posterSize === 'medium' ? '✓' : null}
          >
            Poster Size
          </Menu.Item>
          <Menu.Item
            leftSection={<IconChartBar size={14} />}
            onClick={() => {
              onOptionToggle('detailProgressBar');
            }}
            rightSection={options.detailProgressBar ? '✓' : null}
          >
            Detail Progress Bar
          </Menu.Item>
          <Menu.Item
            leftSection={<IconUserCircle size={14} />}
            onClick={() => {
              onOptionToggle('showName');
            }}
            rightSection={options.showName ? '✓' : null}
          >
            Show Name
          </Menu.Item>
          <Menu.Item
            leftSection={<IconEyeCheck size={14} />}
            onClick={() => {
              onOptionToggle('showMonitored');
            }}
            rightSection={options.showMonitored ? '✓' : null}
          >
            Show Monitored
          </Menu.Item>
          <Menu.Item
            leftSection={<IconFileCheck size={14} />}
            onClick={() => {
              onOptionToggle('showQualityProfile');
            }}
            rightSection={options.showQualityProfile ? '✓' : null}
          >
            Show Quality Profile
          </Menu.Item>
          <Menu.Item
            leftSection={<IconSearch size={14} />}
            onClick={() => {
              onOptionToggle('showSearch');
            }}
            rightSection={options.showSearch ? '✓' : null}
          >
            Show Search
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Text size="xs" c="dimmed" ta="center">
        Filter
      </Text>
    </Stack>
  );
}
