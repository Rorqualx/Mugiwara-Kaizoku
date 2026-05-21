/**
 * Slack Settings Component
 *
 * Settings panel for Slack notification configuration
 *
 * @module components/settings/notification/SlackSettings
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

export interface SlackFormValues {
  enabled: boolean;
  webhookUrl: string;
  channel: string | undefined;
  username: string | undefined;
  events: NotificationEventType[];
}

interface SlackSettingsProps {
  form: UseFormReturnType<SlackFormValues>;
  onSubmit: (values: SlackFormValues) => void;
  onTest: () => void;
  isSubmitting: boolean;
  isTesting: boolean;
  eventOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>;
}

/**
 * Slack notification settings panel
 *
 * @param props - Component props
 * @returns Rendered Slack settings
 */
export function SlackSettings({
  form,
  onSubmit,
  onTest,
  isSubmitting,
  isTesting,
  eventOptions,
}: SlackSettingsProps): React.ReactElement {
  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={500}>Slack Notifications</Text>
              <Text size="sm" c="dimmed">
                Send notifications to Slack workspace
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
            label="Slack Webhook URL"
            placeholder="https://hooks.slack.com/services/..."
            description="Create an Incoming Webhook in your Slack workspace"
            required
            disabled={!form.values.enabled}
            {...form.getInputProps('webhookUrl')}
          />

          <TextInput
            label="Channel"
            placeholder="#manga-updates"
            description="Optional: Override default channel"
            disabled={!form.values.enabled}
            {...form.getInputProps('channel')}
          />

          <TextInput
            label="Bot Username"
            placeholder="Mugiwara Kaizoku"
            disabled={!form.values.enabled}
            {...form.getInputProps('username')}
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
              Send Test Slack Message
            </Button>

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!form.isDirty()}
            >
              Save Slack Settings
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
