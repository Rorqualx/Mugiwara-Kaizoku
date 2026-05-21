import type { ReactElement } from 'react';

import {
  Paper,
  Group,
  Stack,
  Alert,
  Text,
  Badge,
  Divider
} from '@mantine/core';
import { IconInfoCircle, IconX } from '@tabler/icons-react';

import { IntegrationStatusRow } from '@/components/settings/integrations/IntegrationStatusRow';

interface BotInfo {
  username: string;
  firstName: string;
}

interface TelegramStatusData {
  enabled?: boolean;
  configured?: boolean;
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'not-configured';
  botInfo?: BotInfo;
  connectionError?: string | null;
}

interface TelegramStatusTabProps {
  statusData: TelegramStatusData | undefined;
}

/**
 * Status information tab for Telegram integration
 */
export function TelegramStatusTab({ statusData }: TelegramStatusTabProps): ReactElement {
  const connectionStatus = statusData?.connectionStatus ?? 'not-configured';

  const getStatusColor = (status: string): string => {
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
  };

  const getStatusLabel = (status: string): string => {
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
  };

  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={500}>Integration Status</Text>
            <Text size="sm" c="dimmed">View connection status and bot information</Text>
          </div>
        </Group>

        <Divider />

        <Stack gap="md">
          <IntegrationStatusRow
            label="Connection Status"
            value={
              <Badge color={getStatusColor(connectionStatus)}>
                {getStatusLabel(connectionStatus)}
              </Badge>
            }
          />

          <IntegrationStatusRow
            label="Enabled"
            value={statusData?.enabled ? 'Yes' : 'No'}
            valueColor={statusData?.enabled ? 'green' : 'gray'}
          />

          <IntegrationStatusRow
            label="Configured"
            value={statusData?.configured ? 'Yes' : 'No'}
            valueColor={statusData?.configured ? 'green' : 'gray'}
          />

          {statusData?.botInfo && (
            <>
              <Divider my="xs" />
              <Text fw={500} size="sm" c="dimmed">Bot Information</Text>

              <Group justify="space-between">
                <Text fw={500}>Bot Username</Text>
                <Text size="sm">@{statusData.botInfo.username}</Text>
              </Group>

              <Group justify="space-between">
                <Text fw={500}>Bot Name</Text>
                <Text size="sm">{statusData.botInfo.firstName}</Text>
              </Group>
            </>
          )}

          {statusData?.connectionError && (
            <Alert icon={<IconX />} color="red">
              Connection Error: {statusData.connectionError}
            </Alert>
          )}

          {!statusData?.configured && (
            <Alert icon={<IconInfoCircle />} color="gray">
              Configure your bot token and chat ID in the Connection tab to enable Telegram notifications.
            </Alert>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
