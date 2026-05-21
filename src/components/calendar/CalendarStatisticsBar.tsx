/**
 * Calendar Statistics Bar Component
 *
 * Displays calendar statistics in a horizontal bar format.
 * Extracted from calendar.tsx to reduce complexity.
 *
 * Shows:
 * - Total events count
 * - Delayed releases count
 * - Accuracy rate percentage
 */

import React from 'react';

import { Grid, Group, Paper, Text } from '@mantine/core';

/**
 * Calendar statistics interface
 */
export interface CalendarStats {
  totalEvents: number;
  delayedEvents: number;
  accuracyRate: number;
}

/**
 * Props for CalendarStatisticsBar component
 */
export interface CalendarStatisticsBarProps {
  /** Statistics data to display */
  stats: CalendarStats | undefined;
  /** Whether the device is mobile (hides on mobile) */
  isMobile: boolean;
}

/**
 * Calendar Statistics Bar
 *
 * Displays key calendar metrics in a compact horizontal bar.
 * Hidden on mobile devices to save space.
 *
 * @param props - Component props
 * @returns Statistics bar component or null if mobile
 */
export function CalendarStatisticsBar({
  stats,
  isMobile,
}: CalendarStatisticsBarProps): React.JSX.Element | null {
  // Don't render on mobile or without stats
  if (!stats || isMobile) {
    return null;
  }

  return (
    <Grid.Col span={12}>
      <Group gap="md" mb="md">
        <Paper p="xs" withBorder>
          <Text size="sm" c="dimmed">
            Total Events
          </Text>
          <Text size="lg" fw={600}>
            {stats.totalEvents}
          </Text>
        </Paper>

        <Paper p="xs" withBorder>
          <Text size="sm" c="dimmed">
            Delayed Releases
          </Text>
          <Text size="lg" fw={600} c="red">
            {stats.delayedEvents}
          </Text>
        </Paper>

        <Paper p="xs" withBorder>
          <Text size="sm" c="dimmed">
            Accuracy Rate
          </Text>
          <Text size="lg" fw={600}>
            {Math.round(stats.accuracyRate * 100)}%
          </Text>
        </Paper>
      </Group>
    </Grid.Col>
  );
}
