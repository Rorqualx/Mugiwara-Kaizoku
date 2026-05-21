/**
 * FlareSolverr Metrics Dashboard
 *
 * Main dashboard component combining metric cards and charts for health monitoring
 *
 * @module components/flaresolverr/metrics/FlareSolverrMetricsDashboard
 */

import React, { useEffect, useCallback, useState } from 'react';

import {
  Stack,
  Group,
  Title,
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Alert,
  Text,
  Switch,
  NumberInput,
  Button,
  Collapse,
  Card,
  Tabs,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import {
  IconRefresh,
  IconSettings,
  IconCheck,
  IconAlertCircle,
  IconChartBar,
  IconList,
} from '@tabler/icons-react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { trpc } from '@/utils/trpc-client/index';

import { ResponseTimeChart, UptimeHistoryChart, RequestThroughputChart } from './FlareSolverrCharts';
import { FlareSolverrMetricCards } from './FlareSolverrMetricCards';
import { FlareSolverrRequestDetails } from './FlareSolverrRequestDetails';

// ============================================================================
// Types
// ============================================================================

type StatsPeriod = '1h' | '24h' | '7d';

// Map period to hours for raw metrics query
const periodToHours: Record<StatsPeriod, number> = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
};

// ============================================================================
// Main Component
// ============================================================================

export function FlareSolverrMetricsDashboard(): React.ReactElement {
  const [period, setPeriod] = useState<StatsPeriod>('24h');
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [settingsOpen, { toggle: toggleSettings }] = useDisclosure(false);
  const { isConnected, subscribe } = useRealTime();

  // Queries
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = trpc.flaresolverr.getAggregatedStats.useQuery(
    { period },
    { refetchInterval: isConnected ? false : 60000 }
  );

  const {
    data: hourlyMetrics,
    isLoading: hourlyLoading,
    refetch: refetchHourly,
  } = trpc.flaresolverr.getHourlyMetrics.useQuery(
    { days: 7 },
    { refetchInterval: isConnected ? false : 300000 }
  );

  const {
    data: recentMetrics,
    isLoading: recentLoading,
    refetch: refetchRecent,
  } = trpc.flaresolverr.getRecentMetrics.useQuery(
    { hours: periodToHours[period] },
    { refetchInterval: isConnected ? false : 60000 }
  );

  const {
    data: metricsConfig,
    refetch: refetchConfig,
  } = trpc.flaresolverr.getMetricsConfig.useQuery();

  // Mutations
  const updateConfigMutation = trpc.flaresolverr.updateMetricsConfig.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Config Updated',
        message: 'Metrics configuration saved successfully',
        color: 'green',
        icon: <IconCheck />,
      });
      void refetchConfig();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: error.message,
        color: 'red',
        icon: <IconAlertCircle />,
      });
    },
  });

  // Local state for config form
  const [configForm, setConfigForm] = useState({
    metricsEnabled: true,
    metricsRetentionDays: 7,
    hourlyRetentionDays: 30,
  });

  // Update form when config loads
  useEffect(() => {
    if (metricsConfig) {
      setConfigForm({
        metricsEnabled: metricsConfig.metricsEnabled,
        metricsRetentionDays: metricsConfig.metricsRetentionDays,
        hourlyRetentionDays: metricsConfig.hourlyRetentionDays,
      });
    }
  }, [metricsConfig]);

  // Refresh all data
  const handleRefresh = useCallback((): void => {
    void refetchStats();
    void refetchHourly();
    void refetchRecent();
  }, [refetchStats, refetchHourly, refetchRecent]);

  // Subscribe to WebSocket for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('flaresolverr:metrics', () => {
      void refetchStats();
      void refetchRecent();
    });

    return unsubscribe;
  }, [isConnected, subscribe, refetchStats, refetchRecent]);

  // Handle config save
  const handleSaveConfig = (): void => {
    updateConfigMutation.mutate(configForm);
  };

  // Period labels for segmented control
  const periodLabels = [
    { value: '1h', label: '1 Hour' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
  ];

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <Title order={4}>Health Metrics</Title>
        <Group gap="sm">
          <SegmentedControl
            value={period}
            onChange={(v) => setPeriod(v as StatsPeriod)}
            data={periodLabels}
            size="xs"
          />
          <Tooltip label="Metrics Settings">
            <ActionIcon variant="subtle" onClick={toggleSettings}>
              <IconSettings size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Refresh">
            <ActionIcon variant="subtle" onClick={handleRefresh} loading={statsLoading}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Metrics disabled alert */}
      {metricsConfig && !metricsConfig.metricsEnabled && (
        <Alert color="yellow" icon={<IconAlertCircle />}>
          <Text size="sm">
            Metrics collection is currently disabled. Enable it in settings to start tracking health data.
          </Text>
        </Alert>
      )}

      {/* Settings Panel */}
      <Collapse in={settingsOpen}>
        <Card withBorder p="md">
          <Stack gap="md">
            <Text fw={500}>Metrics Configuration</Text>
            <Switch
              label="Enable Metrics Collection"
              checked={configForm.metricsEnabled}
              onChange={(e) => setConfigForm((c) => ({ ...c, metricsEnabled: e.currentTarget.checked }))}
            />
            <Group grow>
              <NumberInput
                label="Raw Metrics Retention (days)"
                description="How long to keep detailed metrics"
                value={configForm.metricsRetentionDays}
                onChange={(v) => setConfigForm((c) => {
                  const n = Number(v);
                  return { ...c, metricsRetentionDays: Number.isFinite(n) && n > 0 ? n : 7 };
                })}
                min={1}
                max={90}
              />
              <NumberInput
                label="Hourly Aggregation Retention (days)"
                description="How long to keep hourly summaries"
                value={configForm.hourlyRetentionDays}
                onChange={(v) => setConfigForm((c) => {
                  const n = Number(v);
                  return { ...c, hourlyRetentionDays: Number.isFinite(n) && n > 0 ? n : 30 };
                })}
                min={1}
                max={365}
              />
            </Group>
            <Group justify="flex-end">
              <Button
                size="xs"
                onClick={handleSaveConfig}
                loading={updateConfigMutation.isPending}
              >
                Save Settings
              </Button>
            </Group>
          </Stack>
        </Card>
      </Collapse>

      {/* Metric Cards - Always visible */}
      <FlareSolverrMetricCards stats={stats} isLoading={statsLoading} />

      {/* Tabs for Overview and Request Details */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconChartBar size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="requests" leftSection={<IconList size={16} />}>
            Request Details
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            {/* Charts */}
            <ResponseTimeChart metrics={hourlyMetrics} isLoading={hourlyLoading} />

            <Group grow>
              <UptimeHistoryChart metrics={hourlyMetrics} isLoading={hourlyLoading} />
              <RequestThroughputChart metrics={hourlyMetrics} isLoading={hourlyLoading} />
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="requests" pt="md">
          <FlareSolverrRequestDetails metrics={recentMetrics} isLoading={recentLoading} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

export default FlareSolverrMetricsDashboard;
