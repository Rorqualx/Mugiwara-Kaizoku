import type { ReactElement } from 'react';

import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Stack,
  Alert,
  Text,
  Code,
  Divider
} from '@mantine/core';
import { IconInfoCircle, IconTestPipe } from '@tabler/icons-react';

import { ConnectionStatusBadge } from '@/components/settings/integrations/ConnectionStatusBadge';
import { IntegrationHeader } from '@/components/settings/integrations/IntegrationHeader';

import type { UseFormReturnType } from '@mantine/form';

interface TelegramFormValues {
  enabled: boolean;
  botToken: string;
  chatId: string;
}

interface TelegramConnectionTabProps {
  form: UseFormReturnType<TelegramFormValues>;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'not-configured';
  isTesting: boolean;
  isUpdating: boolean;
  onSubmit: (values: TelegramFormValues) => void;
  onTestConnection: () => void;
}

/**
 * Connection settings tab for Telegram integration
 */
export function TelegramConnectionTab({
  form,
  connectionStatus,
  isTesting,
  isUpdating,
  onSubmit,
  onTestConnection
}: TelegramConnectionTabProps): ReactElement {
  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <IntegrationHeader
            title="Connection Settings"
            description="Configure your Telegram bot connection"
            enabled={form.values.enabled}
            onEnabledChange={(enabled) => form.setFieldValue('enabled', enabled)}
          />

          <Divider />

          <Alert icon={<IconInfoCircle />} color="cyan" title="Setup Instructions">
            <Stack gap="xs">
              <Text size="sm">
                1. Create a bot by messaging{' '}
                <Code>@BotFather</Code> on Telegram and follow the instructions
              </Text>
              <Text size="sm">
                2. Copy the bot token provided by BotFather
              </Text>
              <Text size="sm">
                3. Start a chat with your bot and send any message
              </Text>
              <Text size="sm">
                4. Get your chat ID by messaging{' '}
                <Code>@userinfobot</Code> or{' '}
                <Code>@getidsbot</Code>
              </Text>
            </Stack>
          </Alert>

          <PasswordInput
            label="Bot Token"
            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            description="The token provided by @BotFather"
            required
            disabled={!form.values.enabled}
            {...form.getInputProps('botToken')}
          />

          <TextInput
            label="Chat ID"
            placeholder="123456789"
            description="Your Telegram user ID or group chat ID"
            required
            disabled={!form.values.enabled}
            {...form.getInputProps('chatId')}
          />

          <Group justify="space-between" mt="lg">
            <ConnectionStatusBadge status={connectionStatus} />
            <Group>
              <Button
                variant="subtle"
                leftSection={<IconTestPipe />}
                onClick={onTestConnection}
                disabled={!form.values.enabled || !form.values.botToken || !form.values.chatId}
                loading={isTesting}
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
