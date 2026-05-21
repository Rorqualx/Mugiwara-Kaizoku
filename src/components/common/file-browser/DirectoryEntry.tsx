/**
 * Directory Entry Component for File Browser
 *
 * Displays a single directory entry with navigation and accessibility indicators
 */

import React from 'react';

import { Button, Text } from '@mantine/core';
import { IconFolder, IconCheck, IconX } from '@tabler/icons-react';

import { DirectoryEntryProps } from './types';

/**
 * Directory Entry Component
 */
export function DirectoryEntry({
  entry,
  onNavigate
}: DirectoryEntryProps): React.ReactElement {
  return (
    <Button
      variant="subtle"
      leftSection={<IconFolder size={16} />}
      rightSection={
        entry.isAccessible ? (
          <IconCheck size={14} color="green" />
        ) : (
          <IconX size={14} color="red" />
        )
      }
      onClick={() => entry.isDirectory && onNavigate(entry.path)}
      disabled={!entry.isDirectory}
      fullWidth
      justify="flex-start"
      styles={{
        root: {
          opacity: entry.isAccessible ? 1 : 0.5
        }
      }}
    >
      <Text size="sm" truncate>
        {entry.name}
      </Text>
    </Button>
  );
}