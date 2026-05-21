/**
 * Volume Browser Header Component
 *
 * Displays volume count, provider badge, and last updated timestamp.
 *
 * @module volume-browser/components/VolumeBrowserHeader
 */

import React from 'react';

import { Group, Text, Badge } from '@mantine/core';

import type { VolumeBrowserHeaderProps } from '../types';

/**
 * Header component for VolumeBrowser
 */
export function VolumeBrowserHeader({
  totalVolumes,
  provider,
  lastFetched
}: VolumeBrowserHeaderProps): React.ReactElement {
  return (
    <Group justify="space-between">
      <Group gap="sm">
        <Text fw={600}>
          Volumes ({totalVolumes})
        </Text>
        {provider && (
          <Badge variant="outline" size="sm" color="blue">
            {provider}
          </Badge>
        )}
      </Group>
      {lastFetched && (
        <Text size="xs" c="dimmed">
          Updated: {new Date(lastFetched).toLocaleDateString()}
        </Text>
      )}
    </Group>
  );
}
