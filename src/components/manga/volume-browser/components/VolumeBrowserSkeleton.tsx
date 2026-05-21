/**
 * Volume Browser Skeleton Component
 *
 * Loading state placeholder for VolumeBrowser.
 *
 * @module volume-browser/components/VolumeBrowserSkeleton
 */

import React from 'react';

import { Stack, Paper, Group, Skeleton } from '@mantine/core';

/**
 * Displays loading skeletons while volume data is being fetched
 */
export function VolumeBrowserSkeleton(): React.ReactElement {
  return (
    <Stack gap="md">
      {[1, 2, 3].map((i) => (
        <Paper key={i} shadow="xs" p="md" withBorder>
          <Group gap="md" align="flex-start" wrap="nowrap">
            <Skeleton height={120} width={80} radius="sm" />
            <Stack gap="xs" style={{ flex: 1 }}>
              <Skeleton height={20} width="60%" />
              <Skeleton height={16} width="40%" />
              <Skeleton height={12} width="80%" />
            </Stack>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
