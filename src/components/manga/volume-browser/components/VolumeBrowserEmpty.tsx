/**
 * Volume Browser Empty State Component
 *
 * Displays when no volume data is available.
 *
 * @module volume-browser/components/VolumeBrowserEmpty
 */

import React from 'react';

import { Paper, Text } from '@mantine/core';
import { IconBook } from '@tabler/icons-react';

/**
 * Empty state component when no volumes are available
 */
export function VolumeBrowserEmpty(): React.ReactElement {
  return (
    <Paper p="xl" withBorder ta="center">
      <IconBook size={48} color="gray" style={{ opacity: 0.5 }} />
      <Text c="dimmed" mt="md">
        No volume data available
      </Text>
      <Text size="sm" c="dimmed">
        Volume information will appear here once fetched from providers
      </Text>
    </Paper>
  );
}
