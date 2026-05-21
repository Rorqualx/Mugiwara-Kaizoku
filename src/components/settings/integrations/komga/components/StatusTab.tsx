import React from 'react';

import { Paper, Group, Stack, Divider, Badge, Alert, Text } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

export interface KomgaStatus {
  enabled: boolean;
  configured: boolean;
  host: string | null;
  authMethod: 'basic' | 'apikey';
  lastSync?: string;
  autoSync: boolean;
  syncInterval: number;
  syncDirection: 'bidirectional' | 'to-komga' | 'from-komga';
  selectedLibraries: string[];
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'not-configured';
  connectionError?: string | null;
}

export interface StatusTabProps {
  status: KomgaStatus | undefined;
}

function getConnectionStatusColor(status: string): string {
  switch (status) {
    case 'connected':
      return 'green';
    case 'disconnected':
      return 'orange';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}

function getConnectionStatusLabel(status: string): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'disconnected':
      return 'Disconnected';
    case 'error':
      return 'Error';
    default:
      return 'Not Configured';
  }
}

function getSyncDirectionLabel(direction?: string): string {
  switch (direction) {
    case 'toKomga':
    case 'to-komga':
      return 'To Komga Only';
    case 'fromKomga':
    case 'from-komga':
      return 'From Komga Only';
    default:
      return 'Bidirectional';
  }
}

export function StatusTab({ status }: StatusTabProps): React.ReactElement {
  if (!status) {
    return (
      <Paper p="lg" withBorder>
        <Alert color="gray">No status information available</Alert>
      </Paper>
    );
  }

  const connectionStatus = status.connectionStatus;

  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={500}>Integration Status</Text>
            <Text size="sm" c="dimmed">View connection and synchronization status</Text>
          </div>
        </Group>

        <Divider />

        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={500}>Connection Status</Text>
            <Badge color={getConnectionStatusColor(connectionStatus)}>
              {getConnectionStatusLabel(connectionStatus)}
            </Badge>
          </Group>

          {status.host && (
            <Group justify="space-between">
              <Text fw={500}>Server URL</Text>
              <Text size="sm">{status.host}</Text>
            </Group>
          )}

          <Group justify="space-between">
            <Text fw={500}>Authentication Method</Text>
            <Badge color={status.authMethod === 'apikey' ? 'blue' : 'green'}>
              {status.authMethod === 'apikey' ? 'API Key' : 'Basic Auth'}
            </Badge>
          </Group>

          {status.lastSync && (
            <Group justify="space-between">
              <Text fw={500}>Last Sync</Text>
              <Text size="sm">
                {new Date(status.lastSync).toLocaleString()}
              </Text>
            </Group>
          )}

          <Group justify="space-between">
            <Text fw={500}>Auto Sync</Text>
            <Badge color={status.autoSync ? 'green' : 'gray'}>
              {status.autoSync ? 'Enabled' : 'Disabled'}
            </Badge>
          </Group>

          {status.autoSync && (
            <Group justify="space-between">
              <Text fw={500}>Sync Interval</Text>
              <Text size="sm">{status.syncInterval} minutes</Text>
            </Group>
          )}

          <Group justify="space-between">
            <Text fw={500}>Sync Direction</Text>
            <Text size="sm">
              {getSyncDirectionLabel(status.syncDirection)}
            </Text>
          </Group>

          {status.connectionError && (
            <Alert icon={<IconX />} color="red">
              Connection Error: {status.connectionError}
            </Alert>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
