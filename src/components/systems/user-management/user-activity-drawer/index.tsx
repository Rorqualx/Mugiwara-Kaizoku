/**
 * User Activity Drawer
 *
 * Admin-only drawer surfacing a single user's activity: summary stat cards
 * (logins, time logged in, manga added, downloads, reads, reading time, key
 * dates) plus a paginated, category-filterable actions timeline.
 */
import React, { useEffect, useMemo, useState } from 'react';

import {
  Drawer,
  Group,
  Avatar,
  Stack,
  Text,
  Badge,
  Divider,
  Select,
  Alert,
} from '@mantine/core';
import { UserRole } from '@prisma/client';
import { IconUser, IconAlertCircle } from '@tabler/icons-react';

import type { User } from '@/components/systems/responsive-user-list/types';
import { EventType } from '@/server/services/events/eventTypes';


import { ActivityTimeline } from './ActivityTimeline';
import { SummaryCards } from './SummaryCards';
import { ACTIVITY_PAGE_SIZE, useUserActivity } from './useUserActivity';

interface UserActivityDrawerProps {
  opened: boolean;
  onClose: () => void;
  user: User | null;
}

/** Category presets mapping a label to the event types they include. */
const CATEGORY_FILTERS: { value: string; label: string; types?: string[] }[] = [
  { value: 'all', label: 'All activity' },
  { value: 'logins', label: 'Logins', types: [EventType.USER_LOGGED_IN, EventType.USER_LOGGED_OUT, EventType.USER_LOGIN_FAILED] },
  { value: 'reads', label: 'Reads', types: [EventType.CHAPTER_READ] },
  { value: 'downloads', label: 'Downloads', types: [EventType.DOWNLOAD_STARTED, EventType.DOWNLOAD_QUEUED, EventType.DOWNLOAD_COMPLETED, EventType.DOWNLOAD_ERROR] },
  { value: 'library', label: 'Library', types: [EventType.MANGA_ADDED, EventType.MANGA_UPDATED, EventType.MANGA_DELETED] },
  { value: 'account', label: 'Account', types: [EventType.USER_CREATED, EventType.USER_UPDATED, EventType.USER_ROLE_CHANGED, EventType.USER_PASSWORD_CHANGED] },
];

export function UserActivityDrawer({
  opened,
  onClose,
  user,
}: UserActivityDrawerProps): React.ReactElement {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('all');

  // Reset paging/filter whenever the drawer targets a different user.
  useEffect(() => {
    setPage(1);
    setCategory('all');
  }, [user?.id]);

  const types = useMemo(
    () => CATEGORY_FILTERS.find((c) => c.value === category)?.types,
    [category],
  );

  const { summary, summaryLoading, log, logLoading, errorMessage } = useUserActivity({
    userId: opened ? user?.id ?? null : null,
    page,
    ...(types ? { types } : {}),
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        <Group gap="sm" wrap="nowrap">
          <Avatar src={user?.avatarUrl ?? null} alt={user?.username ?? ''} radius="xl" size="md">
            <IconUser size={20} />
          </Avatar>
          <Stack gap={0}>
            <Group gap="xs">
              <Text fw={600}>{user?.username ?? 'User'}</Text>
              {user && (
                <Badge size="xs" color={user.role === UserRole.ADMIN ? 'red' : 'blue'}>
                  {user.role}
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {user?.email}
            </Text>
          </Stack>
        </Group>
      }
    >
      <Stack gap="lg">
        {errorMessage && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title="Failed to load activity">
            {errorMessage}
          </Alert>
        )}

        <SummaryCards summary={summary} isLoading={summaryLoading} />

        <Divider label="Activity timeline" labelPosition="left" />

        <Select
          label="Filter"
          value={category}
          onChange={(value) => {
            setCategory(value ?? 'all');
            setPage(1);
          }}
          data={CATEGORY_FILTERS.map(({ value, label }) => ({ value, label }))}
          allowDeselect={false}
          maxDropdownHeight={280}
        />

        <ActivityTimeline
          events={log?.events ?? []}
          total={log?.total ?? 0}
          page={page}
          pageSize={ACTIVITY_PAGE_SIZE}
          isLoading={logLoading}
          onPageChange={setPage}
        />
      </Stack>
    </Drawer>
  );
}
