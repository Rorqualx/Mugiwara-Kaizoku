import React, { useState } from 'react';
import type { ReactElement } from 'react';

import { Stack, Tabs, Alert, Center, Loader } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconInfoCircle, IconBell, IconCheck, IconX, IconChartBar } from '@tabler/icons-react';

import {
  parseServicesText,
  formatTestMessage,
  getNotificationColor,
  AppriseConnectionTab,
  AppriseStatusTab
} from '@/components/settings/integrations/apprise';
import type { AppriseConfig } from '@/types/config.types';
import { trpc } from '@/utils/trpc-client/index';

function isAppriseSettings(value: unknown): value is AppriseConfig {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v['type'] === 'apprise' && 'enabled' in v && 'serviceUrl' in v && 'services' in v;
}

export function AppriseIntegrationContent(): ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('connection');
  const [isTesting, setIsTesting] = useState(false);
  const { data: settingsData, refetch: refetchSettings } = trpc.settings.getIntegration.useQuery({ type: 'apprise' });
  const { data: statusData, refetch: refetchStatus } = trpc.integrations.apprise.getStatus.useQuery();

  const updateConfigMutation = trpc.settings.updateIntegration.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Settings Saved', message: 'Apprise integration settings have been updated', color: 'green', icon: <IconCheck /> });
      void refetchSettings();
      void refetchStatus();
    },
    onError: (error) => {
      const message = (error instanceof Error ? error.message : String(error)) || 'Failed to save settings';
      showNotification({ title: 'Error', message, color: 'red', icon: <IconX /> });
    }
  });

  const testConnectionMutation = trpc.integrations.apprise.testConnection.useMutation({
    onSuccess: (data) => {
      setIsTesting(false);
      showNotification({
        title: 'Test Complete',
        message: formatTestMessage(data.successCount, data.failureCount),
        color: getNotificationColor(data.failureCount),
        icon: <IconCheck />
      });
      void refetchStatus();
    },
    onError: (error) => {
      setIsTesting(false);
      const message = (error instanceof Error ? error.message : String(error)) || 'Failed to send test notifications';
      showNotification({ title: 'Test Failed', message, color: 'red', icon: <IconX /> });
    }
  });

  const form = useForm({ initialValues: { enabled: false, serviceUrl: '', servicesText: '' } });

  React.useEffect(() => {
    if (!settingsData || !('data' in settingsData)) return;
    const settings = settingsData.data;
    if (!isAppriseSettings(settings)) return;
    form.setValues({
      enabled: settings.enabled,
      serviceUrl: settings.serviceUrl,
      servicesText: settings.services.join('\n')
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData]);

  const handleSubmit = (values: typeof form.values): void => {
    const services = parseServicesText(values.servicesText);
    void updateConfigMutation.mutateAsync({
      type: 'apprise',
      enabled: values.enabled,
      config: { serviceUrl: values.serviceUrl, services }
    });
  };
  const handleTestConnection = (): void => {
    setIsTesting(true);
    const services = parseServicesText(form.values.servicesText);
    void testConnectionMutation.mutateAsync({ serviceUrl: form.values.serviceUrl, services });
  };

  if (!settingsData && !statusData) {
    return <Center h={300}><Loader size="lg" /></Center>;
  }

  const connectionStatus = statusData?.connectionStatus ?? 'not-configured';
  const currentServices = parseServicesText(form.values.servicesText);

  return (
    <Stack gap="lg">
      <Alert icon={<IconInfoCircle />} color="blue">
        Apprise is a universal notification gateway that supports over 90 services including Discord,
        Slack, Email, Pushover, and many more. Configure your Apprise server and add service URLs to
        receive notifications across multiple platforms.
      </Alert>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="connection" leftSection={<IconBell size={14} />}>Connection</Tabs.Tab>
          <Tabs.Tab value="status" leftSection={<IconChartBar size={14} />}>Status</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="connection" pt="xl">
          <AppriseConnectionTab
            form={form}
            connectionStatus={connectionStatus}
            currentServices={currentServices}
            isTesting={isTesting || testConnectionMutation.isPending}
            isUpdating={updateConfigMutation.isPending}
            onSubmit={handleSubmit}
            onTestConnection={handleTestConnection}
          />
        </Tabs.Panel>
        <Tabs.Panel value="status" pt="xl">
          <AppriseStatusTab statusData={statusData} currentServices={currentServices} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
