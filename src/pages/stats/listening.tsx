/**
 * Listening Statistics Page
 *
 * Displays audiobook listening statistics and analytics including:
 * - Total time listened (all time, this week, today)
 * - Chapters and audiobooks completed
 * - Daily listening streak
 * - Daily activity chart
 *
 * @module pages/stats/listening
 */

import React, { useMemo } from 'react';
import type { ReactElement } from 'react';

import {
  Box,
  Card,
  Container,
  Group,
  LoadingOverlay,
  Paper,
  RingProgress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBook,
  IconChartBar,
  IconClock,
  IconMusic,
  IconPlayerPlay,
  IconStar,
  IconTrophy,
} from '@tabler/icons-react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title as ChartTitle,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { api } from '@/utils/api';

import type { ChartOptions } from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Filler,
  Legend
);

// ============================================================================
// Types
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}

interface DailyAnalyticsPoint {
  date: Date;
  minutesListened: number;
  chaptersCompleted: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format minutes into a human-readable duration
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Format date for chart labels
 */
function formatChartDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// Components
// ============================================================================

/**
 * Stat card component for displaying a single statistic
 */
function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: StatCardProps): JSX.Element {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed" fw={500}>
          {title}
        </Text>
        <ThemeIcon color={color} variant="light" size="lg" radius="md">
          {icon}
        </ThemeIcon>
      </Group>
      <Text size="xl" fw={700}>
        {value}
      </Text>
      {subtitle !== undefined && (
        <Text size="xs" c="dimmed" mt={4}>
          {subtitle}
        </Text>
      )}
    </Card>
  );
}

/**
 * Streak display component with ring progress
 */
function StreakDisplay({
  currentStreak,
  longestStreak,
}: {
  currentStreak: number;
  longestStreak: number;
}): JSX.Element {
  const progress = longestStreak > 0 ? (currentStreak / longestStreak) * 100 : 0;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs">
          <Group gap="xs">
            <ThemeIcon color="orange" variant="light" size="lg" radius="md">
              <IconStar size={20} />
            </ThemeIcon>
            <Text size="sm" c="dimmed" fw={500}>
              Listening Streak
            </Text>
          </Group>
          <Text size="xl" fw={700}>
            {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
          </Text>
          <Text size="xs" c="dimmed">
            Longest: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
          </Text>
        </Stack>
        <RingProgress
          size={80}
          thickness={8}
          roundCaps
          sections={[{ value: progress, color: 'orange' }]}
          label={
            <Text ta="center" size="xs" fw={700}>
              {Math.round(progress)}%
            </Text>
          }
        />
      </Group>
    </Card>
  );
}

/**
 * Daily listening chart component
 */
