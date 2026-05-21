/**
 * FlareSolverr Settings Page
 *
 * Configure the Cloudflare-bypass binary, monitor health, and manage
 * sessions/logs. Card subcomponents live under
 * `src/components/flaresolverr/settings/`.
 */

import React, { useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';

import { Container, Card, Stack, Group, Button, Loader, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck } from '@tabler/icons-react';

import { FlareSolverrMetricsDashboard } from '@/components/flaresolverr/metrics';
import {
  BinaryDependenciesCard,
  ConnectionSettingsCard,
  InstanceControlCard,
  InternalLogsCard,
  ServiceStatusCard,
  SessionManagementCard,
  handleRestartResult,
  handleTestConnectionResult,
  showErrorNotification,
  showSuccessNotification,
  validateSessionTTL,
  validateTimeout,
  validateUrl,
  validateWaitSecs,
} from '@/components/flaresolverr/settings';
import type { FlareSolverrSettingsValues } from '@/components/flaresolverr/settings';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import { useRealTime } from '@/providers/RealTimeProvider';
import { trpc } from '@/utils/trpc-client/index';

const DEFAULT_FORM_VALUES: FlareSolverrSettingsValues = {
  enabled: true,
  autoStart: false,
  url: 'http://localhost:8191/v1',
  timeout: 60000,
  sessionTTL: 1800000,
  disableMedia: true,
  defaultWaitSecs: 0,
};

function FlareSolverrSettings(): React.ReactElement {
  const utils = trpc.useUtils();
  const { isConnected, subscribe } = useRealTime();

  const {
    data: settings,
    isLoading: settingsLoading,
    refetch: refetchSettings,
  } = trpc.flaresolverr.getSettings.useQuery();

  const {
    data: healthStatus,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = trpc.flaresolverr.getHealthStatus.useQuery(undefined, {
    refetchInterval: isConnected ? false : 30000,
  });

  const {
    data: sessionData,
    refetch: refetchSessions,
  } = trpc.flaresolverr.getSessionList.useQuery(undefined, {
    refetchInterval: isConnected ? false : 30000,
  });

  const { data: binaryInfo, isLoading: binaryLoading } = trpc.flaresolverr.getBinaryInfo.useQuery();
  const { data: chromeInfo, isLoading: chromeLoading } = trpc.flaresolverr.checkChrome.useQuery();

  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = trpc.flaresolverr.getLogs.useQuery({ lines: 200 }, {
    refetchInterval: 10000,
  });

  const memoizedRefetchAll = useCallback((): void => {
    void refetchHealth();
    void refetchSessions();
  }, [refetchHealth, refetchSessions]);

  useEffect(() => {
    if (!isConnected) return;
    const unsubscribe = subscribe('system:status', () => {
      memoizedRefetchAll();
    });
    return unsubscribe;
  }, [isConnected, subscribe, memoizedRefetchAll]);

  const updateSettingsMutation = trpc.flaresolverr.updateSettings.useMutation({
    onSuccess: () => {
      showSuccessNotification('Settings Updated', 'FlareSolverr settings have been saved');
      void refetchSettings();
      void refetchHealth();
    },
    onError: (error) => {
      showErrorNotification('Error', error.message ?? 'Failed to update settings');
    },
  });

  const testConnectionMutation = trpc.flaresolverr.testConnection.useMutation({
    onSuccess: handleTestConnectionResult,
    onError: (error) => {
      showErrorNotification('Connection Test Failed', error.message ?? 'Failed to test connection');
    },
  });

  const clearSessionsMutation = trpc.flaresolverr.clearSessions.useMutation({
    onSuccess: (result) => {
      showSuccessNotification('Sessions Cleared', result.message);
      void refetchSessions();
      void refetchHealth();
    },
    onError: (error) => {
      showErrorNotification('Error', error.message ?? 'Failed to clear sessions');
    },
  });

  const restartMutation = trpc.flaresolverr.restart.useMutation({
    onSuccess: (result) => {
      handleRestartResult(result);
      void refetchHealth();
      void utils.flaresolverr.invalidate();
    },
    onError: (error) => {
      showErrorNotification('Restart Failed', error.message ?? 'Failed to restart FlareSolverr');
    },
  });

  const startMutation = trpc.flaresolverr.start.useMutation({
    onSuccess: (result) => {
      if (result.success) showSuccessNotification('Instance Started', result.message);
      else showErrorNotification('Start Failed', result.message);
      void refetchHealth();
    },
    onError: (error) => {
      showErrorNotification('Start Failed', error.message ?? 'Failed to start FlareSolverr');
    },
  });

  const stopMutation = trpc.flaresolverr.stop.useMutation({
    onSuccess: (result) => {
      if (result.success) showSuccessNotification('Instance Stopped', result.message);
      else showErrorNotification('Stop Failed', result.message);
      void refetchHealth();
    },
    onError: (error) => {
      showErrorNotification('Stop Failed', error.message ?? 'Failed to stop FlareSolverr');
    },
  });

  const clearLogsMutation = trpc.flaresolverr.clearLogs.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        showSuccessNotification('Logs Cleared', result.message);
        void refetchLogs();
      } else {
        showErrorNotification('Clear Failed', result.message);
      }
    },
    onError: (error) => {
      showErrorNotification('Clear Failed', error.message);
    },
  });

  const form = useForm<FlareSolverrSettingsValues>({
    initialValues: DEFAULT_FORM_VALUES,
    validate: {
      url: validateUrl,
      timeout: validateTimeout,
      sessionTTL: validateSessionTTL,
      defaultWaitSecs: validateWaitSecs,
    },
  });

  useEffect(() => {
    if (settings) {
      form.setValues({
        enabled: settings.enabled,
        autoStart: settings.autoStart,
        url: settings.url,
        timeout: settings.timeout,
        sessionTTL: settings.sessionTTL,
        disableMedia: settings.disableMedia,
        defaultWaitSecs: settings.defaultWaitSecs,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const handleSubmit = async (values: FlareSolverrSettingsValues): Promise<void> => {
    await updateSettingsMutation.mutateAsync(values);
  };

  const handleResetForm = (): void => {
    if (settings) {
      form.setValues({
        enabled: settings.enabled,
        autoStart: settings.autoStart,
        url: settings.url,
        timeout: settings.timeout,
        sessionTTL: settings.sessionTTL,
        disableMedia: settings.disableMedia,
        defaultWaitSecs: settings.defaultWaitSecs,
      });
    }
  };

  if (settingsLoading) {
    return (
      <SettingsLayout title="FlareSolverr">
        <Container size="xl" px={0}>
          <Stack align="center" justify="center" h={200}>
            <Loader size="lg" />
            <Text>Loading FlareSolverr settings...</Text>
          </Stack>
        </Container>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="FlareSolverr">
      <Container size="xl" px={0}>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            <ServiceStatusCard
              healthStatus={healthStatus}
              healthLoading={healthLoading}
              sessionData={sessionData}
              settings={settings}
              onRefresh={memoizedRefetchAll}
            />

            <BinaryDependenciesCard
              binaryInfo={binaryInfo}
              binaryLoading={binaryLoading}
              chromeInfo={chromeInfo}
              chromeLoading={chromeLoading}
            />

            <InstanceControlCard
              isRunning={healthStatus?.isRunning ?? false}
              canRestart={healthStatus?.lifecycleStatus?.canRestart ?? false}
              startPending={startMutation.isPending}
              stopPending={stopMutation.isPending}
              restartPending={restartMutation.isPending}
              onStart={() => startMutation.mutate()}
              onStop={() => stopMutation.mutate()}
              onRestart={() => restartMutation.mutate()}
              form={form}
            />

            <Card shadow="sm" p="lg" radius="md">
              <FlareSolverrMetricsDashboard />
            </Card>

            <ConnectionSettingsCard
              form={form}
              testPending={testConnectionMutation.isPending}
              onTestConnection={() => testConnectionMutation.mutate({ url: form.values.url })}
            />

            <SessionManagementCard
              sessionData={sessionData}
              canRestart={healthStatus?.lifecycleStatus?.canRestart ?? false}
              clearPending={clearSessionsMutation.isPending}
              restartPending={restartMutation.isPending}
              onClear={() => clearSessionsMutation.mutate()}
              onRestart={() => restartMutation.mutate()}
            />

            <InternalLogsCard
              logsData={logsData}
              logsLoading={logsLoading}
              clearPending={clearLogsMutation.isPending}
              onRefresh={() => void refetchLogs()}
              onClear={() => clearLogsMutation.mutate()}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={handleResetForm} disabled={updateSettingsMutation.isPending}>
                Reset
              </Button>
              <Button type="submit" loading={updateSettingsMutation.isPending} leftSection={<IconCheck />}>
                Save Settings
              </Button>
            </Group>
          </Stack>
        </form>
      </Container>
    </SettingsLayout>
  );
}

export default FlareSolverrSettings;

FlareSolverrSettings.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
