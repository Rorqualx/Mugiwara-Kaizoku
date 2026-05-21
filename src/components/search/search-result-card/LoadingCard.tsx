/**
 * Loading Card Component
 *
 * Displays a skeleton loading state for search result cards.
 */

'use client';

import * as React from 'react';

import { Card, Stack, Skeleton, Group } from '@mantine/core';

export interface LoadingCardProps {
  /** Additional class name for the card */
  className?: string;
}

/**
 * Loading state card component
 *
 * @param props - Component props
 * @returns React element
 */
export function LoadingCard({ className = '' }: LoadingCardProps): React.ReactNode {
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
      <Card.Section>
        <Skeleton height={200} />
      </Card.Section>

      <Stack mt="md" style={{ flex: 1 }}>
        <Group justify="space-between" mt="md" mb="xs">
          <Skeleton height={20} width="70%" />
          <Skeleton height={20} width="20%" />
        </Group>

        <Skeleton height={60} width="100%" mb="auto" />

        <Group justify="space-between" mt="md">
          <Group gap={5}>
            <Skeleton height={16} width={50} />
            <Skeleton height={16} width={50} />
            <Skeleton height={16} width={50} />
          </Group>
        </Group>

        <Group justify="right" mt="md">
          <Skeleton height={30} width={80} />
          <Skeleton height={30} width={60} />
        </Group>
      </Stack>
    </Card>
  );
}
