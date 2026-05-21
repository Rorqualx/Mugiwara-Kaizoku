/**
 * Recent Releases
 *
 * Shows recently released/confirmed calendar events.
 * Dark-themed list matching the app's aesthetic.
 */

import React from 'react';

import { Badge, Box, Center, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconHistory } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

export function RecentReleases(): React.ReactElement {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data } = trpc.calendar.getEvents.useQuery({
    start: thirtyDaysAgo,
    end: new Date(),
    filters: { status: ['RELEASED', 'CONFIRMED'] },
  });

  if (!data) return <></>;
  const events = data.slice(0, 15);

  if (events.length === 0) {
    return (
      <Box mb="xl">
        <Title order={4} c="white" mb="md">Recent Releases</Title>
        <Paper p="xl" radius="md" bg="dark.6">
          <Center>
            <Stack align="center" gap="xs">
              <IconHistory size={40} color="gray" />
              <Text c="dimmed" size="sm">No recent releases tracked yet</Text>
            </Stack>
          </Center>
        </Paper>
      </Box>
    );
  }

  return (
    <Box mb="xl">
      <Title order={4} c="white" mb="md">Recent Releases</Title>
      <Paper radius="md" bg="dark.6" p="sm">
        <Stack gap="xs">
          {events.map(event => (
            <Group key={event.id} gap="sm" p="xs"
              style={{ borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <Badge size="xs" variant="filled" color={event.status === 'RELEASED' ? 'green' : 'blue'}>
                {event.status}
              </Badge>
              <Text size="sm" c="white" style={{ flex: 1 }}>{event.title}</Text>
              <Text size="xs" c="dimmed">
                {new Date(event.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </Group>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
