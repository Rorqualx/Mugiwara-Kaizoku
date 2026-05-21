/**
 * Discord Settings Component
 *
 * Settings panel for Discord notification configuration
 *
 * @module components/settings/notification/DiscordSettings
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

export interface DiscordFormValues {
  enabled: boolean;
  webhookUrl: string;
  username: string | undefined;
  avatarUrl: string | undefined;
  events: NotificationEventType[];
}

interface DiscordSettingsProps {
  form: UseFormReturnType<DiscordFormValues>;
  onSubmit: (values: DiscordFormValues) => void;
  onTest: () => void;
  isSubmitting: boolean;
  isTesting: boolean;
  eventOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>;
}

/**
 * Discord notification settings panel
 *
 * @param props - Component props
 * @returns Rendered Discord settings
 */
export function DiscordSettings({
  form,
  onSubmit,
  onTest,
  isSubmitting,
  isTesting,
  eventOptions,
}: DiscordSettingsProps): React.ReactElement {
  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={500}>Discord Notifications</Text>
              <Text size="sm" c="dimmed">
                Send notifications to Discord channels
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
            label="Discord Webhook URL"
            placeholder="https://discord.com/api/webhooks/..."
            description="Create a webhook in your Discord server settings"
            required
            disabled={!form.values.enabled}
            {...form.getInputProps('webhookUrl')}
          />

          <TextInput
            label="Bot Username"
            placeholder="Mugiwara Kaizoku"
            disabled={!form.values.enabled}
            {...form.getInputProps('username')}
          />

          <TextInput
            label="Avatar URL"
            placeholder="https://example.com/avatar.png"
            description="Optional custom avatar for the bot"
            disabled={!form.values.enabled}
            {...form.getInputProps('avatarUrl')}
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
              Send Test Discord Message
            </Button>

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!form.isDirty()}
            >
              Save Discord Settings
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