function ListeningChart({
  data,
  isLoading,
}: {
  data: DailyAnalyticsPoint[];
  isLoading: boolean;
}): JSX.Element {
  const chartData = useMemo(() => {
    const labels = data.map((d) => formatChartDate(d.date));
    const values = data.map((d) => d.minutesListened);

    return {
      labels,
      datasets: [
        {
          label: 'Minutes Listened',
          data: values,
          fill: true,
          backgroundColor: 'rgba(34, 139, 230, 0.1)',
          borderColor: 'rgba(34, 139, 230, 1)',
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [data]);

  const options = useMemo(
    (): ChartOptions<'line'> => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
          },
          bodyFont: {
            size: 13,
          },
          callbacks: {
            label: (context): string => {
              return formatDuration(context.parsed.y ?? 0);
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
          ticks: {
            callback: (value): string => {
              if (typeof value === 'number') {
                return formatDuration(value);
              }
              return String(value);
            },
          },
        },
      },
    }),
    []
  );

  if (isLoading) {
    return <Skeleton height={300} radius="md" />;
  }

  if (data.length === 0) {
    return (
      <Paper p="xl" withBorder radius="md" h={300}>
        <Stack align="center" justify="center" h="100%">
          <ThemeIcon color="gray" variant="light" size={48} radius="xl">
            <IconChartBar size={24} />
          </ThemeIcon>
          <Text c="dimmed" ta="center">
            No listening data yet.
            <br />
            Start listening to audiobooks to see your activity!
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder radius="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconChartBar size={20} />
          <Text fw={500}>Daily Activity (Last 30 Days)</Text>
        </Group>
      </Group>
      <Box h={300}>
        <Line data={chartData} options={options} />
      </Box>
    </Paper>
  );
}

/**
 * Empty state component when no stats are available
 */
function EmptyState(): JSX.Element {
  return (
    <Paper p="xl" withBorder radius="md">
      <Stack align="center" gap="md" py="xl">
        <ThemeIcon color="blue" variant="light" size={64} radius="xl">
          <IconMusic size={32} />
        </ThemeIcon>
        <Title order={3}>No Listening History Yet</Title>
        <Text c="dimmed" ta="center" maw={400}>
          Start listening to audiobooks to track your progress and see your
          statistics here. Your listening time, completed chapters, and daily
          streaks will appear as you use the audio player.
        </Text>
      </Stack>
    </Paper>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function ListeningStatsPage(): React.ReactElement {
  // Fetch stats from API (procedures are merged at top level)
  const { data: stats, isLoading: isLoadingStats } =
    api.audioPlayer.getStats.useQuery();

  const { data: dailyAnalytics, isLoading: isLoadingChart } =
    api.audioPlayer.getDailyAnalytics.useQuery({ days: 30 });

  const isLoading = isLoadingStats || isLoadingChart;
  const hasData =
    stats !== undefined &&
    (stats.totalMinutesAllTime > 0 ||
      stats.totalChaptersCompleted > 0 ||
      stats.currentStreak > 0);

  return (
    <Container size="xl" py="xl">
      <LoadingOverlay visible={isLoading && !stats} />

      {/* Header */}
      <Group gap="xs" mb="xl">
        <ThemeIcon color="blue" variant="light" size="lg" radius="md">
          <IconMusic size={20} />
        </ThemeIcon>
        <Title order={2}>Listening Statistics</Title>
      </Group>

      {!hasData && !isLoading ? (
        <EmptyState />
      ) : (
        <Stack gap="lg">
          {/* Time Statistics */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <StatCard
              title="Total Time"
              value={formatDuration(stats?.totalMinutesAllTime ?? 0)}
              subtitle="All time listening"
              icon={<IconClock size={20} />}
              color="blue"
            />
            <StatCard
              title="This Week"
              value={formatDuration(stats?.totalMinutesThisWeek ?? 0)}
              subtitle="Past 7 days"
              icon={<IconPlayerPlay size={20} />}
              color="green"
            />
            <StatCard
              title="Today"
              value={formatDuration(stats?.totalMinutesToday ?? 0)}
              subtitle="Today's listening"
              icon={<IconMusic size={20} />}
              color="cyan"
            />
            <StatCard
              title="Chapters"
              value={stats?.totalChaptersCompleted ?? 0}
              subtitle="Completed"
              icon={<IconBook size={20} />}
              color="violet"
            />
          </SimpleGrid>

          {/* Achievements Row */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <StreakDisplay
              currentStreak={stats?.currentStreak ?? 0}
              longestStreak={stats?.longestStreak ?? 0}
            />
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <Stack gap="xs">
                  <Group gap="xs">
                    <ThemeIcon color="yellow" variant="light" size="lg" radius="md">
                      <IconTrophy size={20} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed" fw={500}>
                      Audiobooks Completed
                    </Text>
                  </Group>
                  <Text size="xl" fw={700}>
                    {stats?.totalAudiobooksCompleted ?? 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Finished audiobooks
                  </Text>
                </Stack>
                <RingProgress
                  size={80}
                  thickness={8}
                  roundCaps
                  sections={[
                    {
                      value: Math.min(
                        ((stats?.totalAudiobooksCompleted ?? 0) / 10) * 100,
                        100
                      ),
                      color: 'yellow',
                    },
                  ]}
                  label={
                    <Text ta="center" size="xs" fw={700}>
                      {stats?.totalAudiobooksCompleted ?? 0}/10
                    </Text>
                  }
                />
              </Group>
            </Card>
          </SimpleGrid>

          {/* Daily Chart */}
          <ListeningChart
            data={dailyAnalytics ?? []}
            isLoading={isLoadingChart}
          />
        </Stack>
      )}
    </Container>
  );
}

// Use MainLayout for this page
ListeningStatsPage.getLayout = function getLayout(
  page: ReactElement
): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
