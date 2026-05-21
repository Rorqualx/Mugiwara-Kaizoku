/**
 * Error Card Component
 *
 * Displays an error state for search result cards.
 */

'use client';

import * as React from 'react';

import { Card, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { getErrorMessage } from '@/utils/errors/helpers';

export interface ErrorCardProps {
  /** The error to display */
  error: Error;
  /** Additional class name for the card */
  className?: string;
}

/**
 * Error state card component
 *
 * @param props - Component props
 * @returns React element
 */
export function ErrorCard({ error, className = '' }: ErrorCardProps): React.ReactNode {
  return (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      className={className}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Card.Section
        style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fef1f1'
        }}
      >
        <IconAlertCircle size={48} color="red" />
      </Card.Section>

      <Stack mt="md" style={{ flex: 1 }}>
        <Text color="red" fw={500}>
          Error loading search result
        </Text>
        <Text size="sm" color="dimmed">
          {getErrorMessage(error)}
        </Text>
      </Stack>
    </Card>
  );
}
