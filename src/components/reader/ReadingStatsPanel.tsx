// Reading Statistics Panel - Display reading metrics
import React, { useMemo } from 'react';

import { Paper, Stack, Text, Group, RingProgress, Grid, Badge, Divider, Box, Loader } from '@mantine/core';
import { IconBook, IconClock, IconActivity, IconChartLine, IconCalendar } from '@tabler/icons-react';
import { startOfWeek, endOfWeek, subDays } from 'date-fns';

import { trpc } from '@/utils/trpc-client';

interface ReadingStatsPanelProps {
  mangaId?: number;
  compact?: boolean;
}

export function ReadingStatsPanel({ mangaId: _mangaId, compact = false }: ReadingStatsPanelProps): React.ReactElement | null {
  // Get reading analytics
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = trpc.reader.getAnalytics.useQuery(
    {
      startDate: subDays(new Date(), 30),
      endDate: new Date()
    },
    {
      refetchOnMount: true,
      retry: false
    }
  );

  // Get reading history
  const { data: history, isLoading: historyLoading, error: historyError } = trpc.reader.getHistory.useQuery(
    { limit: 100, offset: 0 },
    {
      refetchOnMount: true,
      retry: false
    }
  );

  // Calculate statistics
  const stats = useMemo(() => {
    if (!analytics || !history) {
      return {
        totalPagesRead: 0,
        totalChaptersCompleted: 0,
        totalTimeMinutes: 0,
        avgPagesPerDay: 0,
        currentStreak: 0,
        longestStreak: 0,
        todayPages: 0,
        thisWeekPages: 0
      };
    }

    // Define types for array elements
    type AnalyticsDay = (typeof analytics)[number];
    type HistoryEntry = (typeof history.items)[number];

    const totalPagesRead = analytics.reduce((sum: number, day: AnalyticsDay) => sum + day.pagesRead, 0);
    const totalChaptersCompleted = analytics.reduce((sum: number, day: AnalyticsDay) => sum + day.chaptersCompleted, 0);
    const totalTimeMinutes = Math.round(
      history.items.reduce((sum: number, entry: HistoryEntry) => sum + entry.totalTime, 0) / 60
    );

    // Calculate average pages per day
    const daysWithReading = analytics.filter((day: AnalyticsDay) => day.pagesRead > 0).length;
    const avgPagesPerDay = daysWithReading > 0 ? Math.round(totalPagesRead / daysWithReading) : 0;

    // Calculate streaks
    const sortedDays = [...analytics].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedDays.length; i++) {
      const day = sortedDays[i];
      if (!day) continue;

      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);

      if (day.pagesRead > 0) {
        tempStreak++;

        // Check if this is part of current streak
        const dayDiff = Math.floor((today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dayDiff === currentStreak) {
          currentStreak++;
        }

        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }

    // Today's pages
    const todayEntry = analytics.find((day: AnalyticsDay) => {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      return dayDate.getTime() === today.getTime();
    });
    const todayPages = todayEntry?.pagesRead ?? 0;

    // This week's pages
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    const thisWeekPages = analytics
      .filter((day: AnalyticsDay) => {
        const dayDate = new Date(day.date);
        return dayDate >= weekStart && dayDate <= weekEnd;
      })
      .reduce((sum: number, day: AnalyticsDay) => sum + day.pagesRead, 0);

    return {
      totalPagesRead,
      totalChaptersCompleted,
      totalTimeMinutes,
      avgPagesPerDay,
      currentStreak,
      longestStreak,
      todayPages,
      thisWeekPages
    };
  }, [analytics, history]);

  // Calculate reading speed (pages per minute)
  const readingSpeed = useMemo(() => {
    if (!history || history.items.length === 0) return 0;

    type HistoryEntry = (typeof history.items)[number];

    const totalPages = history.items.reduce((sum: number, entry: HistoryEntry) => sum + entry.pagesRead, 0);
    const totalSeconds = history.items.reduce((sum: number, entry: HistoryEntry) => sum + entry.totalTime, 0);

    if (totalSeconds === 0) return 0;
    return Math.round((totalPages / totalSeconds) * 60 * 10) / 10; // pages per minute, 1 decimal
  }, [history]);

  // Loading state
  if (analyticsLoading || historyLoading) {
    return (
      <Paper p="md" withBorder>
        <Group justify="center">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading statistics...</Text>
        </Group>
      </Paper>
    );
  }

  // Error state - silently fail for statistics (not critical)
  if (analyticsError ?? historyError) {
    return null;
  }

  // No data - don't show panel
  if (!analytics || !history || (stats.totalPagesRead === 0 && stats.totalChaptersCompleted === 0)) {
    return null;
  }

  if (compact) {
    return (
      <Paper p="md" withBorder>
        <Group justify="space-between">
          <Group gap="xs">
            <IconBook size={18} />
            <Text size="sm" fw={500}>{stats.totalPagesRead} pages</Text>
          </Group>
          <Group gap="xs">
            <IconClock size={18} />
            <Text size="sm" c="dimmed">{stats.totalTimeMinutes}m</Text>
          </Group>
          <Group gap="xs">
            <IconActivity size={18} />
            <Text size="sm" c="orange">{stats.currentStreak} day streak</Text>
          </Group>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper p="lg" withBorder>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Text size="lg" fw={600}>Reading Statistics</Text>
          <Badge color="blue" variant="light">Last 30 days</Badge>
        </Group>

        <Divider />

        {/* Main stats grid */}
        <Grid>
          {/* Total Pages */}
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Stack gap="xs" align="center">
              <RingProgress
                size={80}
                thickness={8}
                sections={[{ value: 100, color: 'blue' }]}
                label={
                  <Box ta="center">
                    <IconBook size={20} style={{ display: 'block', margin: '0 auto' }} />
                  </Box>
                }
              />
              <Text size="xl" fw={700}>{stats.totalPagesRead}</Text>
              <Text size="xs" c="dimmed" ta="center">Pages Read</Text>
            </Stack>
          </Grid.Col>

          {/* Chapters Completed */}
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Stack gap="xs" align="center">
              <RingProgress
                size={80}
                thickness={8}
                sections={[{ value: 100, color: 'green' }]}
                label={
                  <Box ta="center">
                    <IconBook size={20} style={{ display: 'block', margin: '0 auto' }} />
                  </Box>
                }
              />
              <Text size="xl" fw={700}>{stats.totalChaptersCompleted}</Text>
              <Text size="xs" c="dimmed" ta="center">Chapters</Text>
            </Stack>
          </Grid.Col>

          {/* Reading Time */}
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Stack gap="xs" align="center">
              <RingProgress
                size={80}
                thickness={8}
                sections={[{ value: 100, color: 'violet' }]}
                label={
                  <Box ta="center">
                    <IconClock size={20} style={{ display: 'block', margin: '0 auto' }} />
                  </Box>
                }
              />
              <Text size="xl" fw={700}>{Math.round(stats.totalTimeMinutes / 60)}h</Text>
              <Text size="xs" c="dimmed" ta="center">Reading Time</Text>
            </Stack>
          </Grid.Col>

          {/* Current Streak */}
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Stack gap="xs" align="center">
              <RingProgress
                size={80}
                thickness={8}
                sections={[{
                  value: stats.currentStreak > 0 ? 100 : 0,
                  color: 'orange'
                }]}
                label={
                  <Box ta="center">
                    <IconActivity size={20} style={{ display: 'block', margin: '0 auto' }} />
                  </Box>
                }
              />
              <Text size="xl" fw={700}>{stats.currentStreak}</Text>
              <Text size="xs" c="dimmed" ta="center">Day Streak</Text>
            </Stack>
          </Grid.Col>
        </Grid>

        <Divider />

        {/* Additional stats */}
        <Grid>
          <Grid.Col span={{ base: 6, sm: 4 }}>
            <Group gap="xs">
              <IconCalendar size={16} color="var(--mantine-color-blue-6)" />
              <Stack gap={2}>
                <Text size="sm" fw={500}>{stats.todayPages}</Text>
                <Text size="xs" c="dimmed">Pages Today</Text>
              </Stack>
            </Group>
          </Grid.Col>

          <Grid.Col span={{ base: 6, sm: 4 }}>
            <Group gap="xs">
              <IconChartLine size={16} color="var(--mantine-color-green-6)" />
              <Stack gap={2}>
                <Text size="sm" fw={500}>{stats.thisWeekPages}</Text>
                <Text size="xs" c="dimmed">This Week</Text>
              </Stack>
            </Group>
          </Grid.Col>

          <Grid.Col span={{ base: 6, sm: 4 }}>
            <Group gap="xs">
              <IconBook size={16} color="var(--mantine-color-violet-6)" />
              <Stack gap={2}>
                <Text size="sm" fw={500}>{stats.avgPagesPerDay}</Text>
                <Text size="xs" c="dimmed">Avg/Day</Text>
              </Stack>
            </Group>
          </Grid.Col>
        </Grid>

        {/* Reading speed */}
        {readingSpeed > 0 && (
          <>
            <Divider />
            <Group justify="space-between">
              <Group gap="xs">
                <IconChartLine size={18} />
                <Text size="sm" fw={500}>Reading Speed</Text>
              </Group>
              <Badge color="blue" size="lg" variant="light">
                {readingSpeed} pages/min
              </Badge>
            </Group>
          </>
        )}

        {/* Longest streak */}
        {stats.longestStreak > stats.currentStreak && (
          <Group justify="space-between">
            <Group gap="xs">
              <IconActivity size={18} />
              <Text size="sm" fw={500}>Longest Streak</Text>
            </Group>
            <Badge color="orange" size="lg" variant="light">
              {stats.longestStreak} days
            </Badge>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
