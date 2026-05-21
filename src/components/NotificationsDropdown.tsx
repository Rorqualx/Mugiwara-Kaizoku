"use client";

/**
 * Notifications Dropdown Component
 *
 * Displays notification history in a dropdown menu with a bell icon.
 * Features include:
 * - Notification history from database
 * - Unread count badge
 * - Mark as read functionality
 * - Clear all notifications
 * - Different notification types with icons
 * - Real-time updates via WebSocket
 */

import React, { useState, useEffect, useCallback } from "react";

import {
  Menu,
  ActionIcon,
  Badge,
  ScrollArea,
  Text,
  Group,
  Stack,
  Button,
  Divider,
  Box,
  Center,
  Loader,
  Accordion
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconBell,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconInfoCircle,
  IconDownload,
  IconPlayerPlay,
  IconTrash,
  IconEye
} from '@tabler/icons-react';
import { motion } from "framer-motion";
import Link from 'next/link';
import { useSession } from 'next-auth/react';

import { useEvents } from '@/hooks/useEvents';
import { useRealTime } from '@/providers/RealTimeProvider';
import type { WebSocketEvent } from '@/types/api/v1/websocket';

import { trpc } from "../utils/trpc-client";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  severity: string;
  userId: string;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  relatedMangaId: number | null;
  relatedChapterId: number | null;
  relatedJobId: bigint | null;
  actionUrl: string | null;
}

type TypeFamily = 'Downloads' | 'Releases' | 'System' | 'User';

const FAMILY_ORDER: readonly TypeFamily[] = ['Downloads', 'Releases', 'System', 'User'];

function getTypeFamily(type: string): TypeFamily {
  const t = type.toUpperCase();
  if (t.includes('DOWNLOAD') || t.includes('CHAPTER') || t.includes('VOLUME')) return 'Downloads';
  if (t === 'METADATA_UPDATED' || t === 'MANGA_ADDED' || t === 'MANGA_UPDATED' || t.includes('RELEASE')) {
    return 'Releases';
  }
  if (t === 'USER_ACTION') return 'User';
  return 'System';
}

interface PushPayload {
  id?: string | number;
  title?: string;
  message?: string;
  level?: 'info' | 'success' | 'warning' | 'error';
  type?: string;
  severity?: string;
  timestamp?: string;
}

function isPartialPush(data: unknown): data is PushPayload {
  return typeof data === 'object' && data !== null;
}

// Bypass Mantine's `c` prop — this codebase customises --mantine-color-dimmed
// to the border color in ColorSchemeProvider, which makes c="dimmed" invisible
// on tinted backgrounds. Tying directly to --theme-text (set by the user's
// appearance settings) keeps text in sync with the chosen theme.
const THEME_TEXT_COLOR = 'var(--theme-text, var(--mantine-color-text))';
function rowTextStyle(opacity: number): React.CSSProperties {
  return { color: THEME_TEXT_COLOR, opacity };
}

interface JobStatusBlockProps {
  active: number;
  failed: number;
  onNavigate: () => void;
}

function JobStatusBlock({ active, failed, onNavigate }: JobStatusBlockProps): React.ReactElement | null {
  if (active === 0 && failed === 0) return null;
  return (
    <Stack gap={0} px="xs" pb="xs">
      {active > 0 && (
        <Button
          component={Link}
          href="/jobs/active"
          variant="subtle"
          size="xs"
          justify="flex-start"
          onClick={onNavigate}
          leftSection={<IconPlayerPlay size={14} color="var(--mantine-color-blue-6)" />}
          styles={{ root: { color: 'var(--theme-text)' } }}
        >
          {active} active task{active === 1 ? '' : 's'}
        </Button>
      )}
      {failed > 0 && (
        <Button
          component={Link}
          href="/jobs/failed"
          variant="subtle"
          size="xs"
          justify="flex-start"
          onClick={onNavigate}
          leftSection={<IconAlertTriangle size={14} color="var(--mantine-color-red-6)" />}
          styles={{ root: { color: 'var(--theme-text)' } }}
        >
          {failed} failed task{failed === 1 ? '' : 's'}
        </Button>
      )}
    </Stack>
  );
}

