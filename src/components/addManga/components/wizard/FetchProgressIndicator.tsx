import React from 'react';

import { Paper, Stack, Group, Text, Badge, Progress } from '@mantine/core';

interface FetchProgressIndicatorProps {
  title: string;
  current: number;
  total: number;
  description: string;
  color?: string;
}

/**
 * Progress indicator for batch fetching operations
 */
export const FetchProgressIndicator: React.FC<FetchProgressIndicatorProps> = ({
  title,
  current,
  total,
  description,
  color = 'blue'
}) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <Paper p="sm" bg={`${color}.9`}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" fw={500}>
            {title}
          </Text>
          <Badge color={color} variant="filled">
            {current} / {total}
          </Badge>
        </Group>
        <Progress
          value={percentage}
          animated
          color={color}
          size="sm"
        />
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      </Stack>
    </Paper>
  );
};

export default FetchProgressIndicator;