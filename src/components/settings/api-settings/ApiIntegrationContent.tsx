import { useState } from 'react';
import type { ReactElement } from 'react';

import { Stack, Tabs, Alert } from '@mantine/core';
import { IconInfoCircle, IconApi } from '@tabler/icons-react';

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
  useWebhookMutations
} from '@/components/settings/api-settings';
import type { ApiKeyFormValues, WebhookFormValues } from '@/components/settings/api-settings';
import { trpc } from '@/utils/trpc-client/index';

export function ApiIntegrationContent(): ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('keys');
  const [createKeyModalOpen, setCreateKeyModalOpen] = useState(false);
  const [createWebhookModalOpen, setCreateWebhookModalOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

  const apiKeys = trpc.api.getApiKeys.useQuery();
  const webhooks = trpc.api.getWebhooks.useQuery();

  const { createApiKey, deleteApiKey } = useApiKeyMutations(
    setShowApiKey,
    setCreateKeyModalOpen
  );

  const { createWebhook, deleteWebhook, testWebhook } = useWebhookMutations(
    setCreateWebhookModalOpen
  );

  const handleCreateApiKey = (values: ApiKeyFormValues): void => {
    const permissions = values.permissions.map((resource: string) => ({
      resource,
      actions: ['read', 'write'],
      scope: undefined
    }));

    void createApiKey.mutateAsync({
      name: values.name,
      permissions,
      expiresIn: values.expiresIn === '0' ? undefined : parseInt(values.expiresIn, 10)
    });
  };

  const handleCreateWebhook = (values: WebhookFormValues): void => {
    void createWebhook.mutateAsync({
      url: values.url,
      events: values.events,
      secret: values.secret
    });
  };

  return (
    <Stack gap="lg">
      <Alert icon={<IconInfoCircle />} color="blue">
        Enable external applications to connect to Mugiwara Kaizoku through our comprehensive API.
        Manage API keys, configure webhooks, and explore our API documentation.
      </Alert>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="keys" leftSection={<IconApi size={16} />}>
            API Keys
          </Tabs.Tab>
          <Tabs.Tab value="webhooks" leftSection={<IconApi size={16} />}>
            Webhooks
          </Tabs.Tab>
          <Tabs.Tab value="docs" leftSection={<IconApi size={16} />}>
            Documentation
          </Tabs.Tab>
          <Tabs.Tab value="playground" leftSection={<IconApi size={16} />}>
            API Playground
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="keys" pt="md">
          <ApiKeysTab
            apiKeys={{
              data: apiKeys.data,
              isPending: apiKeys.isPending,
              error: apiKeys.error
            }}
            deleteApiKeyMutation={deleteApiKey}
            showApiKey={showApiKey}
            setShowApiKey={setShowApiKey}
            setCreateKeyModalOpen={setCreateKeyModalOpen}
          />
        </Tabs.Panel>

        <Tabs.Panel value="webhooks" pt="md">
          <WebhooksTab
            webhooks={{
              data: webhooks.data,
              isPending: webhooks.isPending,
              error: webhooks.error
            }}
            deleteWebhookMutation={deleteWebhook}
            testWebhookMutation={testWebhook}
            setCreateWebhookModalOpen={setCreateWebhookModalOpen}
          />
        </Tabs.Panel>

        <Tabs.Panel value="docs" pt="md">
          <DocumentationTab />
        </Tabs.Panel>

        <Tabs.Panel value="playground" pt="md">
          <PlaygroundTab />
        </Tabs.Panel>
      </Tabs>

      <CreateApiKeyModal
        opened={createKeyModalOpen}
        onClose={() => setCreateKeyModalOpen(false)}
        onSubmit={handleCreateApiKey}
        permissionResources={PERMISSION_RESOURCES}
      />

      <CreateWebhookModal
        opened={createWebhookModalOpen}
        onClose={() => setCreateWebhookModalOpen(false)}
        onSubmit={handleCreateWebhook}
        webhookEvents={WEBHOOK_EVENTS}
      />
    </Stack>
  );
}
