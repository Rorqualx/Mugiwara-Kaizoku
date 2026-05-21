import type { ReactElement } from 'react';
import React, { useState, useEffect } from 'react';

import {
  Text,
  Stack,
  Alert,
  Tabs,
  Center,
  Loader
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import {
  IconInfoCircle,
  IconCheck,
  IconX,
  IconBell,
  IconChartBar
} from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import {
  parseServicesText,
  formatTestMessage,
  getNotificationColor,
  AppriseConnectionTab,
  AppriseStatusTab
} from '@/components/settings/integrations/apprise';
import type { AppriseConfig } from '@/types/config.types';
import { trpc } from '@/utils/trpc-client/index';

export default function AppriseIntegrationSettings(): ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('connection');
  const [isTesting, setIsTesting] = useState(false);

  // Get current Apprise configuration
  const {
    data: settingsData,
    refetch: refetchSettings
  } = trpc.settings.getIntegration.useQuery({
    type: 'apprise'
  });

  // Get Apprise status
  const {
    data: statusData,
    refetch: refetchStatus
  } = trpc.integrations.apprise.getStatus.useQuery();

  // Update configuration mutation
  const updateConfigMutation = trpc.settings.updateIntegration.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Settings Saved',
        message: 'Apprise integration settings have been updated',
        color: 'green',
        icon: <IconCheck />
      });
      void refetchSettings();
      void refetchStatus();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: (error instanceof Error ? error.message : String(error)) || 'Failed to save settings',
        color: 'red',
        icon: <IconX />
      });
    }
  });

  // Test connection mutation
  const testConnectionMutation = trpc.integrations.apprise.testConnection.useMutation({
    onSuccess: (data) => {
      setIsTesting(false);
      const message = formatTestMessage(data.successCount, data.failureCount);
      showNotification({
        title: 'Test Complete',
        message,
        color: getNotificationColor(data.failureCount),
        icon: <IconCheck />
      });
      void refetchStatus();
    },
    onError: (error) => {
      setIsTesting(false);
      showNotification({
        title: 'Test Failed',
        message: (error instanceof Error ? error.message : String(error)) || 'Failed to send test notifications',
        color: 'red',
        icon: <IconX />
      });
    }
  });

  const form = useForm({
    initialValues: {
      enabled: false,
      serviceUrl: '',
      servicesText: '' // Textarea input - will be parsed to array
    }
  });

  // Update form when settings data loads
  useEffect(() => {
    if (settingsData && 'data' in settingsData && settingsData.data) {
      const settings = settingsData.data;
      // Type guard to ensure we have AppriseConfig
      if (
        typeof settings === 'object' &&
        settings !== null &&
        'type' in settings &&
        settings.type === 'apprise' &&
        'enabled' in settings &&
        'serviceUrl' in settings &&
        'services' in settings
      ) {
        const appriseSettings = settings as AppriseConfig;
        form.setValues({
          enabled: appriseSettings.enabled ?? false,
          serviceUrl: appriseSettings.serviceUrl ?? '',
          servicesText: (appriseSettings.services ?? []).join('\n')
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData]);

  const handleSubmit = (values: typeof form.values): void => {
    const services = parseServicesText(values.servicesText);

    void updateConfigMutation.mutateAsync({
      type: 'apprise',
      enabled: values.enabled,
      config: {
        serviceUrl: values.serviceUrl,
        services
      }
    });
  };

  const handleTestConnection = (): void => {
    setIsTesting(true);
    const services = parseServicesText(form.values.servicesText);

    void testConnectionMutation.mutateAsync({
      serviceUrl: form.values.serviceUrl,
      services
    });
  };

  const isLoading = !settingsData && !statusData;
  const connectionStatus = statusData?.connectionStatus ?? 'not-configured';
  const currentServices = parseServicesText(form.values.servicesText);

  if (isLoading) {
    return (
      <SettingsLayout title="Apprise Integration">
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Apprise Integration">
      <Stack gap="lg">
        <Text c="dimmed" mb="md">
          Configure Apprise for multi-service notifications (90+ services supported)
        </Text>

        <Alert icon={<IconInfoCircle />} color="blue">
          Apprise is a universal notification gateway that supports over 90 services including Discord,
          Slack, Email, Pushover, and many more. Configure your Apprise server and add service URLs to
          receive notifications across multiple platforms.
        </Alert>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="connection" leftSection={<IconBell size={14} />}>
              Connection
            </Tabs.Tab>
            <Tabs.Tab value="status" leftSection={<IconChartBar size={14} />}>
              Status
            </Tabs.Tab>
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
            <AppriseStatusTab
              statusData={statusData}
              currentServices={currentServices}
            />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </SettingsLayout>
  );
}

// Use MainLayout for this page to get the full navigation
AppriseIntegrationSettings.getLayout = function getLayout(page: ReactElement): ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
