/**
 * CalendarActionBar component for calendar page
 * 
 * This component provides a calendar-specific action bar with filtering,
 * export, sync, RSS feed, and keyboard shortcuts.
 * 
 * It directly integrates with the calendar store and manages its own state
 * to avoid prop drilling and wrapper components.
 */

import React from "react";

import { Group, ActionIcon, Box, Button, Badge, Tooltip, Menu } from "@mantine/core";
import { useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { IconFilter, IconDownload, IconWifi, IconLayoutGrid, IconSettings } from '@tabler/icons-react';

import { useCalendarStore } from '../store/calendarSlice';

export function CalendarActionBar(): React.JSX.Element {
  // Get state from calendar store
  const {
    toggleFilterPanel,
    getActiveFiltersCount,
    hasActiveFilters,
    setExportModalOpen,
    setHelpModalOpen
  } = useCalendarStore();

  const activeFilterCount = getActiveFiltersCount();
  const hasFilters = hasActiveFilters();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const handleRSSClick = (): void => {
    const baseUrl = window.location.origin;
    const rssFeedUrl = `${baseUrl}/api/calendar/rss`;
    if (isMobile) {
      window.open(rssFeedUrl, '_blank');
    } else {
      showNotification({
        title: 'RSS Feed URL',
        message: `Subscribe to: ${rssFeedUrl}`,
        color: 'blue',
        autoClose: 10000
      });
      void navigator.clipboard.writeText(rssFeedUrl).catch(() => {});
    }
  };
  return <Box style={{
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: '#424242',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
    padding: '8px 16px',
    width: '100%'
  }}>
      <Box style={{
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%'
    }}>
        {/* Left side - Main actions */}
        <Group gap="xs">
          {/* Filter Button */}
          <Tooltip label={`${activeFilterCount} active filters`}>
            <ActionIcon variant={hasFilters ? 'filled' : 'subtle'} size={isMobile ? 'md' : 'lg'} onClick={toggleFilterPanel} style={{
            position: 'relative',
            color: hasFilters ? undefined : '#dddddd'
          }}>

              <IconFilter size={18} />
              {activeFilterCount > 0 && <Badge size="xs" variant="filled" color="red" style={{
              position: 'absolute',
              top: -5,
              right: -5,
              padding: '2px 4px',
              minWidth: 16,
              height: 16
            }}>

                  {activeFilterCount}
                </Badge>}
            </ActionIcon>
          </Tooltip>

          {/* Mobile Actions Menu */}
          {isMobile ? <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" size="md" style={{
              color: '#dddddd'
            }}>
                  <IconSettings size={18} />
                </ActionIcon>
              </Menu.Target>
              
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => setExportModalOpen(true)}>
                  Export Calendar
                </Menu.Item>
                <Menu.Item leftSection={<IconWifi size={14} />} onClick={() => { void handleRSSClick(); }}>
                  RSS Feed
                </Menu.Item>
                <Menu.Item leftSection={<IconLayoutGrid size={14} />} onClick={() => setHelpModalOpen(true)}>
                  Keyboard Shortcuts
                </Menu.Item>
              </Menu.Dropdown>
            </Menu> : <>
              {/* Desktop Actions */}
              <Button leftSection={<IconDownload size={16} />} variant="subtle" onClick={() => setExportModalOpen(true)} style={{
            color: '#dddddd'
          }}>
                Export
              </Button>

              <Tooltip label="RSS Feed">
                <ActionIcon variant="subtle" size="lg" onClick={() => { void handleRSSClick(); }} style={{
              color: '#dddddd'
            }}>

                  <IconWifi size={18} />
                </ActionIcon>
              </Tooltip>
              
              <Tooltip label="Keyboard shortcuts">
                <ActionIcon variant="subtle" size="lg" onClick={() => setHelpModalOpen(true)} style={{
              color: '#dddddd'
            }}>

                  <IconLayoutGrid size={18} />
                </ActionIcon>
              </Tooltip>
            </>}
        </Group>

        {/* Right side - Additional actions could go here */}
        <Group gap="xs">
          {/* Placeholder for future actions */}
        </Group>
      </Box>
    </Box>;
}

// Note: Export and Help modals are handled by the calendar page itself
// The action bar sets state that the calendar page reads to show/hide modals
// This avoids prop drilling and wrapper components