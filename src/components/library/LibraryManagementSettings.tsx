/**
 * Library Management Settings Component
 * 
 * A wrapper component that provides consistent styling for the library manager
 * within the media management settings page. This ensures visual consistency
 * with other settings sections.
 * 
 * Features:
 * - Consistent Paper wrapper with border
 * - Proper spacing and typography
 * - Clear section title and description
 * - Integration with SafeLibraryManager
 */
import React from 'react';

import { Paper, Stack, Title, Text, Divider } from '@mantine/core';

import { SafeLibraryManager } from './SafeLibraryManager';

/**
 * Library Management Settings Component
 * 
 * Wraps the SafeLibraryManager with consistent styling to match
 * other sections in the media management page.
 */
export function LibraryManagementSettings(): React.ReactElement {
  return (
    <Paper p="md" withBorder mb="xl">
      <Stack gap="md">
        <div>
          <Title order={3} mb="xs">Import Manga</Title>
          <Text size="sm" c="dimmed">
            Pick a target library and directory to scan, match metadata, and import
            manga into your collection.
          </Text>
        </div>

        <Divider />

        <SafeLibraryManager />
      </Stack>
    </Paper>
  );
}
