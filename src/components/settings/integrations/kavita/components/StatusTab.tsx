/**
 * Kavita Integration Status Tab Component
 *
 * Displays the current connection status, sync configuration, and server information
 * for the Kavita integration. Shows connection state, last sync time, auto-sync settings,
 * sync direction, and any connection errors.
 *
 * @module kavita/components/StatusTab
 */

import { Alert, Badge, Divider, Group, Paper, Stack, Text } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

import type { ConnectionStatus, StatusData } from '@/components/settings/integrations/kavita/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for StatusTab component
 */
interface StatusTabProps {
  connectionStatus: ConnectionStatus;
  statusData: StatusData | undefined;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns the Badge color based on connection status
 * @param status - The connection status
 * @returns Badge color string
 */
function getConnectionStatusColor(status: ConnectionStatus): string {
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

/**
 * Returns the Badge label text based on connection status
 * @param status - The connection status
 * @returns Status label string
 */
function getConnectionStatusLabel(status: ConnectionStatus): string {
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

// ============================================================================
// Component
// ============================================================================

/**
 * StatusTab Component
 *
 * Renders the status tab panel showing integration health and configuration.
 * Displays connection status with color-coded badges, server URL, last sync time,
 * auto-sync configuration, sync direction, and any error messages.
 */
export function StatusTab({
  connectionStatus,
  statusData,
}: StatusTabProps): React.ReactElement {
  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <Text fw={500}>Integration Status</Text>
            <Text size="sm" c="dimmed">
              View connection and synchronization status
            </Text>
          </div>
        </Group>

        <Divider />

        {/* Status Details */}
        <Stack gap="md">
          {/* Connection Status */}
          <Group justify="space-between">
            <Text fw={500}>Connection Status</Text>
            <Badge color={getConnectionStatusColor(connectionStatus)}>
              {getConnectionStatusLabel(connectionStatus)}
            </Badge>
          </Group>

          {/* Server URL */}
          {statusData?.host && (
            <Group justify="space-between">
              <Text fw={500}>Server URL</Text>
              <Text size="sm">{statusData.host}</Text>
            </Group>
          )}

          {/* Last Sync */}
          {statusData?.lastSync && (
            <Group justify="space-between">
              <Text fw={500}>Last Sync</Text>
              <Text size="sm">
                {new Date(statusData.lastSync).toLocaleString()}
              </Text>
            </Group>
          )}

          {/* Auto Sync Status */}
          <Group justify="space-between">
            <Text fw={500}>Auto Sync</Text>
            <Badge color={statusData?.autoSync ? 'green' : 'gray'}>
              {statusData?.autoSync ? 'Enabled' : 'Disabled'}
            </Badge>
          </Group>

          {/* Sync Interval */}
          {statusData?.autoSync && (
            <Group justify="space-between">
              <Text fw={500}>Sync Interval</Text>
              <Text size="sm">{statusData.syncInterval} minutes</Text>
            </Group>
          )}

          {/* Sync Direction */}
          <Group justify="space-between">
            <Text fw={500}>Sync Direction</Text>
            <Text size="sm">
              {statusData?.syncDirection === 'toKavita'
                ? 'To Kavita Only'
                : statusData?.syncDirection === 'fromKavita'
                  ? 'From Kavita Only'
                  : 'Bidirectional'}
            </Text>
          </Group>

          {/* Connection Error Alert */}
          {statusData?.connectionError && (
            <Alert icon={<IconX />} color="red">
              Connection Error: {statusData.connectionError}
            </Alert>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
