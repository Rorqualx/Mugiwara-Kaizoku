/**
 * Browse Directory Modal Component
 *
 * Provides a modal interface for browsing and selecting directories.
 *
 * Extracted from: FullFunctionalityLibraryManager.tsx (lines 407-552)
 *
 * @module components/library/library-manager/components/BrowseDirectoryModal
 */

import { memo, type JSX } from 'react';

import {
  Modal,
  Stack,
  Group,
  Box,
  Text,
  Button,
  Divider,
  ScrollArea,
  Loader,
  Alert,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconHome,
  IconFolder,
  IconChevronRight,
} from '@tabler/icons-react';

import type {
  BrowseDirectoryModalProps,
  DirectoryEntry,
} from '../types';

/**
 * Directory browser modal with navigation
 *
 * Features:
 * - Navigate through directory structure
 * - Select directories for scanning
 * - Display file system paths
 * - Handle loading and error states
 */
export const BrowseDirectoryModal = memo<BrowseDirectoryModalProps>(
  ({
    opened,
    browseResult,
    isBrowseLoading,
    browseError,
    currentBrowsePath,
    onNavigateToPath,
    onSelectDirectory,
    onClose,
    setCurrentBrowsePath,
  }): JSX.Element => {
    return (
      <Modal
        opened={opened}
        onClose={() => {
          void onClose();
        }}
        title="Select Scan Directory"
        size="lg"
      >
        <Stack gap="md">
          {/* Navigation Controls */}
          {(() => {
            if (isBrowseLoading || !browseResult) {
              return null;
            }

            const parent = browseResult.parent;

            return (
              <Group gap="xs">
                {/* Back Button - shown when we have a parent directory */}
                {parent ? (
                  <Button
                    variant="light"
                    leftSection={
                      <IconChevronRight
                        size={16}
                        style={{ transform: 'rotate(180deg)' }}
                      />
                    }
                    onClick={() => {
                      void onNavigateToPath(parent);
                    }}
                  >
                    Go Back
                  </Button>
                ) : null}

                {/* Home Button - shown when not at starting locations */}
                {currentBrowsePath ? (
                  <Button
                    variant="light"
                    leftSection={<IconHome size={16} />}
                    onClick={() => setCurrentBrowsePath('')}
                  >
                    Starting Locations
                  </Button>
                ) : null}
              </Group>
            );
          })()}

          {/* Current Path Display */}
          <Box>
            <Text size="xs" c="dimmed" mb={4}>
              {currentBrowsePath ? 'Current Location:' : 'Starting Locations'}
            </Text>
            <Text size="md" fw={600} style={{ wordBreak: 'break-all' }}>
              {currentBrowsePath || 'Select a starting location below'}
            </Text>
          </Box>

          <Divider />

          {/* Loading State */}
          {isBrowseLoading ? (
            <Group justify="center" p="xl">
              <Loader size="md" />
              <Text size="sm" c="dimmed">
                Loading directories...
              </Text>
            </Group>
          ) : null}

          {/* Directory List */}
          {(() => {
            if (isBrowseLoading || !browseResult) {
              return null;
            }

            const entries = browseResult.entries;

            return (
              <ScrollArea h={400} type="auto">
                <Stack gap="xs">
                  {entries.map((entry: DirectoryEntry, idx: number) => {
                    if (!entry.isDirectory) return null;

                    const isStartingLocation = !currentBrowsePath;
                    const entryPath = entry.path;
                    const entryName = entry.name;
                    const entryIsAccessible = entry.isAccessible;

                    return (
                      <Group key={idx} gap="xs" wrap="nowrap">
                        <Button
                          variant={
                            isStartingLocation ? 'light' : 'subtle'
                          }
                          justify="flex-start"
                          fullWidth
                          size={isStartingLocation ? 'md' : 'sm'}
                          leftSection={
                            isStartingLocation ? (
                              <IconHome size={20} />
                            ) : (
                              <IconFolder size={18} />
                            )
                          }
                          rightSection={<IconChevronRight size={16} />}
                          onClick={() => {
                            void onNavigateToPath(entryPath);
                          }}
                          disabled={!entryIsAccessible}
                          styles={{
                            inner: {
                              justifyContent: 'flex-start',
                            },
                            label: {
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            },
                          }}
                          {...(!entryIsAccessible ? { c: 'dimmed' } : {})}
                        >
                          {entryName}
                        </Button>

                        {/* Select Button - only show for actual directories, not starting locations */}
                        {!isStartingLocation && entryIsAccessible ? (
                          <Button
                            variant="filled"
                            color="blue"
                            size="sm"
                            onClick={() => {
                              void onSelectDirectory(entryPath);
                            }}
                          >
                            Select
                          </Button>
                        ) : null}
                      </Group>
                    );
                  })}
                </Stack>
              </ScrollArea>
            );
          })()}

          {/* Error State */}
          {!isBrowseLoading && Boolean(browseError) ? (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="Browse Error"
              color="red"
            >
              Failed to load directory contents
            </Alert>
          ) : null}

          {/* Use Current Directory Button */}
          {!isBrowseLoading && currentBrowsePath ? (
            <>
              <Divider />
              <Button
                variant="filled"
                color="green"
                fullWidth
                onClick={() => {
                  void onSelectDirectory(currentBrowsePath);
                }}
              >
                Use Current Directory
              </Button>
            </>
          ) : null}
        </Stack>
      </Modal>
    );
  },
);

BrowseDirectoryModal.displayName = 'BrowseDirectoryModal';
