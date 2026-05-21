/**
 * Calendar Page
 *
 * Dark-themed manga release calendar showing monitored manga,
 * upcoming releases, monthly calendar grid, and recent releases.
 */

import React from 'react';

import { ActionIcon, Alert, Box, Container, Grid, Group, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconAlertCircle, IconCalendarStats, IconRefresh } from '@tabler/icons-react';

import { MonitoredMangaRow } from '@/components/calendar/MonitoredMangaRow';
import { MonthlyCalendar } from '@/components/calendar/MonthlyCalendar';
import { RecentReleases } from '@/components/calendar/RecentReleases';
import { UpcomingReleases } from '@/components/calendar/UpcomingReleases';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { trpc } from '@/utils/trpc-client';

export default function CalendarPage(): React.ReactElement {
  const utils = trpc.useUtils();
  const stats = trpc.calendar.getStatistics.useQuery({});

  const syncMutation = trpc.calendar.triggerSync.useMutation({
    onSuccess: () => {
      // Refresh every calendar query so a manual sync surfaces new events
      // immediately rather than waiting for the next stale-time window.
      void utils.calendar.invalidate();
    },
  });

  const totalEvents = stats.data?.totalEvents;
  const accuracy = stats.data?.accuracyRate;

  return (
    <ResponsiveMainLayout>
      <Box style={{ minHeight: '100vh', backgroundColor: '#1a1b1e' }}>
        <Container fluid px="xl" pt={80} pb="xl">
          {/* Header */}
          <Group gap="md" mb="xl" justify="space-between">
            <Group gap="md">
              <IconCalendarStats size={32} color="white" />
              <div>
                <Title order={2} c="white">Release Calendar</Title>
                <Text c="dimmed" size="sm">
                  Track upcoming manga chapter releases
                  {totalEvents ? ` · ${totalEvents} events tracked` : ''}
                  {accuracy ? ` · ${(accuracy * 100).toFixed(0)}% accuracy` : ''}
                </Text>
              </div>
            </Group>
            <Tooltip label="Sync release data now">
              <ActionIcon variant="light" color="blue" size="lg" loading={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}>
                <IconRefresh size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {syncMutation.error ? (
            <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" title="Sync failed">
              {syncMutation.error.message}
            </Alert>
          ) : null}
          {stats.error ? (
            <Alert icon={<IconAlertCircle size={16} />} color="yellow" mb="md" title="Stats unavailable">
              {stats.error.message}
            </Alert>
          ) : null}

          <Grid gutter="xl">
            <Grid.Col span={{ base: 12, lg: 9 }} order={{ base: 2, lg: 1 }}>
              <Stack gap="xl">
                <MonthlyCalendar />
                <UpcomingReleases />
                <RecentReleases />
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 3 }} order={{ base: 1, lg: 2 }}>
              <Box style={{ position: 'sticky', top: 80 }}>
                <MonitoredMangaRow />
              </Box>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>
    </ResponsiveMainLayout>
  );
}
