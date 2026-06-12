/**
 * Notification Settings Page
 *
 * Page component for managing notification settings across all providers
 *
 * @module pages/settings/integrations/notifications
 */
import type { ReactElement } from 'react';
import React, { useState } from 'react';

import { Alert, Center, Loader, Stack, Tabs, Text } from '@mantine/core';
import {
  IconAdjustments,
  IconApi,
  IconBrandDiscord,
  IconBrandSlack,
  IconBrandTelegram,
  IconInfoCircle,
  IconMail,
} from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import { DiscordSettings } from '@/components/settings/notification/DiscordSettings';
import { EmailSettings } from '@/components/settings/notification/EmailSettings';
import { EVENT_OPTIONS } from '@/components/settings/notification/event-options';
import { useNotificationForms } from '@/components/settings/notification/hooks/useNotificationForms';
import { useNotificationHandlers } from '@/components/settings/notification/hooks/useNotificationHandlers';
import { useNotificationMutations } from '@/components/settings/notification/hooks/useNotificationMutations';
import { PreferenceMatrix } from '@/components/settings/notification/PreferenceMatrix';
import { SlackSettings } from '@/components/settings/notification/SlackSettings';
import { TelegramSettingsPanel } from '@/components/settings/notification/TelegramSettingsPanel';
import { WebhookSettings } from '@/components/settings/notification/WebhookSettings';
import type { NotificationConfig } from '@/types/search.types';
import { trpc } from '@/utils/trpc-client/index';


/**
 * Notification settings page
 *
 * @returns Notification settings page component
 */
export default function NotificationSettings(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('preferences');

  // Get current notification configuration (bare data; errors surface via tRPC)
  const { data: configData, refetch, isLoading } = trpc.notifications.getConfig.useQuery();

  // Type assertion is safe here because we know the backend returns NotificationConfig
  const notificationConfig = configData as NotificationConfig | undefined;

  // Initialize forms with current config
  const forms = useNotificationForms(notificationConfig);

  // Initialize mutations
  const mutations = useNotificationMutations(refetch);

  // Initialize handlers
  const handlers = useNotificationHandlers(mutations);

  if (isLoading) {
    return (
      <SettingsLayout title="Notification Settings">
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Notification Settings">
      <Stack gap="lg">
        <Text c="dimmed">
          Configure how you want to be notified about events in Mugiwara Kaizoku
        </Text>

        <Alert icon={<IconInfoCircle />} color="blue">
          Set up notifications to stay informed about important events like new chapters,
          download completions, and system updates.
        </Alert>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="preferences" leftSection={<IconAdjustments size={14} />}>
              My preferences
            </Tabs.Tab>
            <Tabs.Tab value="email" leftSection={<IconMail size={14} />}>
              Email
            </Tabs.Tab>
            <Tabs.Tab value="webhook" leftSection={<IconApi size={14} />}>
              Webhook
            </Tabs.Tab>
            <Tabs.Tab value="discord" leftSection={<IconBrandDiscord size={14} />}>
              Discord
            </Tabs.Tab>
            <Tabs.Tab value="slack" leftSection={<IconBrandSlack size={14} />}>
              Slack
            </Tabs.Tab>
            <Tabs.Tab value="telegram" leftSection={<IconBrandTelegram size={14} />}>
              Telegram
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="preferences" pt="xl">
            <PreferenceMatrix />
          </Tabs.Panel>

          <Tabs.Panel value="email" pt="xl">
            <EmailSettings
              form={forms.emailForm}
              onSubmit={handlers.handleEmailSubmit}
              onTest={() => handlers.handleTestNotification('email')}
              isSubmitting={mutations.updateEmail.isPending}
              isTesting={handlers.testingProviders['email'] ?? false}
              eventOptions={EVENT_OPTIONS}
            />
          </Tabs.Panel>

          <Tabs.Panel value="webhook" pt="xl">
            <WebhookSettings
              form={forms.webhookForm}
              onSubmit={handlers.handleWebhookSubmit}
              onTest={() => handlers.handleTestNotification('webhook')}
              isSubmitting={mutations.updateWebhook.isPending}
              isTesting={handlers.testingProviders['webhook'] ?? false}
              eventOptions={EVENT_OPTIONS}
            />
          </Tabs.Panel>

          <Tabs.Panel value="discord" pt="xl">
            <DiscordSettings
              form={forms.discordForm}
              onSubmit={handlers.handleDiscordSubmit}
              onTest={() => handlers.handleTestNotification('discord')}
              isSubmitting={mutations.updateDiscord.isPending}
              isTesting={handlers.testingProviders['discord'] ?? false}
              eventOptions={EVENT_OPTIONS}
            />
          </Tabs.Panel>

          <Tabs.Panel value="slack" pt="xl">
            <SlackSettings
              form={forms.slackForm}
              onSubmit={handlers.handleSlackSubmit}
              onTest={() => handlers.handleTestNotification('slack')}
              isSubmitting={mutations.updateSlack.isPending}
              isTesting={handlers.testingProviders['slack'] ?? false}
              eventOptions={EVENT_OPTIONS}
            />
          </Tabs.Panel>

          <Tabs.Panel value="telegram" pt="xl">
            <TelegramSettingsPanel
              form={forms.telegramForm}
              onSubmit={handlers.handleTelegramSubmit}
              onTest={() => handlers.handleTestNotification('telegram')}
              isSubmitting={mutations.updateTelegram.isPending}
              isTesting={handlers.testingProviders['telegram'] ?? false}
              eventOptions={EVENT_OPTIONS}
            />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </SettingsLayout>
  );
}

/**
 * Use MainLayout for this page to get the full navigation
 */
NotificationSettings.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
