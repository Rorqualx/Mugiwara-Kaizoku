/**
 * Upcoming Releases Sidebar Component
 *
 * Displays upcoming calendar events in the next 7 days.
 * Extracted from calendar.tsx to reduce complexity.
 *
 * Features:
 * - Event cards with title, date, and confidence
 * - Click handling to open event details
 * - Empty state message
 * - Confidence indicators for predicted events
 */

import React from 'react';

import { Alert, Group, Paper, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconChartBar, IconClock } from '@tabler/icons-react';
import { format } from 'date-fns';

import type { CalendarEvent } from '@prisma/client';

/**
 * Props for UpcomingReleasesSidebar component
 */
export interface UpcomingReleasesSidebarProps {
  /** Upcoming events in next 7 days */
  upcoming: CalendarEvent[] | undefined;
  /** Callback when event is clicked */
  onEventClick: (event: CalendarEvent) => void;
}

/**
 * Upcoming Releases Sidebar
 *
 * Displays a list of upcoming calendar events with click handling.
 * Shows empty state when no upcoming events.
 *
 * @param props - Component props
 * @returns Sidebar component with upcoming releases
 */
export function UpcomingReleasesSidebar({
  upcoming,
  onEventClick,
}: UpcomingReleasesSidebarProps): React.JSX.Element {
  // Empty state
  if (!upcoming || upcoming.length === 0) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="gray">
        No upcoming releases in the next 7 days
      </Alert>
    );
  }

  // Render upcoming events
  return (
    <Stack gap="sm">
      {upcoming.map((event) => {
        // Extract event properties with type safety
        const eventId = event.id;
        const eventTitle = event.title;
        const scheduledDate = event.scheduledDate;
        const confidence = event.confidence;

        return (
          <Paper
            key={eventId}
            p="sm"
            withBorder
            className="upcoming-release-card"
            onClick={() => onEventClick(event)}
            style={{ cursor: 'pointer' }}
          >
            {/* Event title */}
            <Text size="sm" fw={500} lineClamp={1}>
              {eventTitle}
            </Text>

            {/* Scheduled date */}
            <Group gap="xs" mt="xs">
              <IconClock size={14} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">
                {format(new Date(scheduledDate), 'MMM d, h:mm a')}
              </Text>
            </Group>

            {/* Confidence indicator (only for predicted events) */}
            {(confidence ?? 0) < 1 && (
              <Group gap="xs" mt="xs">
                <IconChartBar size={14} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">
                  {Math.round((confidence ?? 0) * 100)}% confidence
                </Text>
              </Group>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
