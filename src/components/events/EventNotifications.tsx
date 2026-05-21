import React, { useEffect, useState } from 'react';

import {
  Portal,
  Card,
  Stack,
  Group,
  Text,
  Badge,
  ActionIcon,
  Transition,
  ScrollArea,
  Button,
  Menu,
  Indicator } from
'@mantine/core';
import { useListState } from '@mantine/hooks';
import {
  IconBell,
  IconX,
  IconDownload,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconBellOff } from
'@tabler/icons-react';

interface EventNotification {
  id: string;
  type: 'download' | 'sync' | 'update' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: unknown;
}

export function EventNotifications(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, handlers] = useListState<EventNotification>([]);
  const [mutedTypes, setMutedTypes] = useState<string[]>([]);

  // Mock subscription for now - replace with real implementation when available
  useEffect(() => {
    // This would be replaced with actual subscription when endpoint is available
    // trpc.events.subscribe.useSubscription(undefined, { ... });

    // Mock some notifications for testing
    const mockNotifications: EventNotification[] = [
    {
      id: '1',
      type: 'download',
      title: 'Download Complete',
      message: 'One Piece Chapter 1100 downloaded successfully',
      timestamp: new Date(),
      read: false,
      data: { mangaId: 1 }
    }];


    handlers.setState(mockNotifications);
  }, [handlers]);

  // Mock mutations - replace when endpoints are available
  const markAllReadMutation = {
    mutate: () => {
      const updatedNotifications = notifications.map((n) => ({ ...n, read: true }));
      handlers.setState(updatedNotifications);
    }
  };

  const clearAllMutation = {
    mutate: () => {
      handlers.setState([]);
      setIsOpen(false);
    }
  };

  const getEventIcon = (type: string): React.ReactElement => {
    switch (type) {
      case 'download':return <IconDownload size={16} />;
      case 'sync':return <IconCheck size={16} />;
      case 'update':return <IconInfoCircle size={16} />;
      case 'error':return <IconAlertTriangle size={16} />;
      default:return <IconInfoCircle size={16} />;
    }
  };

  const getEventColor = (type: string): string => {
    switch (type) {
      case 'download':return 'blue';
      case 'sync':return 'green';
      case 'update':return 'cyan';
      case 'error':return 'red';
      default:return 'gray';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (notification: EventNotification): void => {
    // Mark as read
    const index = notifications.findIndex((n) => n["id"] === notification["id"]);
    if (index !== -1 && !notification.read) {
      handlers.setItemProp(index, 'read', true);
    }

    // Handle specific notification actions
    if (notification.type === 'download' && notification.data !== undefined) {
      const data = notification.data as { mangaId?: number };
      if (data.mangaId !== undefined) {
        // Navigate to manga page
        window.location.href = `/manga/${data.mangaId}`;
      }
    }
  };

  const handleMuteType = (type: string): void => {
    if (mutedTypes.includes(type)) {
      setMutedTypes(mutedTypes.filter((t) => t !== type));
    } else {
      setMutedTypes([...mutedTypes, type]);
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  return (
    <>
      {/* Notification Bell */}
      <Indicator
        inline
        label={unreadCount}
        size={16}
        disabled={unreadCount === 0}
        color="red"
        position="top-end">

        <ActionIcon
          size="lg"
          variant="subtle"
          onClick={() => setIsOpen(!isOpen)}>

          <IconBell size={20} />
        </ActionIcon>
      </Indicator>

      {/* Notification Panel */}
      <Portal>
        <Transition
          mounted={isOpen}
          transition="slide-left"
          duration={300}
          timingFunction="ease">

          {(styles) =>
          <Card
            style={{
              ...styles,
              position: 'fixed',
              top: 60,
              right: 20,
              width: 400,
              maxHeight: '80vh',
              zIndex: 1000,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
            p="lg">

              <Stack gap="md">
                {/* Header */}
                <Group justify="space-between">
                  <Text fw={600} size="lg">Notifications</Text>
                  <Group gap="xs">
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconBellOff size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>Mute Notifications</Menu.Label>
                        {['download', 'sync', 'update', 'error', 'info'].map((type) =>
                      <Menu.Item
                        key={type}
                        onClick={() => handleMuteType(type)}
                        rightSection={mutedTypes.includes(type) ? <IconX size={14} /> : null}>

                            {type.charAt(0).toUpperCase() + type.slice(1)} Events
                          </Menu.Item>
                      )}
                      </Menu.Dropdown>
                    </Menu>
                    <ActionIcon
                    variant="subtle"
                    onClick={() => setIsOpen(false)}>

                      <IconX size={18} />
                    </ActionIcon>
                  </Group>
                </Group>

                {/* Actions */}
                {notifications.length > 0 &&
              <Group gap="xs">
                    <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={unreadCount === 0}>

                      Mark all read
                    </Button>
                    <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={() => {
                    if (confirm('Clear all notifications?')) {
                      void clearAllMutation.mutate();
                    }
                  }}>

                      Clear all
                    </Button>
                  </Group>
              }

                {/* Notifications List */}
                <ScrollArea style={{ height: 400 }}>
                  {notifications.length > 0 ?
                <Stack gap="xs">
                      {notifications.map((notification) =>
                  <Card
                    key={notification["id"]}
                    p="sm"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      opacity: notification.read ? 0.7 : 1,
                      transition: 'opacity 200ms'
                    }}
                    onClick={() => handleNotificationClick(notification)}>

                          <Group justify="space-between" mb="xs">
                            <Group gap="xs">
                              {getEventIcon(notification.type)}
                              <Badge
                          size="sm"
                          color={getEventColor(notification.type)}
                          variant="light">

                                {notification.type}
                              </Badge>
                            </Group>
                            <Text size="xs" c="dimmed">
                              {formatTime(notification.timestamp)}
                            </Text>
                          </Group>
                          <Text fw={500} size="sm" mb={4}>
                            {notification["title"]}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {notification.message}
                          </Text>
                        </Card>
                  )}
                    </Stack> :

                <Text ta="center" c="dimmed" size="sm" py="xl">
                      No notifications yet
                    </Text>
                }
                </ScrollArea>
              </Stack>
            </Card>
          }
        </Transition>
      </Portal>
    </>);

}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}