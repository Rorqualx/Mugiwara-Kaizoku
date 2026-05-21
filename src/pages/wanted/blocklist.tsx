/**
 * Release Blocklist Page
 *
 * Server-paginated table of blocked releases with summary cards.
 *
 * Note: the "Active / Auto-Blocked / With Expiry" cards reflect the current
 * page only — accurate global counts would require extending
 * `releaseBlocklist.getStatistics`. The "Total Blocked" card uses the
 * server-returned total and is correct.
 */

import React, { useState } from "react";
import type { ReactElement } from 'react';

import { Stack, Loader, Alert, Text, Group, Grid, Card, Badge } from '@mantine/core';
import { IconAlertCircle, IconShieldX, IconCpu, IconClock } from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import WantedLayout from '@/components/layouts/WantedLayout';
import { BlocklistTable } from '@/components/wanted/BlocklistTable';
import { trpc } from '@/utils/trpc-client/index';

const PAGE_SIZE = 100;

export default function BlocklistPage(): React.ReactElement {
  const [page, setPage] = useState(1);

  const {
    data: blocklistData,
    isLoading,
    error,
    refetch
  } = trpc.releaseBlocklist.search.useQuery(
    {
      includeInactive: true,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
    },
    { placeholderData: (prev) => prev }
  );

  if (isLoading && !blocklistData) {
    return (
      <WantedLayout title="Release Blocklist">
        <Stack align="center" mt="xl">
          <Loader size="lg" />
          <Text c="dimmed">Loading blocklist...</Text>
        </Stack>
      </WantedLayout>
    );
  }

  if (error) {
    return (
      <WantedLayout title="Release Blocklist">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading blocklist"
          color="red"
        >
          {(error instanceof Error ? error.message : String(error)) || 'An unexpected error occurred'}
        </Alert>
      </WantedLayout>
    );
  }

  const entries = blocklistData?.entries ?? [];
  const totalBlocked = blocklistData?.total ?? 0;
  const activeCount = entries.filter(e => e.isActive).length;
  const autoBlockedCount = entries.filter(e => e.autoBlocked).length;
  const withExpiryCount = entries.filter(e => e.expiryDate).length;

  return (
    <WantedLayout title="Release Blocklist">
      <Stack gap="lg">
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Total Blocked
                  </Text>
                  <Text size="xl" fw={700}>
                    {totalBlocked}
                  </Text>
                </div>
                <IconShieldX size={32} style={{ color: 'var(--mantine-color-red-filled)' }} />
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Active (page)
                  </Text>
                  <Text size="xl" fw={700} c="green">
                    {activeCount}
                  </Text>
                </div>
                <Badge size="xl" color="green" variant="light">
                  {entries.length > 0 ? ((activeCount / entries.length) * 100).toFixed(0) : 0}%
                </Badge>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Auto-Blocked (page)
                  </Text>
                  <Text size="xl" fw={700} c="teal">
                    {autoBlockedCount}
                  </Text>
                </div>
                <IconCpu size={32} style={{ color: 'var(--mantine-color-teal-filled)' }} />
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    With Expiry (page)
                  </Text>
                  <Text size="xl" fw={700} c="blue">
                    {withExpiryCount}
                  </Text>
                </div>
                <IconClock size={32} style={{ color: 'var(--mantine-color-blue-filled)' }} />
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        <BlocklistTable
          items={entries}
          page={page}
          pageSize={PAGE_SIZE}
          total={totalBlocked}
          onPageChange={setPage}
          onRefresh={() => void refetch()}
          isLoading={isLoading}
        />
      </Stack>
    </WantedLayout>
  );
}

BlocklistPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>
};
