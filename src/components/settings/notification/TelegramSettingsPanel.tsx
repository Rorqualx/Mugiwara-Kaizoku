/**
 * Telegram Settings Panel Component
 *
 * Settings panel for Telegram notification configuration in the full notification page
 *
 * @module components/settings/notification/TelegramSettingsPanel
 */
import React from 'react';

import {
  TextInput,
  Switch,
  MultiSelect,
  Button,
  Group,
  Stack,
  Text,
  Divider,
  Paper,
} from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { IconTestPipe } from '@tabler/icons-react';

import type { NotificationEventType } from '@prisma/client';

export interface TelegramFormValues {
  enabled: boolean;
  botToken: string;
  chatId: string;
  events: NotificationEventType[];
}

interface TelegramSettingsPanelProps {
  form: UseFormReturnType<TelegramFormValues>;
  onSubmit: (values: TelegramFormValues) => void;
  onTest: () => void;
  isSubmitting: boolean;
  isTesting: boolean;
  eventOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>;
}

/**
 * Telegram notification settings panel
 *
 * @param props - Component props
 * @returns Rendered Telegram settings
 */
export function TelegramSettingsPanel({
  form,
  onSubmit,
  onTest,
  isSubmitting,
  isTesting,
  eventOptions,
}: TelegramSettingsPanelProps): React.ReactElement {
  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={500}>Telegram Notifications</Text>
              <Text size="sm" c="dimmed">
                Send notifications to Telegram chats
              </Text>
            </div>
            <Switch
              checked={form.values.enabled}
              onChange={(event) =>
                form.setFieldValue('enabled', event.currentTarget.checked)
              }
              label={form.values.enabled ? 'Enabled' : 'Disabled'}
              color="green"
              size="md"
            />
          </Group>

          <Divider />

          <TextInput
            label="Bot Token"
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            description="Get from @BotFather on Telegram"
            required
            disabled={!form.values.enabled}
            {...form.getInputProps('botToken')}
          />

          <TextInput
            label="Chat ID"
            placeholder="-1001234567890"
            description="Your chat or channel ID"
            required
            disabled={!form.values.enabled}
            {...form.getInputProps('chatId')}
          />

          <MultiSelect
            label="Notification Events"
            placeholder="Select events to be notified about"
            data={eventOptions}
            disabled={!form.values.enabled}
            {...form.getInputProps('events')}
          />

          <Group justify="space-between" mt="lg">
            <Button
              variant="subtle"
              leftSection={<IconTestPipe />}
              onClick={onTest}
              disabled={!form.values.enabled}
              loading={isTesting}
            >
              Send Test Telegram Message
            </Button>

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!form.isDirty()}
            >
              Save Telegram Settings
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
