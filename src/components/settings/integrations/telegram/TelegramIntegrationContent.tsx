import React, { useState } from 'react';
import type { ReactElement } from 'react';

import { Stack, Tabs, Alert, Center, Loader } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconInfoCircle, IconBrandTelegram, IconCheck, IconX, IconChartBar } from '@tabler/icons-react';

import {
  formatConnectionMessage,
  TelegramConnectionTab,
  TelegramStatusTab
} from '@/components/settings/integrations/telegram';
import type { TelegramConfig } from '@/types/config.types';
import { trpc } from '@/utils/trpc-client/index';

function isTelegramSettings(value: unknown): value is TelegramConfig {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v['type'] === 'telegram' && 'enabled' in v && 'botToken' in v && 'chatId' in v;
}

export function TelegramIntegrationContent(): ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('connection');
  const [isTesting, setIsTesting] = useState(false);
  const { data: settingsData, refetch: refetchSettings } = trpc.settings.getIntegration.useQuery({ type: 'telegram' });
  const { data: statusData, refetch: refetchStatus } = trpc.integrations.telegram.getStatus.useQuery();

  const updateConfigMutation = trpc.settings.updateIntegration.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Settings Saved', message: 'Telegram integration settings have been updated', color: 'green', icon: <IconCheck /> });
      void refetchSettings();
      void refetchStatus();
    },
    onError: (error) => {
      const message = (error instanceof Error ? error.message : String(error)) || 'Failed to save settings';
      showNotification({ title: 'Error', message, color: 'red', icon: <IconX /> });
    }
  });

  const testConnectionMutation = trpc.integrations.telegram.testConnection.useMutation({
    onSuccess: (data) => {
      setIsTesting(false);
      showNotification({ title: 'Connection Successful', message: formatConnectionMessage(data.botInfo), color: 'green', icon: <IconCheck /> });
      void refetchStatus();
    },
    onError: (error) => {
      setIsTesting(false);
      const message = (error instanceof Error ? error.message : String(error)) || 'Failed to connect to Telegram';
      showNotification({ title: 'Connection Failed', message, color: 'red', icon: <IconX /> });
    }
  });

  const form = useForm({ initialValues: { enabled: false, botToken: '', chatId: '' } });

  React.useEffect(() => {
    if (!settingsData) return;
    const settings: unknown = settingsData;
    if (!isTelegramSettings(settings)) return;
    form.setValues({
      enabled: settings.enabled,
      botToken: settings.botToken,
      chatId: settings.chatId
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData]);

  const handleSubmit = (values: typeof form.values): void => {
    void updateConfigMutation.mutateAsync({
      type: 'telegram',
      enabled: values.enabled,
      config: { botToken: values.botToken, chatId: values.chatId }
    });
  };
  const handleTestConnection = (): void => {
    setIsTesting(true);
    void testConnectionMutation.mutateAsync({ botToken: form.values.botToken, chatId: form.values.chatId });
  };

  if (!settingsData && !statusData) {
    return <Center h={300}><Loader size="lg" /></Center>;
  }

  const connectionStatus = statusData?.connectionStatus ?? 'not-configured';

  return (
    <Stack gap="lg">
      <Alert icon={<IconInfoCircle />} color="blue">
        Telegram bot notifications allow you to receive real-time updates about your manga downloads
        and library changes directly in Telegram. You'll need to create a bot and get your chat ID first.
      </Alert>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="connection" leftSection={<IconBrandTelegram size={14} />}>Connection</Tabs.Tab>
          <Tabs.Tab value="status" leftSection={<IconChartBar size={14} />}>Status</Tabs.Tab>
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
  );
}
