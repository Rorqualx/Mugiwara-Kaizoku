/**
 * BrowseDirectoryModal Component
 *
 * Modal for browsing and selecting directories for file scanning.
 *
 * @module components/manga/manual-import/components/BrowseDirectoryModal
 */

import React from 'react';

import {
  Modal,
  Stack,
  Group,
  Box,
  Text,
  Button,
  Divider,
  ScrollArea,
  Alert,
  Loader
} from '@mantine/core';
import {
  IconChevronRight,
  IconHome,
  IconFolder,
  IconAlertCircle
} from '@tabler/icons-react';

import { isSuccess, isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import type { DirectoryEntry, BrowseResultData } from '../types';

interface BrowseDirectoryModalProps {
  opened: boolean;
  onClose: () => void;
  currentPath: string;
  browseResult: AsyncResult<BrowseResultData> | null;
  isLoading: boolean;
  onNavigate: (path: string) => void;
  onSelect: (path: string) => void;
  onGoHome: () => void;
}

export function BrowseDirectoryModal({
  opened,
  onClose,
  currentPath,
  browseResult,
  isLoading,
  onNavigate,
  onSelect,
  onGoHome
}: BrowseDirectoryModalProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Select Directory to Scan"
      size="lg"
    >
      <Stack gap="md">
        {/* Navigation buttons */}
        {!isLoading && browseResult && isSuccess(browseResult) && (
          <Group gap="xs">
            {browseResult.data.parent && (
              <Button
                variant="light"
                leftSection={<IconChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />}
                onClick={() => onNavigate(browseResult.data.parent ?? '')}
              >
                Go Back
              </Button>
            )}
            {currentPath && (
              <Button
                variant="light"
                leftSection={<IconHome size={16} />}
                onClick={onGoHome}
              >
                Starting Locations
              </Button>
            )}
          </Group>
        )}

        {/* Current path display */}
        <Box>
          <Text size="xs" c="dimmed" mb={4}>
            {currentPath ? 'Current Location:' : 'Starting Locations'}
          </Text>
          <Text size="md" fw={600} style={{ wordBreak: 'break-all' }}>
            {currentPath || 'Select a starting location below'}
          </Text>
        </Box>

        <Divider />

        {/* Loading state */}
        {isLoading && (
          <Group justify="center" p="xl">
            <Loader size="md" />
            <Text size="sm" c="dimmed">Loading directories...</Text>
          </Group>
        )}

        {/* Directory listing */}
        {!isLoading && browseResult && isSuccess(browseResult) && (
          <ScrollArea h={400} type="auto">
            <Stack gap="xs">
              {browseResult.data.entries.map((entry: DirectoryEntry, idx: number) => {
                if (!entry.isDirectory) return null;
                const isStartingLocation = !currentPath;

                return (
                  <Group key={idx} gap="xs" wrap="nowrap">
                    <Button
                      variant={isStartingLocation ? "light" : "subtle"}
                      justify="flex-start"
                      fullWidth
                      size={isStartingLocation ? "md" : "sm"}
                      leftSection={isStartingLocation ? <IconHome size={20} /> : <IconFolder size={18} />}
                      rightSection={<IconChevronRight size={16} />}
                      onClick={() => onNavigate(entry.path)}
                      disabled={!entry.isAccessible}
                      styles={{
                        inner: { justifyContent: 'flex-start' },
                        label: { overflow: 'hidden', textOverflow: 'ellipsis' }
                      }}
                      {...(!entry.isAccessible && { c: 'dimmed' })}
                    >
                      {entry.name}
                    </Button>
                    {!isStartingLocation && entry.isAccessible && (
                      <Button
                        variant="filled"
                        color="blue"
                        size="sm"
                        onClick={() => onSelect(entry.path)}
                      >
                        Select
                      </Button>
                    )}
                  </Group>
                );
              })}
            </Stack>
          </ScrollArea>
        )}

        {/* Error state */}
        {!isLoading && browseResult && isError(browseResult) && (
          <Alert icon={<IconAlertCircle size={16} />} title="Browse Error" color="red">
            Failed to load directory contents
          </Alert>
        )}

        {/* Use current directory button */}
        {!isLoading && currentPath && (
          <>
            <Divider />
            <Button
              variant="filled"
              color="green"
              fullWidth
              onClick={() => onSelect(currentPath)}
            >
              Use Current Directory
            </Button>
          </>
        )}
      </Stack>
    </Modal>
  );
}
