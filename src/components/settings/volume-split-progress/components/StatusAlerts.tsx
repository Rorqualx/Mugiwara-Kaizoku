/**
 * Status alerts for success, error, and loading states
 */
import React from 'react';

import { Alert, Text, Group, Loader } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

interface StatusAlertsProps {
  isLoading: boolean;
  isError: boolean;
  isComplete: boolean;
  error: Error | null;
  errorMessage?: string | undefined;
  chaptersCreated: number;
  autoCloseOnComplete: boolean;
  autoCloseDelay: number;
}

/**
 * Display loading, error, and success alerts
 */
export function StatusAlerts({
  isLoading,
  isError,
  isComplete,
  error,
  errorMessage,
  chaptersCreated,
  autoCloseOnComplete,
  autoCloseDelay
}: StatusAlertsProps): React.ReactElement | null {
  // Loading State
  if (isLoading && !errorMessage) {
    return (
      <Group gap="xs">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading progress...
        </Text>
      </Group>
    );
  }

  // Error State
  if (isError || error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Split Failed" color="red">
        <Text size="sm">{errorMessage ?? error?.message ?? 'Unknown error occurred'}</Text>
      </Alert>
    );
  }

  // Success State
  if (isComplete) {
    return (
      <Alert icon={<IconCheck size={16} />} title="Split Complete" color="green">
        <Text size="sm">Successfully created {chaptersCreated} chapter files!</Text>
        {autoCloseOnComplete && (
          <Text size="xs" c="dimmed" mt="xs">
            Closing automatically in {(autoCloseDelay / 1000).toFixed(0)} seconds...
          </Text>
        )}
      </Alert>
    );
  }

  return null;
}
