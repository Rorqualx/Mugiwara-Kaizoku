import React from 'react';

import { Timeline, Text, Group, Badge, Center, Loader, Stack, Pagination } from '@mantine/core';
import {
  IconLogin,
  IconLogout,
  IconBook,
  IconDownload,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconShieldCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';

import { EventType } from '@/server/services/events/eventTypes';
import { formatDate, formatRelativeDate } from '@/utils/formatters/date-formatter';

import type { SystemEvent } from '@prisma/client';

interface ActivityTimelineProps {
  events: SystemEvent[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

/** Pick an icon for an event type (undefined → Mantine's default bullet). */
function iconForType(type: string): React.ReactNode {
  switch (type) {
    case EventType.USER_LOGGED_IN:
      return <IconLogin size={12} />;
    case EventType.USER_LOGGED_OUT:
      return <IconLogout size={12} />;
    case EventType.CHAPTER_READ:
      return <IconBook size={12} />;
    case EventType.MANGA_ADDED:
      return <IconPlus size={12} />;
    case EventType.DOWNLOAD_STARTED:
    case EventType.DOWNLOAD_QUEUED:
    case EventType.DOWNLOAD_COMPLETED:
      return <IconDownload size={12} />;
    case EventType.MANGA_DELETED:
    case EventType.USER_DELETED:
      return <IconTrash size={12} />;
    case EventType.USER_ROLE_CHANGED:
      return <IconShieldCheck size={12} />;
    case EventType.MANGA_UPDATED:
    case EventType.USER_UPDATED:
      return <IconRefresh size={12} />;
    case EventType.USER_LOGIN_FAILED:
    case EventType.USER_SUSPICIOUS_ACTIVITY:
      return <IconAlertTriangle size={12} />;
    default:
      return undefined;
  }
}

/** Map an event level to a Mantine color. */
function colorForLevel(level: string): string {
  switch (level) {
    case 'ERROR':
    case 'CRITICAL':
      return 'red';
    case 'WARNING':
      return 'yellow';
    case 'DEBUG':
      return 'gray';
    default:
      return 'blue';
  }
}

/**
 * Paginated activity timeline rendered from the user's SystemEvent rows.
 */
export function ActivityTimeline({
  events,
  total,
  page,
  pageSize,
  isLoading,
  onPageChange,
}: ActivityTimelineProps): React.ReactElement {
  if (isLoading) {
    return (
      <Center h={160}>
        <Loader size="sm" />
      </Center>
    );
  }

  if (events.length === 0) {
    return (
      <Center h={120}>
        <Text size="sm" c="dimmed">
          No recorded activity yet
        </Text>
      </Center>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Stack gap="md">
      <Timeline active={-1} bulletSize={22} lineWidth={2}>
        {events.map((event) => (
          <Timeline.Item
            key={event.id}
            bullet={iconForType(event.type)}
            color={colorForLevel(event.level)}
          >
            <Group gap="xs" justify="space-between" wrap="nowrap">
              <Text size="sm" fw={500} style={{ minWidth: 0 }} truncate>
                {event.message}
              </Text>
              <Badge size="xs" variant="light" color={colorForLevel(event.level)}>
                {event.type}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" title={formatDate(event.timestamp)}>
              {formatRelativeDate(event.timestamp)}
            </Text>
          </Timeline.Item>
        ))}
      </Timeline>

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination value={page} onChange={onPageChange} total={totalPages} size="sm" />
        </Group>
      )}
    </Stack>
  );
}
