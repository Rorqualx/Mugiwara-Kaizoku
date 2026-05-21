import type { ReactElement } from 'react';

import {
  Paper,
  Group,
  Stack,
  Alert,
  Text,
  Anchor,
  Badge,
  Divider,
  List,
  ThemeIcon
} from '@mantine/core';
import {
  IconInfoCircle,
  IconX,
  IconBell,
  IconExternalLink
} from '@tabler/icons-react';

import { IntegrationStatusRow } from '@/components/settings/integrations/IntegrationStatusRow';

interface AppriseStatusData {
  enabled?: boolean;
  configured?: boolean;
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'not-configured';
  version?: string;
  serviceCount?: number | null;
  connectionError?: string | null;
}

interface AppriseStatusTabProps {
  statusData: AppriseStatusData | undefined;
  currentServices: string[];
}

/**
 * Get status badge color based on connection status
 */
function getStatusColor(status: string): string {
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
 * Get status label text based on connection status
 */
function getStatusLabel(status: string): string {
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

/**
 * Check if service count should be displayed
 */
function shouldShowServiceCount(serviceCount: number | null | undefined): boolean {
  return serviceCount !== null && serviceCount !== undefined && serviceCount > 0;
}

/**
 * Service configuration section component
 */
function ServiceConfiguration({
  serviceCount,
  currentServices
}: {
  serviceCount: number;
  currentServices: string[];
}): ReactElement {
  return (
    <>
      <Divider my="xs" />
      <Text fw={500} size="sm" c="dimmed">Service Configuration</Text>

      <IntegrationStatusRow
        label="Total Services"
        value={String(serviceCount)}
        valueColor="blue"
      />

      {currentServices.length > 0 && (
        <Stack gap="xs">
          <Text fw={500} size="sm">Configured Service Types:</Text>
          <List
            size="sm"
            spacing="xs"
            icon={
              <ThemeIcon color="blue" size={20} radius="xl">
                <IconBell size={12} />
              </ThemeIcon>
            }
          >
            {currentServices.map((url, index) => {
              const protocol = url.split('://')[0];
              return (
                <List.Item key={index}>
                  <Text size="sm" c="dimmed">
                    {protocol}
                  </Text>
                </List.Item>
              );
            })}
          </List>
        </Stack>
      )}
    </>
  );
}

/**
 * Configuration status alerts component
 */
function ConfigurationAlerts({ configured }: { configured: boolean }): ReactElement {
  if (!configured) {
    return (
      <Alert icon={<IconInfoCircle />} color="gray">
        Configure your Apprise server URL and service URLs in the Connection tab to enable
        multi-service notifications.
      </Alert>
    );
  }

  return (
    <Alert icon={<IconInfoCircle />} color="blue">
      <Stack gap="xs">
        <Text size="sm" fw={500}>Supported Services</Text>
        <Text size="sm">
          Apprise supports over 90 notification services including Discord, Slack, Telegram,
          Email (SMTP), Pushover, Pushbullet, Gotify, and many more.
        </Text>
        <Anchor
          href="https://github.com/caronc/apprise/wiki"
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
        >
          View all supported services <IconExternalLink size={12} />
        </Anchor>
      </Stack>
    </Alert>
  );
}

/**
 * Basic status rows component
 */
function BasicStatusRows({
  enabled,
  configured
}: {
  enabled: boolean;
  configured: boolean;
}): ReactElement {
  return (
    <>
      <IntegrationStatusRow
        label="Enabled"
        value={enabled ? 'Yes' : 'No'}
        valueColor={enabled ? 'green' : 'gray'}
      />

      <IntegrationStatusRow
        label="Configured"
        value={configured ? 'Yes' : 'No'}
        valueColor={configured ? 'green' : 'gray'}
      />
    </>
  );
}

/**
 * Status information tab for Apprise integration
 */
export function AppriseStatusTab({
  statusData,
  currentServices
}: AppriseStatusTabProps): ReactElement {
  const connectionStatus = statusData?.connectionStatus ?? 'not-configured';

  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={500}>Integration Status</Text>
            <Text size="sm" c="dimmed">View connection status and configured services</Text>
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

          <BasicStatusRows
            enabled={statusData?.enabled ?? false}
            configured={statusData?.configured ?? false}
          />

          {statusData?.version && (
            <>
              <Divider my="xs" />
              <IntegrationStatusRow
                label="Apprise Version"
                value={statusData.version}
                valueColor="blue"
              />
            </>
          )}

          {shouldShowServiceCount(statusData?.serviceCount) && statusData?.serviceCount && (
            <ServiceConfiguration
              serviceCount={statusData.serviceCount}
              currentServices={currentServices}
            />
          )}

          {statusData?.connectionError && (
            <Alert icon={<IconX />} color="red">
              Connection Error: {statusData.connectionError}
            </Alert>
          )}

          <ConfigurationAlerts configured={statusData?.configured ?? false} />
        </Stack>
      </Stack>
    </Paper>
  );
}
