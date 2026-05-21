import React from 'react';

import { Paper, TextInput, PasswordInput, Button, Group, Stack, Switch, Divider, Badge, Radio, Text } from '@mantine/core';
import { IconPlugConnected, IconPlugConnectedX, IconTestPipe, IconX, IconUser, IconKey } from '@tabler/icons-react';

import type { KomgaFormValues } from '@/components/settings/integrations/komga/hooks';

import type { UseFormReturnType } from '@mantine/form';

export interface ConnectionTabProps {
  form: UseFormReturnType<KomgaFormValues>;
  connectionStatus: string;
  isTesting: boolean;
  isTestingConnection: boolean;
  isUpdating: boolean;
  onTestConnection: () => void;
  onSubmit: (values: KomgaFormValues) => void;
}

export function ConnectionTab({
  form,
  connectionStatus,
  isTesting,
  isTestingConnection,
  isUpdating,
  onTestConnection,
  onSubmit
}: ConnectionTabProps): React.ReactElement {
  const isTestDisabled =
    !form.values.enabled ||
    !form.values.host ||
    (form.values.authMethod === 'basic' && (!form.values.username || !form.values.password)) ||
    (form.values.authMethod === 'apikey' && !form.values.apiKey);

  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={500}>Connection Settings</Text>
              <Text size="sm" c="dimmed">Configure your Komga server connection</Text>
            </div>
            <Switch
              checked={form.values.enabled}
              onChange={event => form.setFieldValue('enabled', event.currentTarget.checked)}
              label={form.values.enabled ? 'Enabled' : 'Disabled'}
              color="green"
              size="md"
            />
          </Group>

          <Divider />

          <TextInput
            label="Komga Server URL"
            placeholder="http://localhost:8080"
            description="The URL of your Komga server"
            required
            disabled={!form.values.enabled}
            {...form.getInputProps('host')}
          />

          <Radio.Group
            label="Authentication Method"
            description="Choose how to authenticate with Komga"
            value={form.values.authMethod}
            onChange={value => form.setFieldValue('authMethod', value as 'basic' | 'apikey')}
          >
            <Group mt="xs">
              <Radio
                value="basic"
                label="Basic Authentication"
                icon={props => {
                  const iconProps = {
                    ...(props.size !== undefined && { size: props.size }),
                    ...(props.color !== undefined && { color: props.color }),
                    ...(props.stroke !== undefined && { stroke: props.stroke })
                  };
                  return <IconUser {...iconProps} />;
                }}
                disabled={!form.values.enabled}
              />
              <Radio
                value="apikey"
                label="API Key"
                icon={props => {
                  const iconProps = {
                    ...(props.size !== undefined && { size: props.size }),
                    ...(props.color !== undefined && { color: props.color }),
                    ...(props.stroke !== undefined && { stroke: props.stroke })
                  };
                  return <IconKey {...iconProps} />;
                }}
                disabled={!form.values.enabled}
              />
            </Group>
          </Radio.Group>

          {form.values.authMethod === 'basic' ? (
            <Group grow>
              <TextInput
                label="Username"
                placeholder="admin"
                required
                disabled={!form.values.enabled}
                {...form.getInputProps('username')}
              />
              <PasswordInput
                label="Password"
                placeholder="••••••••"
                required
                disabled={!form.values.enabled}
                {...form.getInputProps('password')}
              />
            </Group>
          ) : (
            <PasswordInput
              label="API Key"
              placeholder="Enter your Komga API key"
              description="API keys are supported in Komga v1.20.0+"
              required
              disabled={!form.values.enabled}
              {...form.getInputProps('apiKey')}
            />
          )}

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
                onClick={() => { void onTestConnection(); }}
                disabled={isTestDisabled}
                loading={isTesting || isTestingConnection}
              >
                Test Connection
              </Button>
              <Button
                type="submit"
                loading={isUpdating}
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
