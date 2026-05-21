/**
 * Events Table Component
 *
 * Responsive table component for displaying system events.
 * Switches between table layout (desktop) and card layout (mobile).
 *
 * @module components/events/EventsTable
 */
import React from 'react';

import {
  Table,
  Badge,
  Text,
  Paper,
  Stack,
  Group,
  Box,
  Loader,
  Center,
  ActionIcon,
  Tooltip,
  rem
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconInfoCircle,
  IconAlertTriangle,
  IconAlertCircle,
  IconChevronRight
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

import type { SystemEvent } from '@/hooks/useSystemEvents';
import { EventLevel } from '@/server/services/events/eventTypes';

/**
 * Props for the EventsTable component
 */
export interface EventsTableProps {
  /**
   * Array of events to display
   */
  events: SystemEvent[];

  /**
   * Callback when an event is clicked
   */
  onEventClick?: (event: SystemEvent) => void;

  /**
   * Loading state
   */
  isLoading?: boolean;

  /**
   * Empty state message
   */
  emptyMessage?: string;
}

/**
 * Get color for event level badge
 */
function getLevelColor(level: string): string {
  switch (level.toUpperCase()) {
    case EventLevel.INFO:
      return 'blue';
    case EventLevel.WARNING:
      return 'yellow';
    case EventLevel.ERROR:
      return 'red';
    case EventLevel.CRITICAL:
      return 'grape';
    case EventLevel.DEBUG:
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Get icon for event level
 */
function getLevelIcon(level: string): React.ReactNode {
  const size = 16;
  switch (level.toUpperCase()) {
    case EventLevel.INFO:
      return <IconInfoCircle size={size} />;
    case EventLevel.WARNING:
      return <IconAlertTriangle size={size} />;
    case EventLevel.ERROR:
    case EventLevel.CRITICAL:
      return <IconAlertCircle size={size} />;
    case EventLevel.DEBUG:
      return <IconInfoCircle size={size} opacity={0.5} />;
    default:
      return <IconInfoCircle size={size} />;
  }
}

/**
 * Format event type for display
 */
function formatEventType(type: string): string {
  return type
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' › ');
}

/**
 * Format timestamp to relative time
 */
function formatTimestamp(timestamp: Date): string {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

/**
 * Mobile card view for a single event
 */
function EventCard({
  event,
  onClick
}: {
  event: SystemEvent;
  onClick?: (event: SystemEvent) => void;
}): React.ReactElement {
  return (
    <Paper
      withBorder
      p="md"
      style={{
        cursor: onClick !== undefined ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease',
        minHeight: rem(44) // Touch-friendly minimum
      }}
      onClick={() => onClick?.(event)}
    >
      <Stack gap="xs">
        {/* Header: Level badge + timestamp */}
        <Group justify="space-between" wrap="nowrap">
          <Badge
            size="md"
            color={getLevelColor(event.level)}
            leftSection={getLevelIcon(event.level)}
            style={{ minHeight: rem(32) }} // Touch-friendly
          >
            {event.level.toUpperCase()}
          </Badge>
          <Text size="xs" c="dimmed">
            {formatTimestamp(event.timestamp)}
          </Text>
        </Group>

        {/* Source + Type */}
        <Group gap="xs">
          <Badge variant="light" size="sm">
            {event.source}
          </Badge>
          <Text size="xs" c="dimmed" truncate>
            {formatEventType(event.type)}
          </Text>
        </Group>

        {/* Message */}
        <Text size="sm" lineClamp={2}>
          {event.message}
        </Text>

        {/* Action indicator */}
        {onClick && (
          <Group justify="flex-end">
            <Text size="xs" c="dimmed">
              Tap for details
            </Text>
            <IconChevronRight size={16} opacity={0.5} />
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

/**
 * Desktop table row for a single event
 */
function EventRow({
  event,
  onClick
}: {
  event: SystemEvent;
  onClick?: (event: SystemEvent) => void;
}): React.ReactElement {
  return (
    <Table.Tr
      style={{
        cursor: onClick !== undefined ? 'pointer' : 'default'
      }}
      onClick={() => onClick?.(event)}
    >
      {/* Timestamp */}
      <Table.Td>
        <Tooltip label={new Date(event.timestamp).toLocaleString()}>
          <Text size="sm">{formatTimestamp(event.timestamp)}</Text>
        </Tooltip>
      </Table.Td>

      {/* Level */}
      <Table.Td>
        <Badge
          size="sm"
          color={getLevelColor(event.level)}
          leftSection={getLevelIcon(event.level)}
        >
          {event.level.toUpperCase()}
        </Badge>
      </Table.Td>

      {/* Source */}
      <Table.Td>
        <Badge variant="light" size="sm">
          {event.source}
        </Badge>
      </Table.Td>

      {/* Type */}
      <Table.Td>
        <Text size="sm" c="dimmed" truncate>
          {formatEventType(event.type)}
        </Text>
      </Table.Td>

      {/* Message */}
      <Table.Td style={{ maxWidth: '400px' }}>
        <Text size="sm" lineClamp={1}>
          {event.message}
        </Text>
      </Table.Td>

      {/* Action */}
      {onClick !== undefined && (
        <Table.Td>
          <ActionIcon variant="subtle" color="gray" size="sm">
            <IconChevronRight size={16} />
          </ActionIcon>
        </Table.Td>
      )}
    </Table.Tr>
  );
}

/**
 * Events Table Component
 *
 * Displays system events in a responsive layout. Shows a table on desktop
 * and card layout on mobile devices.
 *
 * @param props - Component props
 * @returns EventsTable component
 */
export function EventsTable({
  events,
  onEventClick,
  isLoading = false,
  emptyMessage = 'No events to display'
}: EventsTableProps): React.ReactElement {
  // Detect mobile viewport
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Loading state
  if (isLoading) {
    return (
      <Paper withBorder p="xl">
        <Center style={{ minHeight: '200px' }}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="sm" c="dimmed">
              Loading events...
            </Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  // Empty state
  if (events.length === 0) {
    return (
      <Paper withBorder p="xl">
        <Center style={{ minHeight: '200px' }}>
          <Stack align="center" gap="xs">
            <IconInfoCircle size={48} opacity={0.3} />
            <Text size="lg" c="dimmed">
              {emptyMessage}
            </Text>
            <Text size="sm" c="dimmed">
              Events will appear here as they occur in the system
            </Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  // Mobile: Card layout
  if (isMobile) {
    return (
      <Stack gap="sm">
        {events.map((event) =>
          onEventClick !== undefined ? (
            <EventCard key={event.id} event={event} onClick={onEventClick} />
          ) : (
            <EventCard key={event.id} event={event} />
          )
        )}
      </Stack>
    );
  }

  // Desktop: Table layout
  return (
    <Paper withBorder>
      <Box style={{ overflowX: 'auto' }}>
        <Table highlightOnHover striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: '140px' }}>Time</Table.Th>
              <Table.Th style={{ width: '120px' }}>Level</Table.Th>
              <Table.Th style={{ width: '120px' }}>Source</Table.Th>
              <Table.Th style={{ width: '200px' }}>Type</Table.Th>
              <Table.Th>Message</Table.Th>
              {onEventClick && (
                <Table.Th style={{ width: '50px' }}></Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {events.map((event) =>
              onEventClick !== undefined ? (
                <EventRow key={event.id} event={event} onClick={onEventClick} />
              ) : (
                <EventRow key={event.id} event={event} />
              )
            )}
          </Table.Tbody>
        </Table>
      </Box>
    </Paper>
  );
}
