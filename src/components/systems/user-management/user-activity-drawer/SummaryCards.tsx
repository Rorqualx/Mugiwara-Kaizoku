import React from 'react';

import { SimpleGrid, Card, Group, Text, ThemeIcon, Skeleton, Stack } from '@mantine/core';
import {
  IconLogin,
  IconClock,
  IconBook,
  IconFileText,
  IconDownload,
  IconPlus,
  IconCalendarPlus,
  IconCalendar,
} from '@tabler/icons-react';

import type { UserActivitySummary } from '@/server/trpc/routers/users/activity';
import { formatDate } from '@/utils/formatters/date-formatter';


import { formatCount, formatDuration } from './format';

interface SummaryCardsProps {
  summary: UserActivitySummary | undefined;
  isLoading: boolean;
}

interface StatConfig {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

const NEVER = 'Never';

function buildStats(summary: UserActivitySummary): StatConfig[] {
  const lastLogin = summary.lastLogin ? formatDate(summary.lastLogin) : NEVER;
  return [
    { label: 'Logins', value: formatCount(summary.loginCount), icon: <IconLogin size={18} />, color: 'blue' },
    { label: 'Time logged in', value: formatDuration(summary.timeLoggedInSeconds), icon: <IconClock size={18} />, color: 'cyan' },
    { label: 'Manga added', value: formatCount(summary.mangaAddedCount), icon: <IconPlus size={18} />, color: 'grape' },
    { label: 'Downloads', value: formatCount(summary.downloadsCount), icon: <IconDownload size={18} />, color: 'orange' },
    { label: 'Chapters read', value: formatCount(summary.chaptersRead), icon: <IconBook size={18} />, color: 'green' },
    { label: 'Pages read', value: formatCount(summary.pagesRead), icon: <IconFileText size={18} />, color: 'teal' },
    { label: 'Reading time', value: formatDuration(summary.readingTimeSeconds), icon: <IconClock size={18} />, color: 'indigo' },
    { label: 'Last login', value: lastLogin, icon: <IconCalendar size={18} />, color: 'blue' },
    { label: 'Account created', value: formatDate(summary.createdAt), icon: <IconCalendarPlus size={18} />, color: 'gray' },
  ];
}

/**
 * Summary stat cards for a user's activity (counts, durations, key dates).
 */
export function SummaryCards({ summary, isLoading }: SummaryCardsProps): React.ReactElement {
  if (isLoading || !summary) {
    return (
      <SimpleGrid cols={{ base: 2, sm: 3 }}>
        {Array.from({ length: 9 }).map((_, idx) => (
          <Skeleton key={idx} height={72} radius="md" />
        ))}
      </SimpleGrid>
    );
  }

  const stats = buildStats(summary);

  return (
    <SimpleGrid cols={{ base: 2, sm: 3 }}>
      {stats.map((stat) => (
        <Card key={stat.label} padding="sm" radius="md" withBorder>
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <ThemeIcon variant="light" color={stat.color} radius="md" size="md">
              {stat.icon}
            </ThemeIcon>
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text size="xs" c="dimmed" truncate>
                {stat.label}
              </Text>
              <Text size="sm" fw={600} truncate>
                {stat.value}
              </Text>
            </Stack>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}
