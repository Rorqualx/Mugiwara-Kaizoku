/**
 * Monitored Manga Row
 *
 * Horizontal scrolling row showing manga tracked for release calendar.
 * Matches the MangaRow pattern from the home page.
 */

import React from 'react';

import { Badge, Box, Center, Group, Image, Paper, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { IconCalendarOff } from '@tabler/icons-react';
import Link from 'next/link';

import { trpc } from '@/utils/trpc-client';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'blue', RELEASING: 'green', ONGOING: 'green',
  HIATUS: 'yellow', CANCELLED: 'red', UNKNOWN: 'gray',
};

const SCHEDULE_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly', BIWEEKLY: 'Bi-weekly', MONTHLY: 'Monthly',
  IRREGULAR: 'Irregular',
};

export function MonitoredMangaRow(): React.ReactElement {
  const { data, isLoading } = trpc.calendar.getMonitoredManga.useQuery();

  if (isLoading) {
    return (
      <Box>
        <Title order={4} c="white" mb="md">Monitored Manga</Title>
        <Stack gap="sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <Paper key={i} h={110} radius="md" bg="dark.6" />
          ))}
        </Stack>
      </Box>
    );
  }

  if (!data?.length) {
    return (
      <Box>
        <Title order={4} c="white" mb="md">Monitored Manga</Title>
        <Paper p="xl" radius="md" bg="dark.6">
          <Center>
            <Stack align="center" gap="xs">
              <IconCalendarOff size={40} color="gray" />
              <Text c="dimmed" size="sm">No manga in library to track releases</Text>
              <Text c="dimmed" size="xs">Add manga to your library to see release schedules here</Text>
            </Stack>
          </Center>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Title order={4} c="white" mb="md">Monitored Manga ({data.length})</Title>
      <ScrollArea.Autosize mah="calc(100vh - 200px)" type="scroll" offsetScrollbars>
        <Stack gap="sm">
          {data.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Box>
  );
}

interface MonitoredManga {
  id: number; title: string; cover: string; status: string;
  schedule: { releaseType: string; confidence: number | null } | null;
  chapterCount: number;
}

function MangaCard({ manga }: { manga: MonitoredManga }): React.ReactElement {
  const statusColor = STATUS_COLORS[manga.status] ?? 'gray';
  const scheduleLabel = manga.schedule ? SCHEDULE_LABELS[manga.schedule.releaseType] ?? null : null;

  return (
    <Link href={`/manga/${manga.id}`} style={{ textDecoration: 'none' }}>
      <Paper radius="md" bg="dark.6" style={{ overflow: 'hidden', cursor: 'pointer' }}>
        <Box style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <Box style={{ position: 'relative', flexShrink: 0 }}>
            <Image src={manga.cover} alt={manga.title} w={80} h={110} fit="cover" />
            <Badge size="xs" variant="filled" color={statusColor}
              style={{ position: 'absolute', top: 4, left: 4 }}>
              {manga.status}
            </Badge>
          </Box>
          <Stack gap={2} p={6} style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600} c="white" lineClamp={2}>{manga.title}</Text>
            <Group gap={4}>
              <Text size="xs" c="dimmed">{manga.chapterCount} ch</Text>
              {scheduleLabel && <Badge size="xs" variant="light" color="violet">{scheduleLabel}</Badge>}
            </Group>
          </Stack>
        </Box>
      </Paper>
    </Link>
  );
}
