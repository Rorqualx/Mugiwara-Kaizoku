/**
 * Monthly Calendar
 *
 * Dark-themed monthly calendar grid showing release events as colored dots.
 * Simple custom implementation — no react-big-calendar dependency.
 */

import React, { useMemo, useState } from 'react';

import { ActionIcon, Badge, Box, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_COLORS: Record<string, string> = {
  SCHEDULED: '#9775fa', CONFIRMED: '#339af0', RELEASED: '#51cf66',
  DELAYED: '#ff6b6b', CANCELLED: '#868e96',
};

function getMonthDates(year: number, month: number): Array<{ date: Date; inMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const dates: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = startPad - 1; i >= 0; i--) {
    dates.push({ date: new Date(year, month, -i), inMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    dates.push({ date: new Date(year, month, d), inMonth: true });
  }
  const remaining = 7 - (dates.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      dates.push({ date: new Date(year, month + 1, i), inMonth: false });
    }
  }
  return dates;
}

export function MonthlyCalendar(): React.ReactElement {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  const { data } = trpc.calendar.getEvents.useQuery({
    start, end, filters: {},
  });

  const dates = useMemo(() => getMonthDates(year, month), [year, month]);
  const today = new Date();

  // Map events to date keys
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Array<{ status: string; title: string }>>();
    for (const event of data ?? []) {
      const d = new Date(event.scheduledDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) ?? [];
      list.push({ status: event.status, title: event.title });
      map.set(key, list);
    }
    return map;
  }, [data]);

  const monthLabel = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Box mb="xl">
      <Group justify="space-between" mb="md">
        <Title order={4} c="white">Calendar</Title>
        <Group gap="xs">
          <ActionIcon variant="subtle" c="white" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Text c="white" fw={600} size="sm" w={140} ta="center">{monthLabel}</Text>
          <ActionIcon variant="subtle" c="white" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      </Group>

      <Paper radius="md" bg="dark.6" p="sm">
        {/* Day headers */}
        <SimpleGrid cols={7} mb="xs">
          {DAY_NAMES.map(d => (
            <Text key={d} ta="center" size="xs" fw={600} c="dimmed">{d}</Text>
          ))}
        </SimpleGrid>

        {/* Date cells */}
        <SimpleGrid cols={7}>
          {dates.map(({ date, inMonth }, i) => {
            const isToday = date.getDate() === today.getDate()
              && date.getMonth() === today.getMonth()
              && date.getFullYear() === today.getFullYear();
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const events = eventsByDate.get(key);

            return (
              <DateCell key={i} date={date} inMonth={inMonth} isToday={isToday} events={events} />
            );
          })}
        </SimpleGrid>
      </Paper>
    </Box>
  );
}

function DateCell({ date, inMonth, isToday, events }: {
  date: Date; inMonth: boolean; isToday: boolean;
  events?: Array<{ status: string; title: string }> | undefined;
}): React.ReactElement {
  return (
    <Box p={4} style={{
      minHeight: 50, borderRadius: 4,
      backgroundColor: isToday ? 'rgba(34,139,230,0.12)' : undefined,
    }}>
      <Text size="xs" c={inMonth ? (isToday ? 'blue.4' : 'white') : 'dark.3'} ta="right">
        {date.getDate()}
      </Text>
      {events && (
        <Stack gap={2} mt={2}>
          {events.slice(0, 3).map((e, i) => (
            <Badge key={i} size="xs" variant="filled" fullWidth
              color={EVENT_COLORS[e.status] ?? 'gray'}
              style={{ fontSize: 9, height: 14, padding: '0 4px' }}>
              {e.title.slice(0, 12)}
            </Badge>
          ))}
        </Stack>
      )}
    </Box>
  );
}
