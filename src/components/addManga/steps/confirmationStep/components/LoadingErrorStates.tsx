/**
 * LoadingErrorStates Component
 *
 * Displays loading and error states for the confirmation step
 */
import React from 'react';

import { Stack, Loader, Text, Alert, Button } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Searching for metadata matches...' }: LoadingStateProps): React.ReactElement {
  return (
    <Stack align="center" py="xl">
      <Loader size="lg" />
      <Text>{message}</Text>
    </Stack>
  );
}

interface ErrorStateProps {
  error: Error;
  onRetry: () => void;
  title?: string;
}

export function ErrorState({
  error,
  onRetry,
  title = 'Error searching for matches'
}: ErrorStateProps): React.ReactElement {
  return (
    <Alert icon={<IconAlertCircle />} color="red" variant="light">
      <Text fw={600}>{title}</Text>
      <Text size="sm">{error.message}</Text>
      <Button mt="md" variant="light" onClick={onRetry}>
        Retry Search
      </Button>
    </Alert>
  );
}
