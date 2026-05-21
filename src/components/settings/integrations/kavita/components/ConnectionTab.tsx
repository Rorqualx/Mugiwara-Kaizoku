/**
 * Kavita Integration Connection Tab Component
 *
 * Renders the connection settings panel for Kavita integration.
 * Handles server URL, API key configuration, and connection testing.
 *
 * @module kavita/components/ConnectionTab
 */

import React from 'react';

import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Stack,
  Switch,
  Divider,
  Badge,
  Tooltip,
  Text
} from '@mantine/core';
import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconX,
  IconKey,
  IconTestPipe
} from '@tabler/icons-react';

import type { KavitaTabComponentProps } from '@/components/settings/integrations/kavita/types';

/**
 * Connection settings tab component
 *
 * @param props - Component props
 * @returns React element
 */
export function ConnectionTab(props: KavitaTabComponentProps): React.ReactElement {
  const { form, connectionStatus, mutationHandlers, isTesting } = props;

  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(mutationHandlers.handleSubmit)}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={500}>Connection Settings</Text>
              <Text size="sm" c="dimmed">Configure your Kavita server connection</Text>
            </div>
            <Switch
              checked={form.values.enabled}
              onChange={(event) => form.setFieldValue('enabled', event.currentTarget.checked)}
              label={form.values.enabled ? 'Enabled' : 'Disabled'}
              color="green"
              size="md"
            />
          </Group>

          <Divider />

          <TextInput
            label="Kavita Server URL"
            placeholder="http://localhost:5000"
            description="The URL of your Kavita server"
            required
            disabled={!form.values.enabled}
            value={form.values.host}
            onChange={(event) => form.setFieldValue('host', event.currentTarget.value)}
          />

          <div>
            <PasswordInput
              label="API Key"
              placeholder="Enter your Kavita API key"
              description="Get your API key from Kavita user dashboard at /preferences#clients"
              required
              disabled={!form.values.enabled}
              value={form.values.apiKey}
              onChange={(event) => form.setFieldValue('apiKey', event.currentTarget.value)}
            />

            <Group justify="flex-end" mt="xs">
              <Tooltip label="Instructions to get API key from Kavita">
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconKey size={16} />}
                  onClick={() => { void mutationHandlers.handleGenerateApiKey(); }}
                  disabled={!form.values.enabled || !form.values.host}
                >
                  How to Get API Key
                </Button>
              </Tooltip>
            </Group>
          </div>

          <Group justify="space-between" mt="lg">
            <Group>
              {connectionStatus === 'connected' && (
                <Badge color="green" leftSection={<IconPlugConnected size={16} />}>
                  Connected
                </Badge>
              )}
              {connectionStatus === 'disconnected' && (
                <Badge color="red" leftSection={<IconPlugConnectedX size={16} />}>
                  Disconnected
                </Badge>
              )}
              {connectionStatus === 'error' && (
                <Badge color="red" leftSection={<IconX size={16} />}>
                  Error
                </Badge>
              )}
            </Group>
            <Group>
              <Button
                variant="subtle"
                leftSection={<IconTestPipe />}
                onClick={() => {
                  void mutationHandlers.handleTestConnection(
                    form.values.host,
                    form.values.apiKey
                  );
                }}
                disabled={!form.values.enabled || !form.values.host || !form.values.apiKey}
                loading={isTesting}
              >
                Test Connection
              </Button>
              <Button
                type="submit"
                disabled={!form.isDirty()}
              >
                Save Settings
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
