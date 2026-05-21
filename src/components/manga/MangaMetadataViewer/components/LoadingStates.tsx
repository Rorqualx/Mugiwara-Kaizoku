/**
 * Loading states for metadata viewer
 * @module components/manga/MangaMetadataViewer/components/LoadingStates
 */

import React from 'react';

import { Card, Group, Loader, Text, Button, Alert } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Fetching metadata...' }: LoadingStateProps): React.ReactElement {
  return (
    <Card withBorder>
      <Group justify="center" py="xl">
        <Loader size="md" />
        <Text>{message}</Text>
      </Group>
    </Card>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * Extract error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function ErrorState({ error, onRetry }: ErrorStateProps): React.ReactElement {
  const errorMessage = getErrorMessage(error);

  return (
    <Alert icon={<IconInfoCircle />} title="Metadata Error" color="red">
      Failed to fetch metadata: {errorMessage}
      <Button
        size="xs"
        mt="xs"
        onClick={(): void => {
          onRetry();
        }}
      >
        Retry
      </Button>
    </Alert>
  );
}

export function EmptyState(): React.ReactElement {
  return (
    <Alert icon={<IconInfoCircle />} color="blue">
      No metadata available for this manga.
    </Alert>
  );
}
