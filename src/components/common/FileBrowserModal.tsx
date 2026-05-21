/**
 * File Browser Modal Component
 *
 * A modal dialog for browsing the server's filesystem. Allows users to navigate
 * directories and select paths. Useful for path configuration in settings.
 *
 * Features:
 * - Directory navigation with breadcrumbs
 * - Visual indicators for directories and accessibility
 * - Quick access to common starting points
 * - Keyboard navigation support
 */

import React from 'react';

import {
  Modal,
  Stack,
  Button,
  Group,
  Text,
  ScrollArea,
  Badge,
  Alert
} from '@mantine/core';
import { IconFolder, IconAlertCircle } from '@tabler/icons-react';

import {
  useDirectoryBrowsing,
  useFileBrowserNavigation,
  useBreadcrumbs
} from '@/hooks/file-browser';
import { trpc } from '@/utils/trpc-client/index';

import {
  Breadcrumbs,
  DirectoryEntry,
  ErrorDisplay,
  LoadingState,
  ManualPathInput,
  Actions,
  type DirectoryEntryType
} from './file-browser';


interface FileBrowserModalProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title?: string;
  description?: string;
  initialPath?: string;
}

/**
 * File Browser Modal Component
 */
export function FileBrowserModal({
  opened,
  onClose,
  onSelect,
  title = 'Select Directory',
  description = 'Navigate to and select a directory',
  initialPath
}: FileBrowserModalProps): React.ReactElement {
  // Use custom hooks for complex logic
  const {
    currentPath,
    manualPath,
    setManualPath,
    handleNavigate,
    handleManualPathSubmit
  } = useFileBrowserNavigation(initialPath);

  const {
    browseData,
    isLoading,
    error
  } = useDirectoryBrowsing(currentPath, opened, trpc);

  const { breadcrumbs, displayPath } = useBreadcrumbs(browseData?.currentPath);

  // Extract data from browseData
  const entries: DirectoryEntryType[] = browseData?.entries ?? [];
  const parent = browseData?.parent;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="lg"
      styles={{
        body: { height: '600px', display: 'flex', flexDirection: 'column' }
      }}
    >
      <Stack gap="md" style={{ flex: 1, minHeight: 0 }} component="div" children={
        <>
          {/* Description */}
          <Text size="sm" c="dimmed">
            {description}
          </Text>

          {/* Manual path input */}
          <ManualPathInput
            manualPath={manualPath}
            onManualPathChange={setManualPath}
            onManualPathSubmit={handleManualPathSubmit}
          />

        {/* Current path display with breadcrumbs */}
        {displayPath && (
          <Stack gap="xs">
            <Group gap="xs">
              <Text size="sm" fw={500}>
                Current Path:
              </Text>
              <Badge variant="light">{String(displayPath)}</Badge>
            </Group>

            <Breadcrumbs
              breadcrumbs={breadcrumbs}
              onNavigate={handleNavigate}
            />
          </Stack>
        )}

        {/* Error display */}
        {error && (
          <ErrorDisplay error={error} />
        )}

        {/* Loading state */}
        {isLoading && (
          <LoadingState message="Loading directory..." />
        )}

        {/* Directory listing */}
        {!isLoading && entries.length > 0 && (
          <ScrollArea style={{ flex: 1 }} type="auto">
            <Stack gap="xs">
              {/* Go up button */}
              {parent && (
                <Button
                  variant="subtle"
                  leftSection={<IconFolder size={16} />}
                  onClick={() => handleNavigate(parent)}
                  fullWidth
                  justify="flex-start"
                >
                  .. (Parent Directory)
                </Button>
              )}

              {/* Directory entries */}
              {entries.map((entry) => (
                <DirectoryEntry
                  key={entry.path}
                  entry={entry}
                  onNavigate={handleNavigate}
                />
              ))}
            </Stack>
          </ScrollArea>
        )}

        {/* Empty state */}
        {!isLoading && entries.length === 0 && !error && displayPath && (
          <Alert icon={<IconAlertCircle />} color="gray" variant="light">
            <Text size="sm">This directory is empty or contains only hidden files.</Text>
          </Alert>
        )}

        {/* Actions */}
        <Actions
          onClose={onClose}
          onSelectCurrent={() => {
            if (displayPath) {
              onSelect(displayPath);
              onClose();
            }
          }}
          isSelectDisabled={!displayPath}
        />
        </>
      } />
    </Modal>
  );
}
