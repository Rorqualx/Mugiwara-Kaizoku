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
  IconBrandTelegram,
  IconChartBar
} from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import {
  formatConnectionMessage,
  TelegramConnectionTab,
  TelegramStatusTab
} from '@/components/settings/integrations/telegram';
import type { TelegramConfig } from '@/types/config.types';
import { trpc } from '@/utils/trpc-client/index';

export default function TelegramIntegrationSettings(): ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('connection');
  const [isTesting, setIsTesting] = useState(false);

  // Get current Telegram configuration
  const {
    data: settingsData,
    refetch: refetchSettings
  } = trpc.settings.getIntegration.useQuery({
    type: 'telegram'
  });

  // Get Telegram status
  const {
    data: statusData,
    refetch: refetchStatus
  } = trpc.integrations.telegram.getStatus.useQuery();

  // Update configuration mutation
  const updateConfigMutation = trpc.settings.updateIntegration.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Settings Saved',
        message: 'Telegram integration settings have been updated',
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
  const testConnectionMutation = trpc.integrations.telegram.testConnection.useMutation({
    onSuccess: (data) => {
      setIsTesting(false);
      const message = formatConnectionMessage(data.botInfo);
      showNotification({
        title: 'Connection Successful',
        message,
        color: 'green',
        icon: <IconCheck />
      });
      void refetchStatus();
    },
    onError: (error) => {
      setIsTesting(false);
      showNotification({
        title: 'Connection Failed',
        message: (error instanceof Error ? error.message : String(error)) || 'Failed to connect to Telegram',
        color: 'red',
        icon: <IconX />
      });
    }
  });

  const form = useForm({
    initialValues: {
      enabled: false,
      botToken: '',
      chatId: ''
    }
  });

  // Update form when settings data loads
  useEffect(() => {
    if (settingsData) {
      const settings: unknown = settingsData;
      // Type guard to ensure we have TelegramConfig
      if (
        typeof settings === 'object' &&
        settings !== null &&
        'type' in settings &&
        settings.type === 'telegram' &&
        'enabled' in settings &&
        'botToken' in settings &&
        'chatId' in settings
      ) {
        const telegramSettings = settings as TelegramConfig;
        form.setValues({
          enabled: telegramSettings.enabled ?? false,
          botToken: telegramSettings.botToken ?? '',
          chatId: telegramSettings.chatId ?? ''
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData]);

  const handleSubmit = (values: typeof form.values): void => {
    void updateConfigMutation.mutateAsync({
      type: 'telegram',
      enabled: values.enabled,
      config: {
        botToken: values.botToken,
        chatId: values.chatId
      }
    });
  };

  const handleTestConnection = (): void => {
    setIsTesting(true);
    void testConnectionMutation.mutateAsync({
      botToken: form.values.botToken,
      chatId: form.values.chatId
    });
  };

  const isLoading = !settingsData && !statusData;
  const connectionStatus = statusData?.connectionStatus ?? 'not-configured';

  if (isLoading) {
    return (
      <SettingsLayout title="Telegram Integration">
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Telegram Integration">
      <Stack gap="lg">
        <Text c="dimmed" mb="md">
          Configure Telegram bot notifications for downloads and updates
        </Text>

        <Alert icon={<IconInfoCircle />} color="blue">
          Telegram bot notifications allow you to receive real-time updates about your manga downloads
          and library changes directly in Telegram. You'll need to create a bot and get your chat ID first.
        </Alert>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="connection" leftSection={<IconBrandTelegram size={14} />}>
              Connection
            </Tabs.Tab>
            <Tabs.Tab value="status" leftSection={<IconChartBar size={14} />}>
              Status
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="connection" pt="xl">
            <TelegramConnectionTab
              form={form}
              connectionStatus={connectionStatus}
              isTesting={isTesting || testConnectionMutation.isPending}
              isUpdating={updateConfigMutation.isPending}
              onSubmit={handleSubmit}
              onTestConnection={handleTestConnection}
            />
          </Tabs.Panel>

          <Tabs.Panel value="status" pt="xl">
            <TelegramStatusTab statusData={statusData} />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </SettingsLayout>
  );
}

// Use MainLayout for this page to get the full navigation
TelegramIntegrationSettings.getLayout = function getLayout(page: ReactElement): ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
