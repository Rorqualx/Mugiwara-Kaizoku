/**
 * PageErrorOverlay Component
 *
 * Displays a visible error state when a reader page fails to load,
 * with a retry button to attempt reloading.
 */

import React from 'react';

import { Box, Button, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface PageErrorOverlayProps {
  pageNumber: number;
  onRetry: () => void;
  backgroundColor?: string;
}

export function PageErrorOverlay({
  pageNumber,
  onRetry,
  backgroundColor = '#1a1a1a',
}: PageErrorOverlayProps): React.JSX.Element {
  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: 300,
        backgroundColor,
      }}
    >
      <Stack align="center" gap="md">
        <IconAlertCircle size={48} color="var(--mantine-color-red-5)" />
        <Text c="dimmed" size="lg">
          Failed to load page {pageNumber}
        </Text>
        <Button variant="light" onClick={onRetry}>
          Retry
        </Button>
      </Stack>
    </Box>
  );
}
