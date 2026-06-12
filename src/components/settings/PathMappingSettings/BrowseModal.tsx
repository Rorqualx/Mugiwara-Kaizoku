/**
 * BrowseModal Component
 *
 * Modal for browsing and selecting directories for download client path configuration.
 *
 * Features:
 * - Directory navigation (back, home, drill-down)
 * - Starting locations when no path selected
 * - Loading states
 * - Error handling with recovery options
 * - Accessibility indicators
 * - Path selection confirmation
 *
 * Extracted from: PathMappingSettings.tsx (lines 584-717)
 */

import React from 'react';

import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  Box,
  Divider,
  Loader,
  Alert,
  ScrollArea
} from '@mantine/core';
import {
  IconChevronRight,
  IconHome,
  IconAlertCircle,
  IconFolder,
  IconCheck
} from '@tabler/icons-react';

import type { BrowseResult } from './types';

/**
 * Props for BrowseModal component
 */
export interface BrowseModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Handler for closing the modal */
  onClose: () => void;
  /** Current path being browsed (empty string for starting locations) */
  currentBrowsePath: string;
  /** Browse query result (unknown type from tRPC) */
  browseResult: unknown;
  /** Whether browse query is loading */
  isBrowseLoading: boolean;
  /** Browse query error if any (tRPC error type, handled safely) */
  browseError: unknown;
  /** Handler for navigating to a different path */
  onNavigate: (path: string) => void;
  /** Handler for selecting the current path */
  onSelect: () => void;
}

/**
 * Type guard for the bare browse payload ({ currentPath, parent, entries }).
 * Errors no longer arrive in-band — they surface via the query's error state.
 */
function isBrowseResult(result: unknown): result is BrowseResult {
  return (
    result !== undefined &&
    result !== null &&
    typeof result === 'object' &&
    'entries' in result
  );
}

/**
 * Render navigation controls (back and home buttons)
 */
function NavigationControls({
  browseResult,
  currentBrowsePath,
  onNavigate
}: {
  browseResult: unknown;
  currentBrowsePath: string;
  onNavigate: (path: string) => void;
}): React.ReactElement | null {
  if (!isBrowseResult(browseResult)) return null;

  const data = browseResult;

  return (
    <Group gap="xs">
      {/* Back Button - shown when we have a parent directory */}
      {data.parent !== undefined && (
        <Button
          variant="light"
          leftSection={<IconChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />}
          onClick={() => onNavigate(data.parent ?? '')}
        >
          Go Back
        </Button>
      )}

      {/* Home Button - shown when not at starting locations */}
      {currentBrowsePath && (
        <Button
          variant="light"
          leftSection={<IconHome size={16} />}
          onClick={() => onNavigate('')}
        >
          Starting Locations
        </Button>
      )}
    </Group>
  );
}

/**
 * Render directory listing
 */
function DirectoryList({
  browseResult,
  currentBrowsePath,
  onNavigate
}: {
  browseResult: unknown;
  currentBrowsePath: string;
  onNavigate: (path: string) => void;
}): React.ReactElement | null {
  if (!isBrowseResult(browseResult)) return null;

  const entries = browseResult.entries ?? [];
  const isStartingLocation = !currentBrowsePath;

  return (
    <ScrollArea h={400} type="auto">
      <Stack gap="xs">
        {entries.map((entry, idx: number) => {
          if (!entry.isDirectory) return null;

          return (
            <Button
              key={idx}
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
          );
        })}
      </Stack>
    </ScrollArea>
  );
}

/**
 * BrowseModal Component
 *
 * Renders a modal for browsing directories with navigation controls.
 */
export function BrowseModal({
  opened,
  onClose,
  currentBrowsePath,
  browseResult,
  isBrowseLoading,
  browseError,
  onNavigate,
  onSelect
}: BrowseModalProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Select Folder"
      size="lg"
    >
      <Stack gap="md">
        {/* Navigation Controls */}
        {!isBrowseLoading && (
          <NavigationControls
            browseResult={browseResult}
            currentBrowsePath={currentBrowsePath}
            onNavigate={onNavigate}
          />
        )}

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

        {/* Loading */}
        {isBrowseLoading && (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        )}

        {/* Error Display */}
        {Boolean(browseError) && (
          <Alert icon={<IconAlertCircle />} title="Path Not Accessible" color="red">
            <Text size="sm">
              {browseError instanceof Error ? browseError.message : 'Unable to access the selected path'}
            </Text>
            <Button
              variant="light"
              size="sm"
              mt="sm"
              leftSection={<IconHome size={16} />}
              onClick={() => onNavigate('')}
            >
              Go to Starting Locations
            </Button>
          </Alert>
        )}

        {/* Directory List */}
        {!isBrowseLoading && (
          <DirectoryList
            browseResult={browseResult}
            currentBrowsePath={currentBrowsePath}
            onNavigate={onNavigate}
          />
        )}

        <Divider />

        {/* Actions */}
        <Group justify="space-between">
          <Button
            variant="subtle"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={onSelect}
            disabled={!currentBrowsePath}
            leftSection={<IconCheck size={16} />}
          >
            Select This Folder
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
