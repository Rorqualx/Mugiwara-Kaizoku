/**
 * Loading State Component for File Browser
 *
 * Displays loading indicator while browsing directories
 */

import React from 'react';

import { Group, Loader, Text } from '@mantine/core';

import { LoadingStateProps } from './types';

/**
 * Loading State Component
 */
export function LoadingState({
  message = 'Loading directory...'
}: LoadingStateProps): React.ReactElement {
  return (
    <Group justify="center" p="xl">
      <Loader size="md" />
      <Text size="sm" c="dimmed">
        {message}
      </Text>
    </Group>
  );
}