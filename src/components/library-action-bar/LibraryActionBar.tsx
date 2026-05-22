/**
 * LibraryActionBar component for library detail pages
 *
 * This component provides a library-specific action bar with manga management,
 * view options, sorting, filtering, and alphabet navigation.
 *
 * Now connected to the unified library view store for consistent state management.
 * Refactored to use extracted sub-components for reduced complexity.
 */

import React, { useState, useCallback } from 'react';

import { Group, Box, ActionIcon, Tooltip } from '@mantine/core';
import { IconCloud } from '@tabler/icons-react';

import { useSearchDownload } from '@/components/home-action-bar/hooks';
import { EditLibraryModal } from '@/components/library/EditLibraryModal';
import type { ViewType, SortOption, FilterOption } from '@/store/index';
import { notify } from '@/utils/notify';

import {
  OptionsMenu,
  ViewMenu,
  SortMenu,
  FilterMenu,
  AlphabetNavigation,
  AdvancedOptionsModal,
  CoverSizeSelector,
} from './components';
import { useLibraryActionBarState } from './hooks/useLibraryActionBarState';

import type { LibraryActionBarProps, MenuState } from './types';


/**
 * Library action bar with manga management, view options, sorting,
 * filtering, and alphabet navigation.
 */
export function LibraryActionBar({
  libraryId,
  libraryName,
}: LibraryActionBarProps): React.JSX.Element {
  // Get consolidated state from custom hook
  const state = useLibraryActionBarState();

  // Menu state
  const [openedMenu, setOpenedMenu] = useState<MenuState>(null);

  // Modal states
  const [optionsModalOpened, setOptionsModalOpened] = useState(false);
  const [editLibraryModalOpened, setEditLibraryModalOpened] = useState(false);

  // Search downloads (selection-aware: all monitored when nothing selected,
  // otherwise just the selected manga). Moved here from HomeActionBar.
  const { handleSearchDownload, isSearching, hasSelection, selectedCount } = useSearchDownload();

  // Handlers
  const handleMenuToggle = useCallback(
    (menu: MenuState) =>
      (opened: boolean): void => {
        setOpenedMenu(opened ? menu : null);
      },
    []
  );

  const handleViewChange = useCallback(
    (view: ViewType): void => {
      state.setViewType(view);
      setOpenedMenu(null);
    },
    [state]
  );

  const handleSortChange = useCallback(
    (sort: SortOption): void => {
      state.setSortBy(sort);
      setOpenedMenu(null);
    },
    [state]
  );

  const handleFilterChange = useCallback(
    (filter: FilterOption): void => {
      state.toggleFilter(filter);
      setOpenedMenu(null);
    },
    [state]
  );

  const jumpToLetter = useCallback((letter: string): void => {
    const cards = document.querySelectorAll<HTMLElement>('[data-manga-title]');
    const target = Array.from(cards).find((el) => {
      const title = el.getAttribute('data-manga-title') ?? '';
      const firstChar = title.charAt(0).toUpperCase();
      if (letter === '#') return firstChar === '' || !/[A-Z]/.test(firstChar);
      return firstChar === letter;
    });
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleSaveAdvancedOptions = useCallback((): void => {
    setOptionsModalOpened(false);
    notify({ severity: 'SUCCESS', title: 'Settings Saved', message: 'Advanced library options have been saved' });
  }, []);

  return (
    <Box
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: '#424242',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        padding: '8px 16px',
        width: '100%',
      }}
    >
      <Box
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Left side - Main actions */}
        <Group gap="xs">
          <OptionsMenu
            opened={openedMenu === 'options'}
            onToggle={handleMenuToggle('options')}
            onEditLibrary={() => setEditLibraryModalOpened(true)}
            onAdvancedOptions={() => setOptionsModalOpened(true)}
          />

          <ViewMenu
            opened={openedMenu === 'view'}
            onToggle={handleMenuToggle('view')}
            viewType={state.viewType}
            showCovers={state.showCovers}
            showProgress={state.showProgress}
            onViewChange={handleViewChange}
            onToggleCovers={state.toggleShowCovers}
            onToggleProgress={state.toggleShowProgress}
          />

          <SortMenu
            opened={openedMenu === 'sort'}
            onToggle={handleMenuToggle('sort')}
            sortBy={state.sortBy}
            onSortChange={handleSortChange}
          />

          <FilterMenu
            opened={openedMenu === 'filter'}
            onToggle={handleMenuToggle('filter')}
            filterBy={state.filterBy}
            onFilterChange={handleFilterChange}
          />

          {state.viewType === 'posters' && (
            <CoverSizeSelector
              coverSize={state.coverSize}
              onCoverSizeChange={state.setCoverSize}
            />
          )}

          <Tooltip
            label={
              hasSelection
                ? `Search downloads for ${selectedCount} selected manga`
                : 'Search downloads for all monitored manga'
            }
          >
            <ActionIcon
              variant="subtle"
              size="lg"
              loading={isSearching}
              onClick={() => { void handleSearchDownload(); }}
              style={{ color: '#dddddd' }}
              aria-label="Search downloads"
            >
              <IconCloud size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Right side - Alphabet navigation */}
        <AlphabetNavigation onJumpToLetter={jumpToLetter} />
      </Box>

      {/* Advanced Options Modal */}
      <AdvancedOptionsModal
        opened={optionsModalOpened}
        onClose={() => setOptionsModalOpened(false)}
        autoDownloadNewChapters={state.autoDownloadNewChapters}
        sendUpdateNotifications={state.sendUpdateNotifications}
        autoMarkAsRead={state.autoMarkAsRead}
        onAutoDownloadChange={state.setAutoDownloadNewChapters}
        onNotificationsChange={state.setSendUpdateNotifications}
        onAutoMarkAsReadChange={state.setAutoMarkAsRead}
        onSave={handleSaveAdvancedOptions}
      />

      {/* Edit Library Modal */}
      {libraryId && libraryName && (
        <EditLibraryModal
          opened={editLibraryModalOpened}
          onClose={() => setEditLibraryModalOpened(false)}
          library={{
            id: libraryId,
            name: libraryName,
            path: '', // Path would need to be passed from parent or fetched
          }}
        />
      )}

    </Box>
  );
}
