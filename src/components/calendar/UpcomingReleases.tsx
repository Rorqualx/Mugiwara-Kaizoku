/**
 * Upcoming Releases
 *
 * Shows upcoming calendar events grouped by day (Today, Tomorrow, dates).
 * Dark-themed card layout matching the app's aesthetic.
 */

import React from 'react';

import { Badge, Box, Center, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'violet', CONFIRMED: 'blue', RELEASED: 'green',
  DELAYED: 'red', CANCELLED: 'gray',
};

function formatDayLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return target.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface UpcomingEvent {
  id: number; title: string; scheduledDate: Date | string;
  status: string; mangaId: number; eventType: string;
}

export function UpcomingReleases(): React.ReactElement {
  const { data, isLoading } = trpc.calendar.getUpcomingReleases.useQuery({ days: 14 });

  const events: UpcomingEvent[] = (data ?? []).map((e: Record<string, unknown>) => ({
    id: e['id'] as number,
    title: e['title'] as string,
    scheduledDate: e['scheduledDate'] as string,
    status: e['status'] as string,
    mangaId: e['mangaId'] as number,
    eventType: e['eventType'] as string,
  }));

  // Group by day
  const grouped = new Map<string, UpcomingEvent[]>();
  for (const event of events) {
    const label = formatDayLabel(new Date(event.scheduledDate));
    const existing = grouped.get(label) ?? [];
    existing.push(event);
    grouped.set(label, existing);
  }

  if (isLoading) {
    return (
      <Box mb="xl">
        <Title order={4} c="white" mb="md">Upcoming Releases</Title>
        <Paper p="md" radius="md" bg="dark.6" h={100} />
      </Box>
    );
  }

  if (events.length === 0) {
    return (
      <Box mb="xl">
        <Title order={4} c="white" mb="md">Upcoming Releases</Title>
        <Paper p="xl" radius="md" bg="dark.6">
          <Center>
            <Stack align="center" gap="xs">
              <IconClock size={40} color="gray" />
              <Text c="dimmed" size="sm">No upcoming releases in the next 14 days</Text>
            </Stack>
          </Center>
        </Paper>
      </Box>
    );
  }

  return (
    <Box mb="xl">
      <Title order={4} c="white" mb="md">Upcoming Releases ({events.length})</Title>
      <Box style={{ overflowX: 'auto', display: 'flex', gap: 16, paddingBottom: 8 }} className="hide-scrollbar">
        {[...grouped.entries()].map(([label, dayEvents]) => (
          <DayColumn key={label} label={label} events={dayEvents} />
        ))}
      </Box>
    </Box>
  );
}

function DayColumn({ label, events }: { label: string; events: UpcomingEvent[] }): React.ReactElement {
  const isToday = label === 'Today';
  return (
    <Paper p="sm" radius="md" bg={isToday ? 'dark.5' : 'dark.6'}
      style={{ flexShrink: 0, minWidth: 200, border: isToday ? '1px solid var(--mantine-color-blue-7)' : undefined }}>
      <Text size="sm" fw={700} c={isToday ? 'blue.4' : 'white'} mb="sm">{label}</Text>
      <Stack gap="xs">
        {events.map(event => (
          <Group key={event.id} gap="xs">
            <Badge size="xs" color={STATUS_COLORS[event.status] ?? 'gray'} variant="filled" />
            <Text size="xs" c="white" lineClamp={1} style={{ flex: 1 }}>{event.title}</Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
