/**
 * Per-User Notification Preference Matrix
 *
 * Each row is a notification event type; each column is a delivery channel.
 * Toggling a cell upserts a `NotificationPreference` row. Missing rows fall
 * back to defaults: `bell` ON, every external channel OFF.
 */
import React from 'react';

import { Alert, Badge, Box, Button, Group, Loader, Stack, Switch, Table, Text, Tooltip } from '@mantine/core';
import { NotificationEventType } from '@prisma/client';
import {
  IconApi,
  IconBell,
  IconBrandDiscord,
  IconBrandSlack,
  IconBrandTelegram,
  IconInfoCircle,
  IconMail,
  IconRefresh,
} from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

type Channel = 'bell' | 'email' | 'discord' | 'slack' | 'telegram' | 'webhook';

const CHANNELS: ReadonlyArray<{ key: Channel; label: string; icon: React.ReactElement }> = [
  { key: 'bell', label: 'Bell', icon: <IconBell size={14} /> },
  { key: 'email', label: 'Email', icon: <IconMail size={14} /> },
  { key: 'discord', label: 'Discord', icon: <IconBrandDiscord size={14} /> },
  { key: 'slack', label: 'Slack', icon: <IconBrandSlack size={14} /> },
  { key: 'telegram', label: 'Telegram', icon: <IconBrandTelegram size={14} /> },
  { key: 'webhook', label: 'Webhook', icon: <IconApi size={14} /> },
];

interface CuratedEvent {
  type: NotificationEventType;
  label: string;
  group: 'Library' | 'Downloads' | 'System' | 'Backups';
}

// Curated subset of the 80+ NotificationEventType enum — covers the events
// most users would want to manage. Power users can extend or set non-curated
// types via the API directly.
const CURATED_EVENTS: ReadonlyArray<CuratedEvent> = [
  { type: NotificationEventType.MANGA_ADDED, label: 'Manga added to library', group: 'Library' },
  { type: NotificationEventType.MANGA_UPDATED, label: 'Manga metadata updated', group: 'Library' },
  { type: NotificationEventType.METADATA_UPDATED, label: 'Metadata refresh completed', group: 'Library' },
  { type: NotificationEventType.LIBRARY_SCAN_COMPLETED, label: 'Library scan finished', group: 'Library' },
  { type: NotificationEventType.LIBRARY_SCAN_FAILED, label: 'Library scan failed', group: 'Library' },
  { type: NotificationEventType.CHAPTER_ADDED, label: 'New chapter detected', group: 'Downloads' },
  { type: NotificationEventType.CHAPTER_DOWNLOADED, label: 'Chapter downloaded', group: 'Downloads' },
  { type: NotificationEventType.CHAPTER_FAILED, label: 'Chapter download failed', group: 'Downloads' },
  { type: NotificationEventType.VOLUME_DOWNLOADED, label: 'Volume downloaded', group: 'Downloads' },
  { type: NotificationEventType.BACKUP_COMPLETED, label: 'Backup completed', group: 'Backups' },
  { type: NotificationEventType.BACKUP_FAILED, label: 'Backup failed', group: 'Backups' },
  { type: NotificationEventType.SYSTEM_ERROR, label: 'System error', group: 'System' },
  { type: NotificationEventType.SYSTEM_WARNING, label: 'System warning', group: 'System' },
];

function defaultEnabled(channel: Channel): boolean {
  return channel === 'bell';
}

function isCellEnabled(
  matrix: Array<{ eventType: string; channel: string; enabled: boolean }>,
  eventType: NotificationEventType,
  channel: Channel,
): boolean {
  const row = matrix.find((r) => r.eventType === eventType && r.channel === channel);
  return row ? row.enabled : defaultEnabled(channel);
}

export function PreferenceMatrix(): React.ReactElement {
  const utils = trpc.useUtils();
  const { data: matrix = [], isLoading } = trpc.notifications.getPreferenceMatrix.useQuery();

  const setPref = trpc.notifications.setPreference.useMutation({
    onSuccess: async () => {
      await utils.notifications.getPreferenceMatrix.invalidate();
    },
    onError: (error) => {
      notify({
        severity: 'ERROR',
        title: 'Could not save preference',
        message: error.message,
      });
    },
  });

  const resetAll = trpc.notifications.resetPreferences.useMutation({
    onSuccess: async (data) => {
      await utils.notifications.getPreferenceMatrix.invalidate();
      notify({
        severity: 'SUCCESS',
        title: 'Preferences reset',
        message: `Cleared ${data.deleted} customizations — defaults are back in effect.`,
      });
    },
  });

  const handleToggle = (eventType: NotificationEventType, channel: Channel, next: boolean): void => {
    setPref.mutate({ eventType, channel, enabled: next });
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  }

  const groups = Array.from(new Set(CURATED_EVENTS.map((e) => e.group)));

  return (
    <Stack gap="md">
      <Alert icon={<IconInfoCircle size={16} />} color="blue">
        Pick which channels receive each event. The bell dropdown is on by default; external
        channels are off until you opt in here AND configure them under the channel tabs above.
      </Alert>

      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          {matrix.length === 0 ? 'Using default preferences.' : `${matrix.length} customization${matrix.length === 1 ? '' : 's'} active.`}
        </Text>
        <Tooltip label="Delete all customizations and revert to defaults">
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={<IconRefresh size={14} />}
            onClick={() => resetAll.mutate()}
            loading={resetAll.isPending}
            disabled={matrix.length === 0}
          >
            Reset all
          </Button>
        </Tooltip>
      </Group>

      <Box style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 220 }}>Event</Table.Th>
              {CHANNELS.map((c) => (
                <Table.Th key={c.key} style={{ textAlign: 'center' }}>
                  <Group gap={4} justify="center">
                    {c.icon}
                    <Text size="xs">{c.label}</Text>
                  </Group>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {groups.map((group) => (
              <React.Fragment key={group}>
                <Table.Tr>
                  <Table.Td colSpan={CHANNELS.length + 1} style={{ backgroundColor: 'var(--mantine-color-dark-7)' }}>
                    <Badge size="xs" variant="light" color="gray">{group}</Badge>
                  </Table.Td>
                </Table.Tr>
                {CURATED_EVENTS.filter((e) => e.group === group).map((event) => (
                  <Table.Tr key={event.type}>
                    <Table.Td>
                      <Text size="sm">{event.label}</Text>
                      <Text size="xs" c="dimmed">{event.type}</Text>
                    </Table.Td>
                    {CHANNELS.map((channel) => (
                      <Table.Td key={channel.key} style={{ textAlign: 'center' }}>
                        <Switch
                          size="sm"
                          checked={isCellEnabled(matrix, event.type, channel.key)}
                          onChange={(ev) => handleToggle(event.type, channel.key, ev.currentTarget.checked)}
                          disabled={setPref.isPending}
                        />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </React.Fragment>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </Stack>
  );
}
