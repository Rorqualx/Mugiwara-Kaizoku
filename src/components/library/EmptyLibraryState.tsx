/**
 * Empty Library State Component
 *
 * Displays when no libraries are configured.
 * Extracted from ResponsiveLibraryList for better maintainability.
 *
 * @module components/library/EmptyLibraryState
 */
import React, { JSX } from 'react';

import {
  Paper,
  Center,
  Stack,
  Text,
  Button
} from '@mantine/core';
import { IconBooks, IconPlus } from '@tabler/icons-react';

interface EmptyLibraryStateProps {
  onAddLibrary: () => void;
}

/**
 * Empty state shown when no libraries are configured
 */
export function EmptyLibraryState({ onAddLibrary }: EmptyLibraryStateProps): JSX.Element {
  return (
    <Paper p="xl" withBorder>
      <Center>
        <Stack align="center" gap="md">
          <IconBooks size={48} color="var(--mantine-color-gray-5)" />
          <Text c="dimmed">No libraries configured</Text>
          <Button leftSection={<IconPlus size={16} />} onClick={onAddLibrary}>
            Add First Library
          </Button>
        </Stack>
      </Center>
    </Paper>
  );
}
