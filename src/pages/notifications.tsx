/**
 * Notifications History Page
 *
 * Full paginated view of the user's bell notifications. Reads from the same
 * tRPC procedures the bell dropdown uses; this page lets the user scroll
 * through the entire history, filter by read state, and clear in bulk.
 */

import React, { useMemo, useState } from 'react';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Pagination,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconBell,
  IconCheck,
  IconDownload,
  IconEye,
  IconInfoCircle,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { useRealTime } from '@/providers/RealTimeProvider';
import type { WebSocketEvent } from '@/types/api/v1/websocket';
import { trpc } from '@/utils/trpc-client';


const PAGE_SIZE = 25;

type FilterMode = 'all' | 'unread';

interface NotificationRow {
  id: number;
  type: string;
  title: string;
  message: string;
  severity: string;
  read: boolean;
  createdAt: Date;
  actionUrl: string | null;
}

function severityIcon(type: string, severity: string): React.ReactElement {
  const t = type.toUpperCase();
  const s = severity.toUpperCase();
  if (s === 'SUCCESS' || t.includes('COMPLETED')) return <IconCheck size={16} color="var(--mantine-color-green-6)" />;
  if (s === 'ERROR' || t.includes('FAILED') || t.includes('ERROR')) return <IconX size={16} color="var(--mantine-color-red-6)" />;
  if (s === 'WARNING' || t.includes('WARNING')) return <IconAlertCircle size={16} color="var(--mantine-color-yellow-6)" />;
  if (t.includes('DOWNLOAD')) return <IconDownload size={16} color="var(--mantine-color-cyan-6)" />;
  if (t.includes('METADATA') || t.includes('UPDATE') || s === 'INFO') {
    return <IconInfoCircle size={16} color="var(--mantine-color-blue-6)" />;
  }
  return <IconBell size={16} />;
}

function formatTimestamp(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 7) return d.toLocaleString();
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export default function NotificationsPage(): React.ReactElement {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { isConnected, subscribe } = useRealTime();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterMode>('all');

  const queryInput = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      unreadOnly: filter === 'unread',
    }),
    [page, filter],
  );

  const { data: notifications = [], isLoading, refetch } = trpc.notifications.getNotifications.useQuery(
    queryInput,
    {
      refetchInterval: isConnected ? false : 30000,
      refetchOnWindowFocus: !isConnected,
    },
  );

  const { data: unreadCount = 0 } = trpc.notifications.getUnreadCount.useQuery();

  // Subscribe to WS pushes so the page stays live.
  React.useEffect(() => {
    const handler = (_event: WebSocketEvent): void => {
      void utils.notifications.getNotifications.invalidate();
      void utils.notifications.getUnreadCount.invalidate();
    };
    const unsubSystem = subscribe('system:notifications', handler);
    const unsubUser = userId ? subscribe(`user:${userId}:notifications`, handler) : null;
    return () => {
      unsubSystem();
      if (unsubUser) unsubUser();
    };
  }, [subscribe, utils.notifications.getNotifications, utils.notifications.getUnreadCount, userId]);

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.getNotifications.invalidate();
      await utils.notifications.getUnreadCount.invalidate();
    },
  });

  const markAllAsRead = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.getNotifications.invalidate();
      await utils.notifications.getUnreadCount.invalidate();
    },
  });

  const clearAll = trpc.notifications.clearAll.useMutation({
    onSuccess: async () => {
      await utils.notifications.getNotifications.invalidate();
      await utils.notifications.getUnreadCount.invalidate();
    },
  });

  const handleRowClick = (n: NotificationRow): void => {
    if (!n.read) {
      markAsRead.mutate({ notificationIds: [n.id] });
    }
    if (n.actionUrl) {
      void router.push(n.actionUrl);
    }
  };

  // The query doesn't return a total count, so we infer "has next page" from
  // whether the current page is full. A future enhancement can add a count
  // procedure if precise pagination matters.
  const hasNextPage = notifications.length === PAGE_SIZE;
  const visiblePages = hasNextPage ? page + 1 : page;

  return (
    <ResponsiveMainLayout>
      <Container size="md" py="lg">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <IconBell size={28} />
              <Title order={2}>Notifications</Title>
              {unreadCount > 0 && (
                <Badge color="red" size="lg">{unreadCount} unread</Badge>
              )}
            </Group>
            <Group gap="xs">
              <Tooltip label="Refresh">
                <ActionIcon variant="subtle" onClick={() => void refetch()}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              {unreadCount > 0 && (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconEye size={14} />}
                  onClick={() => markAllAsRead.mutate()}
                  loading={markAllAsRead.isPending}
                >
                  Mark all read
                </Button>
              )}
              <Button
                size="xs"
                variant="light"
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => clearAll.mutate()}
                loading={clearAll.isPending}
                disabled={notifications.length === 0 && filter === 'all'}
              >
                Clear all
              </Button>
            </Group>
          </Group>

          <SegmentedControl
            value={filter}
            onChange={(v) => { setFilter(v as FilterMode); setPage(1); }}
            data={[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
            ]}
          />

          {isLoading ? (
            <Center py="xl"><Loader /></Center>
          ) : notifications.length === 0 ? (
            <Alert color="gray" icon={<IconBell size={18} />}>
              {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
            </Alert>
          ) : (
            <Paper withBorder>
              <Stack gap={0}>
                {notifications.map((n: NotificationRow, idx) => (
                  <Box
                    key={n.id}
                    px="md"
                    py="sm"
                    style={{
                      backgroundColor: n.read
                        ? 'transparent'
                        : 'color-mix(in srgb, var(--theme-card, #25262b), var(--theme-text, #e9ecef) 10%)',
                      borderLeft: n.read
                        ? '3px solid transparent'
                        : '3px solid var(--mantine-color-blue-5)',
                      cursor: n.actionUrl ? 'pointer' : 'default',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--app-border, var(--mantine-color-dark-5))',
                    }}
                    onClick={() => handleRowClick(n)}
                  >
                    <Group gap="sm" align="flex-start" wrap="nowrap">
                      <Box mt={2}>{severityIcon(n.type, n.severity)}</Box>
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                          <Text
                            size="sm"
                            fw={n.read ? 400 : 600}
                            style={{
                              color: 'var(--theme-text, var(--mantine-color-text))',
                              opacity: n.read ? 0.55 : 1,
                            }}
                          >
                            {n.title}
                          </Text>
                          <Text
                            size="xs"
                            style={{
                              color: 'var(--theme-text, var(--mantine-color-text))',
                              opacity: 0.65,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatTimestamp(n.createdAt)}
                          </Text>
                        </Group>
                        <Text
                          size="sm"
                          mt={4}
                          style={{
                            color: 'var(--theme-text, var(--mantine-color-text))',
                            opacity: n.read ? 0.55 : 0.85,
                          }}
                        >
                          {n.message}
                        </Text>
                        <Text
                          size="xs"
                          mt={4}
                          fs="italic"
                          style={{
                            color: 'var(--theme-text, var(--mantine-color-text))',
                            opacity: 0.55,
                          }}
                        >
                          {n.type}
                        </Text>
                      </Box>
                    </Group>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}

          {(page > 1 || hasNextPage) && (
            <Group justify="center">
              <Pagination
                value={page}
                onChange={setPage}
                total={visiblePages}
                size="sm"
                withEdges={false}
              />
            </Group>
          )}
        </Stack>
      </Container>
    </ResponsiveMainLayout>
  );
}
