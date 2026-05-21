/**
 * ML Pattern Recognition Dashboard
 *
 * Admin interface for monitoring ML model performance, viewing metrics,
 * and managing feature flags.
 *
 * This is the main orchestrator component that uses custom hooks and
 * delegates rendering to specialized sub-components.
 */

import React, { useState, useEffect, useCallback } from 'react';

import {
  Container,
  Title,
  Group,
  Button,
  Switch,
  Tabs,
  Alert,
  LoadingOverlay,
  Notification
} from '@mantine/core';
import { UserRole } from '@prisma/client';
import {
  IconChartBar,
  IconSettings,
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconDatabase,
  IconArrowUp
} from '@tabler/icons-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip,
  Legend
} from 'chart.js';

import { MLMetricsDetail } from '@/components/ml/MLMetricsDetail';
import { MLMetricsOverview } from '@/components/ml/MLMetricsOverview';
import { MLModelsStatus } from '@/components/ml/MLModelsStatus';
import { MLSettingsPanel } from '@/components/ml/MLSettingsPanel';
import { useMLFeatureFlags } from '@/hooks/ml/useMLFeatureFlags';
import { useMLMetrics } from '@/hooks/ml/useMLMetrics';
import { useMLModels } from '@/hooks/ml/useMLModels';
import { auth } from '@/lib/auth/config';
import { useRealTime } from '@/providers/RealTimeProvider';
import type { MLFeatureFlags } from '@/types/ml/ml-api-types';
import type { MetricType, TimeInterval } from '@/types/ml/ml-dashboard-types';

import type { GetServerSidePropsContext } from 'next';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  ChartTitle,
  Tooltip,
  Legend
);

/**
 * Main ML Dashboard component that orchestrates sub-components
 */
export default function MLDashboard(): React.ReactElement {
  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // UI state
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('prediction');
  const [selectedInterval, setSelectedInterval] = useState<TimeInterval>('hour');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Use custom hooks for data fetching
  const {
    metrics,
    timeSeries,
    modelComparison,
    loading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useMLMetrics(selectedMetric, selectedInterval);

  const {
    featureFlags,
    mlConfig,
    mlAvailable,
    loading: flagsLoading,
    updateFlag,
    refetch: refetchFlags
  } = useMLFeatureFlags();

  const { modelStatus, loading: modelsLoading, refetch: refetchModels } = useMLModels();

  const loading = metricsLoading || flagsLoading || modelsLoading;
  const error = metricsError;

  // Fetch all data
  const fetchData = useCallback(async (): Promise<void> => {
    await Promise.all([refetchMetrics(), refetchFlags(), refetchModels()]);
  }, [refetchMetrics, refetchFlags, refetchModels]);

  // Subscribe to WebSocket ML events for real-time updates (when autoRefresh enabled)
  useEffect(() => {
    if (!isConnected || !autoRefresh) return;

    const unsubscribe = subscribe('ml:metrics', () => {
      void fetchData();
    });

    return unsubscribe;
  }, [isConnected, subscribe, autoRefresh, fetchData]);

  // Auto-refresh logic (fallback polling only when WebSocket disconnected)
  useEffect(() => {
    if (!autoRefresh) return;
    if (isConnected) return; // Skip polling when WebSocket is connected

    const interval = setInterval(() => {
      void fetchData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, isConnected, fetchData]);

  // Handle feature flag update
  const handleFeatureFlagUpdate = useCallback(
    (feature: keyof MLFeatureFlags, enabled: boolean): void => {
      void updateFlag(feature, enabled).then(() => {
        setNotification(`Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);
      });
    },
    [updateFlag]
  );

  if (loading) {
    return (
      <Container>
        <LoadingOverlay visible={loading} />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>
          <Group gap="xs">
            <IconDatabase size={32} />
            ML Pattern Recognition Dashboard
          </Group>
        </Title>

        <Group>
          <Switch
            label="Auto Refresh"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.currentTarget.checked)}
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              void fetchData();
            }}
            variant="light"
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {notification && (
        <Notification
          icon={<IconCheck size={18} />}
          color="teal"
          onClose={() => setNotification(null)}
          mb="md"
        >
          {notification}
        </Notification>
      )}

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconChartBar size={14} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="metrics" leftSection={<IconArrowUp size={14} />}>
            Metrics
          </Tabs.Tab>
          <Tabs.Tab value="models" leftSection={<IconDatabase size={14} />}>
            Models
          </Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={14} />}>
            Settings
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="xl">
          <MLMetricsOverview
            metrics={metrics}
            timeSeries={timeSeries}
            modelComparison={modelComparison}
            loading={metricsLoading}
          />
        </Tabs.Panel>

        <Tabs.Panel value="metrics" pt="xl">
          <MLMetricsDetail
            metrics={metrics}
            timeSeries={timeSeries}
            selectedMetric={selectedMetric}
            selectedInterval={selectedInterval}
            onMetricChange={setSelectedMetric}
            onIntervalChange={setSelectedInterval}
            onRefresh={() => {
              void fetchData();
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="models" pt="xl">
          <MLModelsStatus modelStatus={modelStatus} />
        </Tabs.Panel>

        <Tabs.Panel value="settings" pt="xl">
          <MLSettingsPanel
            featureFlags={featureFlags}
            mlConfig={mlConfig}
            mlAvailable={mlAvailable}
            onFeatureFlagUpdate={handleFeatureFlagUpdate}
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}

export const getServerSideProps = async (context: GetServerSidePropsContext): Promise<{
  props: Record<string, never>;
} | {
  redirect: { destination: string; permanent: boolean };
}> => {
  const session = await auth(context.req, context.res);

  if (!session?.user) {
    const callbackUrl = encodeURIComponent('/admin/ml-dashboard');
    return { redirect: { destination: `/login?callbackUrl=${callbackUrl}`, permanent: false } };
  }

  if (session.user.role !== UserRole.ADMIN) {
    return { redirect: { destination: '/', permanent: false } };
  }

  return { props: {} };
};
