import React from 'react';

import {
  Paper,
  Group,
  Box,
  Title,
  Text,
  Button,
  Table,
  Badge,
  ActionIcon,
  LoadingOverlay,
  Alert,
} from '@mantine/core';
import { IconPlus, IconTestPipe, IconTrash } from '@tabler/icons-react';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  deliveryCount: number;
  failureCount: number;
}

interface WebhooksTabProps {
  webhooks: {
    data?: Webhook[] | undefined;
    isPending: boolean;
    error?: unknown | undefined;
  };
  deleteWebhookMutation: {
    mutateAsync: (variables: { id: string }) => Promise<unknown>;
  };
  testWebhookMutation: {
    mutateAsync: (variables: { id: string }) => Promise<unknown>;
  };
  setCreateWebhookModalOpen: (open: boolean) => void;
}

export function WebhooksTab({
  webhooks,
  deleteWebhookMutation,
  testWebhookMutation,
  setCreateWebhookModalOpen,
}: WebhooksTabProps): React.ReactElement {
  return (
    <Paper shadow="xs" p="xl" withBorder>
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={3}>Webhooks</Title>
          <Text size="sm" c="dimmed">
            Configure webhooks to receive real-time notifications about events
          </Text>
        </Box>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateWebhookModalOpen(true)}
        >
          Create Webhook
        </Button>
      </Group>

      {webhooks.isPending ? (
        <LoadingOverlay visible />
      ) : (webhooks.data?.length ?? 0) === 0 ? (
        <Alert color="blue">
          No webhooks configured yet. Create your first webhook to receive event notifications.
        </Alert>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>URL</Table.Th>
              <Table.Th>Events</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Deliveries</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {webhooks.data?.map((webhook) => (
              <Table.Tr key={webhook.id}>
                <Table.Td>
                  <Text size="sm" style={{ maxWidth: 300 }} truncate>
                    {webhook.url}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {webhook.events.slice(0, 2).map((event) => (
                      <Badge key={event} size="sm">
                        {event}
                      </Badge>
                    ))}
                    {webhook.events.length > 2 && (
                      <Badge size="sm" variant="light">
                        +{webhook.events.length - 2}
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={webhook.enabled ? 'green' : 'gray'}
                    variant="dot"
                  >
                    {webhook.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {webhook.deliveryCount} total
                  {webhook.failureCount > 0 && (
                    <Text size="xs" c="red">
                      ({webhook.failureCount} failed)
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => void testWebhookMutation.mutateAsync({ id: webhook.id })}
                    >
                      <IconTestPipe size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => {
                        if (confirm(`Delete webhook for "${webhook.url}"?`)) {
                          void deleteWebhookMutation.mutateAsync({ id: webhook.id });
                        }
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}