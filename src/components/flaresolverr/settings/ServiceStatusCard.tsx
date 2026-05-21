/**
 * Service Status card — renders health badges, version, session count and
 * URL plus the outdated/lifecycle alerts.
 *
 * @module components/flaresolverr/settings/ServiceStatusCard
 */

import React from 'react';

import {
  Card,
  Title,
  Group,
  Badge,
  Text,
  Tooltip,
  ActionIcon,
  SimpleGrid,
  Loader,
  Alert,
} from '@mantine/core';
import { IconRefresh, IconAlertTriangle } from '@tabler/icons-react';

import { getStatusColor, getStatusIcon, getStatusText } from './helpers';

interface LifecycleStatus {
  consecutiveFailures: number;
  isRestarting: boolean;
  canRestart?: boolean;
}

interface HealthStatus {
  enabled: boolean;
  healthy: boolean;
  version?: string | null;
  isOutdated?: boolean | null;
  minimumVersion?: string;
  sessionCount?: number;
  url?: string;
  isRunning?: boolean;
  lifecycleStatus?: LifecycleStatus;
}

interface SessionDataLike {
  count: number;
}

interface SettingsLike {
  url: string;
}

interface ServiceStatusCardProps {
  healthStatus: HealthStatus | undefined;
  healthLoading: boolean;
  sessionData: SessionDataLike | undefined;
  settings: SettingsLike | undefined;
  onRefresh: () => void;
}

function StatusGrid({
  healthStatus,
  sessionData,
  settings,
}: Pick<ServiceStatusCardProps, 'healthStatus' | 'sessionData' | 'settings'>): React.ReactElement {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
      <div>
        <Text size="xs" c="dimmed" mb={4}>Status</Text>
        <Badge
          color={getStatusColor(healthStatus)}
          size="lg"
          leftSection={getStatusIcon(healthStatus?.healthy)}
        >
          {getStatusText(healthStatus)}
        </Badge>
      </div>
      <div>
        <Text size="xs" c="dimmed" mb={4}>Version</Text>
        <Group gap="xs">
          <Text size="xl" fw={700}>{healthStatus?.version ?? 'N/A'}</Text>
          {healthStatus?.isOutdated && (
            <Tooltip label={`Minimum version: ${healthStatus.minimumVersion}`}>
              <Badge color="orange" size="sm">Outdated</Badge>
            </Tooltip>
          )}
        </Group>
      </div>
      <div>
        <Text size="xs" c="dimmed" mb={4}>Active Sessions</Text>
        <Text size="xl" fw={700}>
          {healthStatus?.sessionCount ?? sessionData?.count ?? 0}
        </Text>
      </div>
      <div>
        <Text size="xs" c="dimmed" mb={4}>Connected URL</Text>
        <Text size="sm" truncate style={{ maxWidth: 200 }}>
          {healthStatus?.url ?? settings?.url ?? 'Not configured'}
        </Text>
      </div>
    </SimpleGrid>
  );
}

export function ServiceStatusCard({
  healthStatus,
  healthLoading,
  sessionData,
  settings,
  onRefresh,
}: ServiceStatusCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>Service Status</Title>
        <Tooltip label="Refresh status">
          <ActionIcon variant="subtle" onClick={onRefresh} loading={healthLoading}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {healthLoading && !healthStatus ? (
        <Group justify="center" p="md">
          <Loader size="sm" />
          <Text size="sm">Checking status...</Text>
        </Group>
      ) : (
        <StatusGrid healthStatus={healthStatus} sessionData={sessionData} settings={settings} />
      )}

      {healthStatus?.isOutdated && (
        <Alert icon={<IconAlertTriangle />} color="orange" variant="light" mt="md">
          <Text size="sm">
            Your FlareSolverr version ({healthStatus.version}) is below the minimum
            recommended version ({healthStatus.minimumVersion}). Consider updating for
            better Cloudflare bypass reliability.
          </Text>
        </Alert>
      )}

      {healthStatus?.lifecycleStatus && (
        <Group gap="md" mt="md">
          {healthStatus.lifecycleStatus.consecutiveFailures > 0 && (
            <Badge color="orange" variant="light">
              {healthStatus.lifecycleStatus.consecutiveFailures} consecutive failures
            </Badge>
          )}
          {healthStatus.lifecycleStatus.isRestarting && (
            <Badge color="blue" variant="light">Restarting...</Badge>
          )}
        </Group>
      )}
    </Card>
  );
}
