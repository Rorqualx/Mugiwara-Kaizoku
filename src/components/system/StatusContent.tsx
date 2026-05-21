/**
 * StatusContent component for displaying comprehensive system status information
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';

import { Grid, Paper, Text, Group, Loader, Button, Stack, Progress, Badge } from '@mantine/core';
import { IconRefresh, IconAlertCircle } from '@tabler/icons-react';

import { useRealTime } from '@/providers/RealTimeProvider';
import type { ExtendedSystemMetrics, DatabaseInfo, DockerInfoType } from '@/types/system';
import { trpc } from '@/utils/trpc-client/index';

import ApplicationInfo from './ApplicationInfo';
import DatabaseStatus from './DatabaseStatus';
import DockerInfo from './DockerInfo';
import SystemResources from './SystemResources';

import type os from 'os';

// Default values for component data
const defaultApplicationInfo = {
  version: 'Unknown',
  nodeEnv: 'development',
  port: 3000,
  nodeVersion: 'Unknown',
  startTime: new Date().toISOString()
};

const defaultDatabaseInfo: DatabaseInfo = {
  name: 'Unknown',
  host: 'Unknown',
  port: '5432',
  user: 'Unknown',
  isConnected: false,
  connected: false,
  type: 'postgresql',
  database: 'Unknown',
  poolSize: 0,
  activeConnections: 0
};

const defaultSystemMetrics: ExtendedSystemMetrics = {
  cpu: { usage: 0, cores: 1 },
  memory: { total: 0, used: 0, free: 0, percentage: 0 },
  disk: { total: 0, used: 0, free: 0, percentage: 0 },
  network: { rx: 0, tx: 0 }
};

const defaultDockerInfo: DockerInfoType = {
  isDocker: false
};

/**
 * Get health status color based on score
 */
function getHealthColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

interface HealthInputs {
  isDatabaseConnected: boolean;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
}

// DB connectivity is the heaviest signal (the app is dead without it); resource
// pressure shaves 10–25 points each so a heavily-loaded but functioning host
// doesn't show as "100% healthy" when it isn't.
function calculateHealthScore(inputs: HealthInputs): number {
  let score = 100;
  if (!inputs.isDatabaseConnected) score -= 50;
  if (inputs.memoryUsagePercent > 90) score -= 25;
  else if (inputs.memoryUsagePercent > 80) score -= 10;
  if (inputs.diskUsagePercent > 95) score -= 25;
  else if (inputs.diskUsagePercent > 85) score -= 10;
  if (inputs.cpuUsagePercent > 90) score -= 10;
  return Math.max(0, score);
}

/**
 * Render loading state
 */
function renderLoadingState(): JSX.Element {
  return (
    <Group justify="center" style={{ minHeight: '50vh' }}>
      <Loader size="xl" />
      <Text size="xl">Loading system information...</Text>
    </Group>
  );
}

/**
 * Render error state
 */
function renderErrorState(): JSX.Element {
  return (
    <Paper p="xl" withBorder>
      <Text c="red" fw={700} mb="md">Error Loading System Information</Text>
      <Text>Failed to load system status. Please check your connection and try again.</Text>
    </Paper>
  );
}

/**
 * Render system health score section
 */
function renderHealthScore(healthScore: number): JSX.Element {
  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" align="center" mb="md">
        <Text size="lg" fw={700}>System Health</Text>
        <Badge
          size="lg"
          color={getHealthColor(healthScore)}
          leftSection={healthScore < 60 ? <IconAlertCircle size={16} /> : null}>
          {healthScore}%
        </Badge>
      </Group>
      <Progress
        value={healthScore}
        color={getHealthColor(healthScore)}
        size="xl"
        radius="xl"
        mb="sm" />
      {healthScore < 80 &&
        <Text size="sm" c="dimmed">
          {healthScore < 60 ? 'Critical issues detected' : 'System needs attention'}
        </Text>
      }
    </Paper>
  );
}

/**
 * Render action buttons section
 */
function renderActionButtons(
  isLoading: boolean,
  onRefresh: () => void
): JSX.Element {
  return (
    <Group justify="flex-end">
      <Button
        variant="light"
        size="xs"
        onClick={onRefresh}
        leftSection={<IconRefresh size={16} />}
        loading={isLoading}>
        Refresh Status
      </Button>
    </Group>
  );
}

/**
 * Render application info section
 */
function renderApplicationInfo(application: {
  version: string | number;
  nodeEnv: string;
  port?: string | number | undefined;
  nodeVersion: string;
  startTime: string;
}): JSX.Element {
  const port = application.port ?? 3000;
  return (
    <Grid.Col span={{ base: 12, md: 6 }}>
      <ApplicationInfo data={{
        version: String(application.version),
        nodeEnv: String(application.nodeEnv),
        port: typeof port === 'string' ?
          parseInt(port, 10) :
          Number(port),
        nodeVersion: String(application.nodeVersion),
        startTime: String(application.startTime)
      }} />
    </Grid.Col>
  );
}

/**
 * Render database status section
 */
function renderDatabaseStatus(database: DatabaseInfo): JSX.Element {
  return (
    <Grid.Col span={{ base: 12, md: 6 }}>
      <DatabaseStatus data={{
        name: database.name,
        host: database.host,
        port: database.port,
        user: database.user,
        isConnected: database.isConnected
      }} />
    </Grid.Col>
  );
}

