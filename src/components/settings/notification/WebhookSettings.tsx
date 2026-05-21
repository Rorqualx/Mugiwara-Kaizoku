/**
 * Webhook Settings Component
 *
 * Settings panel for webhook notification configuration
 *
 * @module components/settings/notification/WebhookSettings
 */
import React from 'react';

import {
  TextInput,
  Select,
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

export interface WebhookFormValues {
  enabled: boolean;
  url: string;
  method: 'POST' | 'PUT';
  secret: string | undefined;
  headers: Record<string, string> | undefined;
  events: NotificationEventType[];
}

interface WebhookSettingsProps {
  form: UseFormReturnType<WebhookFormValues>;
  onSubmit: (values: WebhookFormValues) => void;
  onTest: () => void;
  isSubmitting: boolean;
  isTesting: boolean;
  eventOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>;
}

/**
 * Webhook notification settings panel
 *
 * @param props - Component props
 * @returns Rendered webhook settings
 */
export function WebhookSettings({
  form,
  onSubmit,
  onTest,
  isSubmitting,
  isTesting,
  eventOptions,
}: WebhookSettingsProps): React.ReactElement {
  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={500}>Webhook Notifications</Text>
              <Text size="sm" c="dimmed">
                Send notifications to a webhook endpoint
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
            label="Webhook URL"
            placeholder="https://your-webhook-endpoint.com/webhook"
            required
            disabled={!form.values.enabled}
            {...form.getInputProps('url')}
          />

          <TextInput
            label="Secret"
            placeholder="Optional webhook secret for verification"
            disabled={!form.values.enabled}
            {...form.getInputProps('secret')}
          />

          <Select
            label="HTTP Method"
            disabled={!form.values.enabled}
            data={[
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
            ]}
            {...form.getInputProps('method')}
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
              Send Test Webhook
            </Button>

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!form.isDirty()}
            >
              Save Webhook Settings
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