export function NotificationsDropdown(): React.ReactElement {
  const [opened, setOpened] = useState(false);
  const { isConnected, subscribe } = useRealTime();
  const { data: session } = useSession();
  const userId = session?.user.id;
  const utils = trpc.useUtils();
  const { active, failed } = useEvents();

  // Use polling only as fallback when WebSocket is disconnected
  const fallbackPollingInterval = isConnected ? false : 30000;

  // Fetch notifications from database (refetch on window focus only when WebSocket disconnected)
  const {
    data: notifications = [],
    isLoading: notificationsLoading
  } = trpc.notifications.getNotifications.useQuery(
    { limit: 50 },
    {
      refetchInterval: opened && !isConnected ? 10000 : false,
      refetchOnWindowFocus: !isConnected
    }
  );

  // Fetch unread count (refetch on window focus only when WebSocket disconnected)
  const {
    data: unreadCount = 0
  } = trpc.notifications.getUnreadCount.useQuery(undefined, {
    refetchInterval: fallbackPollingInterval,
    refetchOnWindowFocus: !isConnected
  });

  // Subscribe to notification updates via WebSocket.
  //
  // Push payloads from `notifyUser` / the tRPC `create` mutation carry an id +
  // title + message + level. When the cached list is already loaded we can
  // re-fetch lazily — but invalidation is still the safest baseline because
  // the push payload omits relatedMangaId/chapterId/actionUrl that the row
  // contains. We invalidate here; Phase 2.2 follow-up can extend the payload
  // to a full row and switch to setData prepend.
  const handleNotificationUpdate = useCallback((event: WebSocketEvent) => {
    if (isPartialPush(event.data)) {
      void utils.notifications.getNotifications.invalidate();
      void utils.notifications.getUnreadCount.invalidate();
    }
  }, [utils.notifications.getNotifications, utils.notifications.getUnreadCount]);

  useEffect(() => {
    const unsubscribeSystem = subscribe('system:notifications', handleNotificationUpdate);
    const unsubscribeUser = userId
      ? subscribe(`user:${userId}:notifications`, handleNotificationUpdate)
      : null;
    return () => {
      unsubscribeSystem();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [subscribe, handleNotificationUpdate, userId]);

  // Mutations
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.getNotifications.invalidate();
      await utils.notifications.getUnreadCount.invalidate();
    }
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.getNotifications.invalidate();
      await utils.notifications.getUnreadCount.invalidate();
    }
  });

  // Opening the bell counts as "seeing" the unread items — auto-clear the
  // red badge after a short delay so the user has a moment to register which
  // rows were unread (via the accent border + bg) before they transition.
  // Delay also avoids racing with the dropdown open animation.
  useEffect(() => {
    if (!opened || unreadCount === 0 || markAllAsReadMutation.isPending) return;
    const timer = setTimeout(() => {
      markAllAsReadMutation.mutate();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, unreadCount]);

  const clearAllMutation = trpc.notifications.clearAll.useMutation({
    onSuccess: async () => {
      await utils.notifications.getNotifications.invalidate();
      await utils.notifications.getUnreadCount.invalidate();
      setOpened(false);
    }
  });

  const getNotificationIcon = (type: string): React.ReactElement => {
    const typeLower = type.toLowerCase();

    if (typeLower.includes('success') || typeLower.includes('complete')) {
      return <IconCheck size={16} color="var(--mantine-color-green-6)" />;
    }
    if (typeLower.includes('error') || typeLower.includes('fail')) {
      return <IconX size={16} color="var(--mantine-color-red-6)" />;
    }
    if (typeLower.includes('warning') || typeLower.includes('missing')) {
      return <IconAlertCircle size={16} color="var(--mantine-color-yellow-6)" />;
    }
    if (typeLower.includes('download')) {
      return <IconDownload size={16} color="var(--mantine-color-cyan-6)" />;
    }
    if (typeLower.includes('info') || typeLower.includes('metadata') || typeLower.includes('update')) {
      return <IconInfoCircle size={16} color="var(--mantine-color-blue-6)" />;
    }
    return <IconBell size={16} />;
  };

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diff = now.getTime() - notificationDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const markAsRead = (id: number): void => {
    markAsReadMutation.mutate({ notificationIds: [id] });
  };

  const renderRow = (notification: Notification): React.ReactElement => {
    // Theme-aware contrast: same color-mix pattern used for Menu.Item hover
    // in themeOverrides.css. Plain --mantine-color-dark-6 collided with the
    // dropdown bg and made unread rows invisible.
    const unreadBg = 'color-mix(in srgb, var(--theme-card, #25262b), var(--theme-text, #e9ecef) 10%)';
    return (
      <Box
        key={notification.id}
        px="xs"
        py="sm"
        style={{
          backgroundColor: notification.read ? 'transparent' : unreadBg,
          borderLeft: notification.read
            ? '3px solid transparent'
            : '3px solid var(--mantine-color-blue-5)',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onClick={() => markAsRead(notification.id)}
      >
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <Box mt={2}>{getNotificationIcon(notification.type)}</Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={notification.read ? 400 : 600} lineClamp={2} style={rowTextStyle(notification.read ? 0.55 : 1)}>
              {notification.title}
            </Text>
            <Text size="xs" lineClamp={3} style={rowTextStyle(notification.read ? 0.55 : 0.85)}>
              {notification.message}
            </Text>
            <Text size="xs" mt={4} style={rowTextStyle(0.65)}>
              {formatTimestamp(notification.createdAt)}
            </Text>
          </Box>
        </Group>
      </Box>
    );
  };

  const markAllAsRead = (): void => {
    markAllAsReadMutation.mutate();
  };

  const clearAll = (): void => {
    clearAllMutation.mutate();
  };

  // Add animation to bell when there are unread notifications
  const bellIcon = unreadCount > 0 ? (
    <motion.div
      animate={{
        rotate: [0, -10, 10, -10, 10, 0],
      }}
      transition={{
        duration: 0.5,
        ease: "easeInOut",
        times: [0, 0.2, 0.4, 0.6, 0.8, 1],
        repeat: Infinity,
        repeatDelay: 5,
      }}
    >
      <IconBell size={20} />
    </motion.div>
  ) : (
    <IconBell size={20} />
  );

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      shadow="md"
      width={350}
      position="bottom-end"
      withArrow
      arrowPosition="center"
    >
      <Menu.Target>
        <Box style={{ position: 'relative', display: 'inline-block' }}>
          <ActionIcon variant="transparent" size="lg">
            {bellIcon}
          </ActionIcon>
          {unreadCount > 0 && (
            <Badge
              size="xs"
              color="red"
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                padding: '2px 4px',
                minWidth: '16px',
                height: '16px'
              }}
            >
              {unreadCount}
            </Badge>
          )}
        </Box>
      </Menu.Target>

      <Menu.Dropdown>
        <Group justify="space-between" px="xs" py="xs">
          <Text size="sm" fw={600}>Notifications</Text>
          {notifications.length > 0 && (
            <Group gap="xs">
              {unreadCount > 0 && (
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={markAllAsRead}
                  leftSection={<IconEye size={14} />}
                >
                  Mark all read
                </Button>
              )}
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={clearAll}
                leftSection={<IconTrash size={14} />}
              >
                Clear
              </Button>
            </Group>
          )}
        </Group>

        <JobStatusBlock active={active} failed={failed} onNavigate={() => setOpened(false)} />

        <Divider />

        <ScrollArea h={notificationsLoading ? 100 : notifications.length > 0 ? 300 : 100}>
          {notificationsLoading ? (
            <Center h={80}>
              <Stack align="center" gap="xs">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">Loading notifications...</Text>
              </Stack>
            </Center>
          ) : notifications.length === 0 ? (
            <Center h={80}>
              <Stack align="center" gap="xs">
                <IconBell size={24} style={{ opacity: 0.5 }} />
                <Text size="sm" c="dimmed">No notifications</Text>
              </Stack>
            </Center>
          ) : notifications.length >= 10 ? (
            <Accordion multiple defaultValue={[...FAMILY_ORDER]} variant="filled" chevronPosition="left">
              {FAMILY_ORDER.map((family) => {
                const group = notifications.filter((n: Notification) => getTypeFamily(n.type) === family);
                if (group.length === 0) return null;
                const unread = group.filter((n) => !n.read).length;
                return (
                  <Accordion.Item key={family} value={family}>
                    <Accordion.Control>
                      <Group justify="space-between" pr="xs">
                        <Text size="sm" fw={600}>{family}</Text>
                        <Badge size="xs" variant="light" color={unread > 0 ? 'red' : 'gray'}>
                          {group.length}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel p={0}>
                      <Stack gap={0}>
                        {group.map((n) => renderRow(n))}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          ) : (
            <Stack gap={0}>{notifications.map((n: Notification) => renderRow(n))}</Stack>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Divider />
            <Center py="xs">
              <Button
                component={Link}
                href="/notifications"
                variant="subtle"
                size="xs"
                onClick={() => setOpened(false)}
              >
                View all notifications
              </Button>
            </Center>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}