/**
 * Render system resources section
 */
function renderSystemResources(systemData: unknown): JSX.Element {
  const system = systemData as {
    platform?: NodeJS.Platform;
    arch?: string;
    cpus?: Array<{ model: string; speed: number; times: { user: number; nice: number; sys: number; idle: number; irq: number } }>;
    totalMemory?: number;
    freeMemory?: number;
    uptime?: number;
    loadAvg?: number[];
    hostname?: string;
    networkInterfaces?: Record<string, Array<{ address: string; netmask: string; family: 'IPv4' | 'IPv6'; mac: string; internal: boolean; cidr: string | null; scopeid?: number }> | undefined>;
  } | undefined;

  return (
    <Grid.Col span={12}>
      <SystemResources data={{
        platform: (system?.platform ?? 'linux') as NodeJS.Platform,
        arch: system?.arch ?? 'x64',
        cpus: system?.cpus ?? [],
        totalMemory: system?.totalMemory ?? 0,
        freeMemory: system?.freeMemory ?? 0,
        uptime: system?.uptime ?? 0,
        loadAvg: system?.loadAvg ?? [0, 0, 0],
        hostname: system?.hostname ?? 'Unknown',
        networkInterfaces: (system?.networkInterfaces ?? {}) as NodeJS.Dict<os.NetworkInterfaceInfo[]>
      }} detailed />
    </Grid.Col>
  );
}

/**
 * Render docker info section if in docker environment
 */
function renderDockerInfo(
  isDockerEnvironment: boolean,
  docker: DockerInfoType
): JSX.Element | null {
  if (!isDockerEnvironment) {
    return null;
  }

  return (
    <Grid.Col span={12}>
      <DockerInfo data={docker as {isDocker: boolean;containerInfo: {port: number;timezone: string;} | null;}} />
    </Grid.Col>
  );
}

export const StatusContent: FC = () => {
  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  const [mockHealthData, setMockHealthData] = useState<{
    status: string;
    details: {
      database: DatabaseInfo;
      docker: DockerInfoType;
    };
  }>({
    status: 'healthy',
    details: {
      database: defaultDatabaseInfo,
      docker: defaultDockerInfo
    }
  });

  // Use available tRPC endpoints or mock data with WebSocket + polling fallback
  const { data: systemData, isLoading: systemLoading, refetch: refetchSystem } = trpc.system.getStatus.useQuery(undefined, {
    refetchInterval: isConnected ? false : 30000 // Only poll when WebSocket disconnected
  });

  // Memoized refetch function for stable dependency
  const memoizedRefetch = useCallback((): void => {
    void refetchSystem();
  }, [refetchSystem]);

  // Subscribe to WebSocket system status events for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('system:status', () => {
      memoizedRefetch();
    });

    return unsubscribe;
  }, [isConnected, subscribe, memoizedRefetch]);

  // Update mock health data when system data changes
  useEffect(() => {
    if (systemData) {
      setMockHealthData((prev) => ({
        ...prev,
        status: systemData.status,
        details: {
          ...prev.details,
          database: systemData.database,
          docker: systemData.docker
        }
      }));
    }
  }, [systemData]);

  // Combine loading states
  const isLoading = systemLoading;

  // Construct status data from available data
  const statusData = {
    status: systemData?.status ?? mockHealthData["status"],
    application: systemData?.application ?? defaultApplicationInfo,
    database: systemData?.database ?? mockHealthData.details.database,
    system: defaultSystemMetrics,
    docker: systemData?.docker ?? mockHealthData.details.docker
  };

  // Calculate system health score from DB connectivity + resource pressure.
  const cpuUsage = systemData?.system.cpu.usage ?? 0;
  const memoryUsage = systemData?.system.memory.usagePercent ?? 0;
  const diskUsage = systemData?.system.disk.usagePercent ?? 0;
  const healthScore: number = useMemo(() => {
    return calculateHealthScore({
      isDatabaseConnected: statusData.database.isConnected,
      cpuUsagePercent: cpuUsage,
      memoryUsagePercent: memoryUsage,
      diskUsagePercent: diskUsage
    });
  }, [statusData.database.isConnected, cpuUsage, memoryUsage, diskUsage]);

  // Combined refetch function
  const refetchAll = (): void => {
    void refetchSystem();
  };

  // Force refresh on mount to ensure the latest status
  useEffect(() => {
    void refetchSystem();
  }, [refetchSystem]);

  if (isLoading) {
    return renderLoadingState();
  }

  // Check for any errors
  const hasError = systemData === undefined && !systemLoading;
  if (hasError) {
    return renderErrorState();
  }

  // Check if docker data exists
  const isDockerEnvironment = Boolean(statusData.docker.isDocker);

  return (
    <Stack gap="lg">
      {/* Action Buttons */}
      {renderActionButtons(isLoading, () => void refetchAll())}

      {/* System Health Score */}
      {renderHealthScore(healthScore)}

      {/* System Components */}
      <Grid>
        {renderApplicationInfo(statusData.application)}
        {renderDatabaseStatus(statusData.database)}
        {renderSystemResources(systemData?.system)}
        {renderDockerInfo(isDockerEnvironment, statusData.docker)}
      </Grid>
    </Stack>
  );
};