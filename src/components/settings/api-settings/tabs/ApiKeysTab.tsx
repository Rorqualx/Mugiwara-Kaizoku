import React from 'react';

import {
  Paper,
  Group,
  Box,
  Title,
  Text,
  Button,
  Alert,
  Code,
  CopyButton,
  Table,
  Badge,
  ActionIcon,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconPlus,
  IconAlertCircle,
  IconCheck,
  IconCopy,
  IconTrash,
} from '@tabler/icons-react';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: Array<{
    id: string;
    resource: string;
  }>;
  lastUsedAt?: Date | string;
  createdAt: Date | string;
}

interface ApiKeysTabProps {
  apiKeys: {
    data?: ApiKey[] | undefined;
    isPending: boolean;
    error?: unknown | undefined;
  };
  deleteApiKeyMutation: {
    mutateAsync: (variables: { id: string }) => Promise<unknown>;
  };
  showApiKey: string | null;
  setShowApiKey: (key: string | null) => void;
  setCreateKeyModalOpen: (open: boolean) => void;
}

export function ApiKeysTab({
  apiKeys,
  deleteApiKeyMutation,
  showApiKey,
  setShowApiKey,
  setCreateKeyModalOpen,
}: ApiKeysTabProps): React.ReactElement {
  return (
    <Paper shadow="xs" p="xl" withBorder>
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={3}>API Keys</Title>
          <Text size="sm" c="dimmed">
            Generate API keys for third-party applications and services
          </Text>
        </Box>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateKeyModalOpen(true)}
        >
          Create API Key
        </Button>
      </Group>

      {showApiKey && (
        <Alert
          icon={<IconAlertCircle />}
          color="yellow"
          title="Save your API key"
          withCloseButton
          onClose={() => setShowApiKey(null)}
          mb="lg"
        >
          <Text size="sm" mb="xs">
            Make sure to copy your API key now. You won't be able to see it again!
          </Text>
          <Group>
            <Code>{showApiKey}</Code>
            <CopyButton value={showApiKey}>
              {({ copied, copy }) => (
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  onClick={copy}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Alert>
      )}

      {apiKeys.isPending ? (
        <LoadingOverlay visible />
      ) : (apiKeys.data?.length ?? 0) === 0 ? (
        <Alert color="blue">
          No API keys created yet. Create your first API key to get started.
        </Alert>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Key (Prefix)</Table.Th>
              <Table.Th>Permissions</Table.Th>
              <Table.Th>Last Used</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {apiKeys.data?.map((key) => (
              <Table.Tr key={key.id}>
                <Table.Td>{key.name}</Table.Td>
                <Table.Td>
                  <Code>{key.keyPrefix}</Code>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {key.permissions.map((perm) => (
                      <Badge key={perm.id} size="sm">
                        {perm.resource}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
                <Table.Td>
                  {key.lastUsedAt
                    ? new Date(key.lastUsedAt).toLocaleDateString()
                    : 'Never'}
                </Table.Td>
                <Table.Td>
                  {new Date(key.createdAt).toLocaleDateString()}
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => {
                      if (confirm(`Delete API key "${key.name}"?`)) {
                        void deleteApiKeyMutation.mutateAsync({ id: key.id });
                      }
                    }}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}