/**
 * Event Statistics Cards Component
 *
 * Displays event statistics in card format showing total events,
 * errors, warnings, and info level events.
 *
 * @module components/events/EventStatisticsCards
 */
import React from 'react';

import {
  Grid,
  Paper,
  Group,
  Text
} from '@mantine/core';
import {
  IconActivity,
  IconAlertTriangle,
  IconInfoCircle
} from '@tabler/icons-react';

/**
 * Event statistics data
 */
export interface EventStats {
  total: number;
  error: number;
  warning: number;
  info: number;
}

/**
 * Props for EventStatisticsCards component
 */
export interface EventStatisticsCardsProps {
  stats: EventStats;
}

/**
 * EventStatisticsCards Component
 *
 * Displays event statistics in a grid of cards.
 *
 * @param props - Component props
 * @returns EventStatisticsCards component
 */
export function EventStatisticsCards({
  stats
}: EventStatisticsCardsProps): React.ReactElement {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, xs: 6, sm: 6, md: 3 }}>
        <Paper withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={500} size="sm">
              Total Events
            </Text>
            <IconActivity size={20} />
          </Group>
          <Text size="xl" fw={700}>
            {stats.total.toLocaleString()}
          </Text>
          <Text size="xs" c="dimmed">
            All system events
          </Text>
        </Paper>
      </Grid.Col>

      <Grid.Col span={{ base: 12, xs: 6, sm: 6, md: 3 }}>
        <Paper withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={500} size="sm" c="red">
              Errors
            </Text>
            <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
          </Group>
          <Text size="xl" fw={700} c="red">
            {stats.error.toLocaleString()}
          </Text>
          <Text size="xs" c="dimmed">
            Error + critical events
          </Text>
        </Paper>
      </Grid.Col>

      <Grid.Col span={{ base: 12, xs: 6, sm: 6, md: 3 }}>
        <Paper withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={500} size="sm" c="yellow">
              Warnings
            </Text>
            <IconInfoCircle size={20} color="var(--mantine-color-yellow-6)" />
          </Group>
          <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-yellow-7)' }}>
            {stats.warning.toLocaleString()}
          </Text>
          <Text size="xs" c="dimmed">
            Warning events
          </Text>
        </Paper>
      </Grid.Col>

      <Grid.Col span={{ base: 12, xs: 6, sm: 6, md: 3 }}>
        <Paper withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={500} size="sm" c="blue">
              Info
            </Text>
            <IconInfoCircle size={20} color="var(--mantine-color-blue-6)" />
          </Group>
          <Text size="xl" fw={700} c="blue">
            {stats.info.toLocaleString()}
          </Text>
          <Text size="xs" c="dimmed">
            Informational events
          </Text>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}
