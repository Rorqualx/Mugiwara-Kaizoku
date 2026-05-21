/**
 * API Settings Page
 *
 * Comprehensive API access management for external applications
 * Allows users to:
 * - Generate and manage API keys
 * - Configure webhooks for event notifications
 * - View API documentation
 * - Test API endpoints
 *
 * @module pages/settings/api
 */

import React, { useState } from 'react';
import type { ReactElement } from 'react';

import {
  Container,
  Tabs,
  Box,
  Title,
  Text,
} from '@mantine/core';
import {
  IconKey,
  IconPlugConnected,
  IconBook,
  IconTestPipe,
} from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import {
  ApiKeysTab,
  WebhooksTab,
  DocumentationTab,
  PlaygroundTab,
  CreateApiKeyModal,
  CreateWebhookModal,
  PERMISSION_RESOURCES,
  WEBHOOK_EVENTS,
  useApiKeyMutations,
  useWebhookMutations,
} from '@/components/settings/api-settings';
import type { ApiKeyFormValues, WebhookFormValues } from '@/components/settings/api-settings';
import { trpc } from '@/utils/trpc-client';

/**
 * API Settings Page Component
 */
function ApiSettingsPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('keys');
  const [createKeyModalOpen, setCreateKeyModalOpen] = useState(false);
  const [createWebhookModalOpen, setCreateWebhookModalOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

  // tRPC queries
  const apiKeys = trpc.api.getApiKeys.useQuery();
  const webhooks = trpc.api.getWebhooks.useQuery();

  // Mutations
  const { createApiKey, deleteApiKey } = useApiKeyMutations(
    setShowApiKey,
    setCreateKeyModalOpen
  );

  const { createWebhook, deleteWebhook, testWebhook } = useWebhookMutations(
    setCreateWebhookModalOpen
  );

  // Event handlers
  const handleCreateApiKey = (values: ApiKeyFormValues): void => {
    const permissions = values.permissions.map((resource: string) => ({
      resource,
      actions: ['read', 'write'], // Default to read/write for now
      scope: undefined,
    }));

    void createApiKey.mutateAsync({
      name: values.name,
      permissions,
      expiresIn: values.expiresIn === '0' ? undefined : parseInt(values.expiresIn, 10),
    });
  };

  const handleCreateWebhook = (values: WebhookFormValues): void => {
    void createWebhook.mutateAsync({
      url: values.url,
      events: values.events,
      secret: values.secret,
    });
  };

  return (
    <SettingsLayout title="API Access">
      <Container size="xl" py="xl">
        <Box mb="xl">
          <Title order={2} mb="sm">API Configuration</Title>
          <Text c="dimmed">
            Enable external applications to connect to Mugiwara Kaizoku through our comprehensive API.
            Manage API keys, configure webhooks, and explore our API documentation.
          </Text>
        </Box>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="keys" leftSection={<IconKey size={16} />}>
              API Keys
            </Tabs.Tab>
            <Tabs.Tab value="webhooks" leftSection={<IconPlugConnected size={16} />}>
              Webhooks
            </Tabs.Tab>
            <Tabs.Tab value="docs" leftSection={<IconBook size={16} />}>
              Documentation
            </Tabs.Tab>
            <Tabs.Tab value="playground" leftSection={<IconTestPipe size={16} />}>
              API Playground
            </Tabs.Tab>
          </Tabs.List>

          {/* API Keys Tab */}
          <Tabs.Panel value="keys" pt="md">
            <ApiKeysTab
              apiKeys={{
                data: apiKeys.data,
                isPending: apiKeys.isPending,
                error: apiKeys.error,
              }}
              deleteApiKeyMutation={deleteApiKey}
              showApiKey={showApiKey}
              setShowApiKey={setShowApiKey}
              setCreateKeyModalOpen={setCreateKeyModalOpen}
            />
          </Tabs.Panel>

          {/* Webhooks Tab */}
          <Tabs.Panel value="webhooks" pt="md">
            <WebhooksTab
              webhooks={{
                data: webhooks.data,
                isPending: webhooks.isPending,
                error: webhooks.error,
              }}
              deleteWebhookMutation={deleteWebhook}
              testWebhookMutation={testWebhook}
              setCreateWebhookModalOpen={setCreateWebhookModalOpen}
            />
          </Tabs.Panel>

          {/* Documentation Tab */}
          <Tabs.Panel value="docs" pt="md">
            <DocumentationTab />
          </Tabs.Panel>

          {/* API Playground Tab */}
          <Tabs.Panel value="playground" pt="md">
            <PlaygroundTab />
          </Tabs.Panel>
        </Tabs>

        {/* Create API Key Modal */}
        <CreateApiKeyModal
          opened={createKeyModalOpen}
          onClose={() => setCreateKeyModalOpen(false)}
          onSubmit={handleCreateApiKey}
          permissionResources={PERMISSION_RESOURCES}
        />

        {/* Create Webhook Modal */}
        <CreateWebhookModal
          opened={createWebhookModalOpen}
          onClose={() => setCreateWebhookModalOpen(false)}
          onSubmit={handleCreateWebhook}
          webhookEvents={WEBHOOK_EVENTS}
        />
      </Container>
    </SettingsLayout>
  );
}

// Use MainLayout for this page
ApiSettingsPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};

export default ApiSettingsPage;
