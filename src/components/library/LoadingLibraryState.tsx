/**
 * Loading Library State Component
 *
 * Displays while libraries are being fetched.
 * Extracted from ResponsiveLibraryList for better maintainability.
 *
 * @module components/library/LoadingLibraryState
 */
import React, { JSX } from 'react';

import {
  Paper,
  Center,
  Stack,
  Text
} from '@mantine/core';

/**
 * Loading state shown while fetching libraries
 */
export function LoadingLibraryState(): JSX.Element {
  return (
    <Paper p="xl" withBorder>
      <Center>
        <Stack align="center" gap="md">
          <Text c="dimmed">Loading libraries...</Text>
        </Stack>
      </Center>
    </Paper>
  );
}
