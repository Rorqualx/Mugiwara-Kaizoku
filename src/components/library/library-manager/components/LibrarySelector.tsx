/**
 * Library Selector Component
 *
 * Provides a dropdown for selecting a library and a button to sync the selection.
 * Shows a "Create your first library" prompt when no libraries exist.
 *
 * Extracted from: FullFunctionalityLibraryManager.tsx (lines 37-66)
 *
 * @module components/library/library-manager/components/LibrarySelector
 */

import { memo, useState, useCallback } from 'react';

import { Stack, Group, Select, Text, Button, Paper, ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus, IconBooks } from '@tabler/icons-react';

import { CreateLibraryModal } from '@/components/library/CreateLibraryModal';
import { toStringId } from '@/utils/id-converters';

import type { LibrarySelectorProps } from '../types';

/**
 * Library selector with sync functionality
 *
 * Renders a dropdown to select a library and a button to sync the selection.
 * When no libraries exist, shows a prompt to create the first library.
 * The component ensures libraries is an array and converts library data to
 * the format expected by Mantine's Select component.
 */
export const LibrarySelector = memo<LibrarySelectorProps>(({
  libraries,
  selectedLibraryId,
  onSelectLibrary,
  onLibraryCreated
}): JSX.Element => {
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Ensure libraries is an array
  const safeLibraries = Array.isArray(libraries) ? libraries : [];

  // Convert libraries to Select data format
  const libraryData = safeLibraries
    .filter(lib => lib.id)
    .map(lib => ({
      value: toStringId(lib.id),
      label: lib.name || 'Unnamed Library'
    }));

  const handleCreateSuccess = useCallback((): void => {
    setCreateModalOpen(false);
    onLibraryCreated?.();
  }, [onLibraryCreated]);

  const handleOpenCreateModal = useCallback((): void => {
    setCreateModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback((): void => {
    setCreateModalOpen(false);
  }, []);

  // Empty state - no libraries exist
  if (safeLibraries.length === 0) {
    return (
      <>
        <Paper p="lg" radius="md" withBorder>
          <Stack align="center" gap="md">
            <IconBooks size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
            <Text size="lg" fw={500} ta="center">
              No Libraries Found
            </Text>
            <Text size="sm" c="dimmed" ta="center" maw={400}>
              Create your first library to start organizing and importing your manga collection.
            </Text>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleOpenCreateModal}
              variant="filled"
              color="blue"
            >
              Create Your First Library
            </Button>
          </Stack>
        </Paper>

        <CreateLibraryModal
          opened={createModalOpen}
          onClose={handleCloseCreateModal}
          onSuccess={handleCreateSuccess}
        />
      </>
    );
  }

  // Normal state - libraries exist
  return (
    <>
      <Stack gap="xs">
        <Group grow preventGrowOverflow={false} align="flex-end">
          <Select
            label="Target Library"
            description="Manga found during scan will be added to this library"
            placeholder="Select target library"
            data={libraryData}
            value={selectedLibraryId}
            onChange={value => value && onSelectLibrary(value)}
            withAsterisk
          />
          <Tooltip label="Create new library">
            <ActionIcon
              variant="light"
              size="lg"
              onClick={handleOpenCreateModal}
              aria-label="Create new library"
              mb={1}
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Text size="xs" c="dimmed">
          Select the library where scanned manga will be added.
        </Text>
      </Stack>

      <CreateLibraryModal
        opened={createModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
});

LibrarySelector.displayName = 'LibrarySelector';
