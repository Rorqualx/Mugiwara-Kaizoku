/**
 * Calendar List View Component
 * 
 * Mobile-friendly list view for calendar events.
 * Provides a compact, scrollable view of events with filtering and actions.
 * 
 * @module components/calendar/CalendarListView
 */

import React, { useMemo } from 'react';

import {
  Stack,
  Paper,
  Group,
  Text,
  Badge,
  ActionIcon,
  Menu,
  Divider,
  Alert,
  Center,
  ScrollArea } from
'@mantine/core';
import {
  IconDots,
  IconCalendar,
  IconClock,
  IconEdit,
  IconTrash,
  IconExternalLink,
  IconAlertCircle,
  IconChartBar } from
'@tabler/icons-react';
import { format, isSameDay } from 'date-fns';

import { getStatusColor, getConfidenceColor } from '@/utils/calendar-colors';

import type { CalendarEvent } from '@prisma/client';

/**
 * Calendar List View Props
 */
interface CalendarListViewProps {
  events: CalendarEvent[];
  loading?: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  onEventEdit?: (event: CalendarEvent) => void;
  onEventDelete?: (event: CalendarEvent) => void;
  height?: number | string;
}

/**
 * Group events by date
 */
function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  events.forEach((event) => {
    const dateKey = format(new Date(event.scheduledDate), 'yyyy-MM-dd');
    const existing = grouped.get(dateKey) ?? [];
    grouped.set(dateKey, [...existing, event]);
  });

  // Sort dates
  return new Map(
    Array.from(grouped.entries()).
    sort(([a], [b]) => a.localeCompare(b))
  );
}

/**
 * Format date header
 */
function formatDateHeader(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(date, today)) {
    return 'Today';
  } else if (isSameDay(date, tomorrow)) {
    return 'Tomorrow';
  } else {
    return format(date, 'EEEE, MMMM d');
  }
}

/**
 * Event List Item Component
 */
function EventListItem({
  event,
  onEventClick,
  onEventEdit,
  onEventDelete





}: {event: CalendarEvent;onEventClick?: (event: CalendarEvent) => void;onEventEdit?: (event: CalendarEvent) => void;onEventDelete?: (event: CalendarEvent) => void;}): React.ReactElement {
  const metadata = typeof event["metadata"] === 'object' && event["metadata"] !== null && !Array.isArray(event["metadata"]) ? event["metadata"] : {};
  const isManualOverride = metadata["isManualOverride"] === true;
  const patternType = typeof metadata["patternType"] === 'string' ? metadata["patternType"] : 'Unknown';

  return (
    <Paper
      p="sm"
      withBorder
      className="event-list-item"
      onClick={() => onEventClick?.(event)}>

      <Group justify="space-between" align="flex-start">
        <div style={{ flex: 1 }}>
          <Group gap="xs" mb="xs">
            <Badge
              size="sm"
              color={getStatusColor(event["status"])}>

              {event["status"]}
            </Badge>
            {isManualOverride &&
            <Badge size="sm" color="orange" variant="dot">
                Manual
              </Badge>
            }
            {(event.confidence ?? 0) < 1 &&
            <Badge
              size="sm"
              variant="light"
              color={getConfidenceColor(event.confidence ?? 0)}>

                {Math.round((event.confidence ?? 0) * 100)}%
              </Badge>
            }
          </Group>
          
          <Text size="sm" fw={500} mb="xs">
            {event["title"]}
          </Text>
          
          <Group gap="xs">
            <Group gap={4}>
              <IconClock size={14} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">
                {format(new Date(event.scheduledDate), 'h:mm a')}
              </Text>
            </Group>

            {(event.confidence ?? 0) < 1 &&
            <Group gap={4}>
                <IconChartBar size={14} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">
                  {patternType}
                </Text>
              </Group>
            }
          </Group>
        </div>
        
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={(e) => e.stopPropagation()}>

              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          
          <Menu.Dropdown>
            {onEventEdit &&
            <Menu.Item
              leftSection={<IconEdit size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onEventEdit(event);
              }}>

                Reschedule
              </Menu.Item>
            }
            {event["source"] &&
            <Menu.Item
              leftSection={<IconExternalLink size={14} />}
              component="a"
              href={event["source"]}
              target="_blank"
              onClick={(e) => e.stopPropagation()}>

                View Source
              </Menu.Item>
            }
            {onEventDelete &&
            <>
                <Menu.Divider />
                <Menu.Item
                leftSection={<IconTrash size={14} />}
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  onEventDelete(event);
                }}>

                  Delete
                </Menu.Item>
              </>
            }
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Paper>);

}

/**
 * Calendar List View Component
 */
export function CalendarListView({
  events,
  onEventClick,
  onEventEdit,
  onEventDelete,
  height = 600
}: CalendarListViewProps): React.ReactElement {
  // Group events by date
  const groupedEvents = useMemo(() => groupEventsByDate(events), [events]);

  if (events.length === 0) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        color="gray"
        h={height}>

        <Center>
          <Text>No events to display</Text>
        </Center>
      </Alert>);

  }

  return (
    <ScrollArea h={height} type="scroll" className="event-list-scroll">
      <Stack gap="md" p="xs">
        {Array.from(groupedEvents.entries()).map(([dateKey, dateEvents]) => {
          const date = new Date(dateKey);

          return (
            <div key={dateKey}>
              {/* Date Header */}
              <Group gap="xs" mb="sm">
                <IconCalendar size={18} color="var(--mantine-color-dimmed)" />
                <Text size="sm" fw={600} c="dimmed">
                  {formatDateHeader(date)}
                </Text>
                <Badge size="sm" variant="light">
                  {dateEvents.length} events
                </Badge>
              </Group>
              
              {/* Events for this date */}
              <Stack gap="sm" pl="md">
                {dateEvents.map((event) =>
                <EventListItem
                  key={event["id"]}
                  event={event}
                  {...(onEventClick !== undefined && { onEventClick })}
                  {...(onEventEdit !== undefined && { onEventEdit })}
                  {...(onEventDelete !== undefined && { onEventDelete })} />

                )}
              </Stack>
              
              <Divider my="md" />
            </div>);

        })}
      </Stack>
    </ScrollArea>);

}

CalendarListView.displayName = 'CalendarListView';